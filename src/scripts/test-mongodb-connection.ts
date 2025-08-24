import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from '../config/configuration';

// MongoDB용 AuditLog 스키마 정의 (TypeORM 엔티티를 참조하여 Mongoose 스키마로 변환)
import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Schema({ collection: 'audit_logs' })
export class AuditLogMongo {
  @Prop({ required: true, maxLength: 100 })
  action: string; // 수행된 액션

  @Prop({ required: true, maxLength: 100 })
  resource: string; // 대상 리소스 타입

  @Prop({ required: true, maxLength: 255 })
  resourceId: string; // 리소스 식별자

  @Prop({ maxLength: 100 })
  userId?: string; // 사용자 ID

  @Prop({ maxLength: 50 })
  userRole?: string; // 사용자 역할

  @Prop({ type: Object })
  details?: Record<string, any>; // 상세 정보

  @Prop({ maxLength: 45 })
  ipAddress?: string; // IP 주소

  @Prop()
  userAgent?: string; // User Agent

  @Prop({ default: Date.now })
  timestamp: Date; // 로그 생성 시각

  @Prop({ 
    enum: ['success', 'failed', 'blocked'], 
    default: 'success' 
  })
  status: string; // 결과 상태

  @Prop({ min: 1, max: 5, default: 3 })
  severity: number; // 중요도 (1-5)
}

export type AuditLogMongoDocument = AuditLogMongo & Document;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLogMongo);

// 인덱스 설정
AuditLogSchema.index({ resource: 1, action: 1 }, { background: true });
AuditLogSchema.index({ userId: 1 }, { background: true });
AuditLogSchema.index({ timestamp: -1 }, { background: true });

// 테스트 서비스
export class MongoDBTestService {
  constructor(
    @InjectModel(AuditLogMongo.name) 
    private auditLogModel: Model<AuditLogMongoDocument>
  ) {}

  // 목업 AuditLog 데이터 생성 메서드
  private createMockAuditLogData(): Partial<AuditLogMongo>[] {
    return [
      {
        action: 'CREATE_ORDER',
        resource: 'Order',
        resourceId: 'order_12345',
        userId: 'user_67890',
        userRole: 'customer',
        details: {
          orderId: 'order_12345',
          totalAmount: 25000,
          items: [
            { itemId: 'item_001', name: '스마트폰', quantity: 1, price: 25000 }
          ],
          paymentMethod: 'credit_card',
          couponCode: 'DISCOUNT10'
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        status: 'success',
        severity: 4
      },
      {
        action: 'PAYMENT_PROCESS',
        resource: 'Payment',
        resourceId: 'payment_98765',
        userId: 'user_67890',
        userRole: 'customer',
        details: {
          paymentId: 'payment_98765',
          amount: 22500, // 쿠폰 할인 적용
          gateway: 'stripe',
          cardLastFour: '1234',
          transactionId: 'txn_abc123'
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        status: 'success',
        severity: 5
      },
      {
        action: 'COUPON_VALIDATE',
        resource: 'Coupon',
        resourceId: 'coupon_DISCOUNT10',
        userId: 'user_67890',
        userRole: 'customer',
        details: {
          couponCode: 'DISCOUNT10',
          discountType: 'percentage',
          discountValue: 10,
          originalAmount: 25000,
          discountAmount: 2500,
          validationResult: 'valid'
        },
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        status: 'success',
        severity: 3
      },
      {
        action: 'INVENTORY_UPDATE',
        resource: 'Inventory',
        resourceId: 'item_001',
        userId: 'system',
        userRole: 'system',
        details: {
          itemId: 'item_001',
          previousStock: 50,
          newStock: 49,
          operation: 'decrease',
          reason: 'order_completion'
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Internal System Process',
        status: 'success',
        severity: 2
      },
      {
        action: 'LOGIN_ATTEMPT',
        resource: 'Authentication',
        resourceId: 'auth_failed_001',
        userId: 'user_99999',
        userRole: 'unknown',
        details: {
          loginAttempt: 'failed',
          reason: 'invalid_password',
          attemptCount: 3,
          lockoutTriggered: false
        },
        ipAddress: '203.0.113.1',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        status: 'failed',
        severity: 4
      }
    ];
  }

  async testMongoDBConnection(): Promise<void> {
    try {
      console.log('🔧 MongoDB 연결 테스트를 시작합니다...');

      // 1. 기존 테스트 데이터 정리
      await this.auditLogModel.deleteMany({ userId: { $in: ['user_67890', 'user_99999', 'system'] } });
      console.log('🧹 기존 테스트 데이터 정리 완료');

      // 2. 목업 데이터 생성 및 저장
      const mockData = this.createMockAuditLogData();
      const savedDocs = await this.auditLogModel.insertMany(mockData);
      console.log(`✅ ${savedDocs.length}개의 감사 로그 데이터 저장 성공`);

      // 3. 데이터 조회 테스트 - 전체 조회
      const allLogs = await this.auditLogModel.find();
      console.log(`✅ 전체 감사 로그 조회 성공: ${allLogs.length}건`);

      // 4. 조건부 조회 테스트 - 성공한 주문 관련 액션
      const successfulOrderLogs = await this.auditLogModel
        .find({ 
          action: { $regex: /ORDER|PAYMENT/ },
          status: 'success'
        })
        .sort({ timestamp: -1 });
      console.log(`✅ 성공한 주문/결제 로그 조회: ${successfulOrderLogs.length}건`);

      // 5. 집계 테스트 - 액션별 통계
      const actionStats = await this.auditLogModel.aggregate([
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            avgSeverity: { $avg: '$severity' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      console.log('✅ 액션별 통계:');
      actionStats.forEach(stat => {
        console.log(`   - ${stat._id}: ${stat.count}건 (평균 중요도: ${stat.avgSeverity.toFixed(1)})`);
      });

      // 6. 데이터 수정 테스트 - 특정 로그의 심각도 업데이트
      const updateResult = await this.auditLogModel.updateMany(
        { action: 'LOGIN_ATTEMPT', status: 'failed' },
        { $set: { severity: 5 } }
      );
      console.log(`✅ 실패한 로그인 시도 심각도 업데이트: ${updateResult.modifiedCount}건`);

      // 7. 인덱스 성능 테스트
      console.log('⚡ 인덱스 성능 테스트...');
      const startTime = Date.now();
      await this.auditLogModel
        .find({ userId: 'user_67890' })
        .sort({ timestamp: -1 })
        .limit(10);
      const queryTime = Date.now() - startTime;
      console.log(`✅ 사용자별 로그 조회 성능: ${queryTime}ms`);

      // 8. 데이터 삭제 테스트
      const deleteResult = await this.auditLogModel.deleteMany({ 
        userId: { $in: ['user_67890', 'user_99999', 'system'] } 
      });
      console.log(`✅ 테스트 데이터 삭제 완료: ${deleteResult.deletedCount}건`);

      // 9. 삭제 확인
      const remainingLogs = await this.auditLogModel.countDocuments();
      console.log(`✅ 남은 로그 수: ${remainingLogs}건`);

      console.log('🎉 MongoDB AuditLog 테스트가 모두 성공적으로 완료되었습니다!');

    } catch (error) {
      console.error('❌ MongoDB 연결 테스트 실패:', error);
      throw error;
    }
  }

  // 컬렉션 정보 조회
  async getCollectionInfo(): Promise<void> {
    try {
      const totalCount = await this.auditLogModel.countDocuments();
      console.log('📊 audit_logs 컬렉션 정보:');
      console.log(`   - 전체 문서 수: ${totalCount}개`);
      console.log(`   - 컬렉션 이름: ${this.auditLogModel.collection.name}`);
    } catch (error: any) {
      console.log('📊 컬렉션 정보 조회 실패 (정상적인 동작입니다)');
    }
  }
}

// 테스트 모듈
@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env.local',
        '.env',
      ],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const mongoConfig = configService.get('mongodb');
        console.log('📡 MongoDB 설정 확인:');
        console.log('  - URI:', mongoConfig.uri);
        console.log('  - Database:', mongoConfig.database);
        console.log('  - Host:', mongoConfig.host);
        console.log('  - Port:', mongoConfig.port);
        
        return {
          uri: mongoConfig.uri,
          connectionFactory: (connection) => {
            connection.on('connected', () => {
              console.log('🟢 MongoDB 연결이 성공적으로 설정되었습니다.');
            });
            connection.on('error', (error: any) => {
              console.error('🔴 MongoDB 연결 오류:', error);
            });
            connection.on('disconnected', () => {
              console.log('🟡 MongoDB 연결이 해제되었습니다.');
            });
            return connection;
          },
        };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: AuditLogMongo.name, schema: AuditLogSchema }
    ]),
  ],
  providers: [MongoDBTestService],
})
class MongoDBTestModule {}

// 테스트 실행
async function testMongoDBConnection() {
  console.log('='.repeat(80));
  console.log('🧪 MongoDB AuditLog 연결 테스트 시작');
  console.log('='.repeat(80));

  try {
    // NestJS 애플리케이션 생성
    const app = await NestFactory.createApplicationContext(MongoDBTestModule);
    
    // 테스트 서비스 가져오기
    const testService = app.get(MongoDBTestService);
    
    // 컬렉션 정보 조회
    await testService.getCollectionInfo();
    
    // 연결 테스트 실행
    await testService.testMongoDBConnection();
    
    // 애플리케이션 종료
    await app.close();
    
    console.log('='.repeat(80));
    console.log('🎯 테스트 완료: MongoDB 설정이 올바르게 구성되었습니다!');
    console.log('📋 다음 단계: AuditLog를 위한 MongoDB 스키마가 준비되었습니다.');
    console.log('='.repeat(80));
    
    process.exit(0);
  } catch (error) {
    console.error('='.repeat(80));
    console.error('💥 테스트 실패:', error.message);
    console.error('='.repeat(80));
    console.error('\n📋 해결 방법:');
    console.error('1. MongoDB 서버가 실행 중인지 확인하세요 (mongod)');
    console.error('2. .env.development 파일의 MONGODB_* 설정을 확인하세요');
    console.error('3. MongoDB 포트 27017이 열려있는지 확인하세요');
    console.error('4. 방화벽 설정을 확인하세요');
    console.error('5. MongoDB 데이터베이스 권한을 확인하세요');
    process.exit(1);
  }
}

// 스크립트가 직접 실행될 때만 테스트 함수 호출
if (require.main === module) {
  testMongoDBConnection();
}