import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

// 엔티티 및 스키마
import { AuditLog } from './entities/audit-log.entity';
import { AuditLogMongo, AuditLogMongoSchema } from './schemas/audit-log-mongo.schema';

// 서비스 및 인터페이스
import { IAuditService } from '../../common/interfaces/audit.interface';
import { PostgresAuditService } from './services/postgres-audit.service';
import { MongoAuditService } from './services/mongo-audit.service';


// 팩토리
import { AuditServiceFactory } from './factories/audit-service.factory';

/**
 * 감사(Audit) 인프라스트럭처 모듈
 * 
 * PostgreSQL과 MongoDB 기반의 이중 감사 로그 시스템을 제공합니다.
 * 운영 환경에서는 복원력 있는 이중 저장소 방식을 사용하고,
 * 개발 환경에서는 설정에 따라 단일 저장소를 사용할 수 있습니다.
 */
@Global()
@Module({
  imports: [
    // PostgreSQL 엔티티 등록
    TypeOrmModule.forFeature([AuditLog]),
    
    // MongoDB 스키마 등록
    MongooseModule.forFeature([
      { name: AuditLogMongo.name, schema: AuditLogMongoSchema }
    ]),
    
    ConfigModule
  ],
  providers: [
    // 구체적인 구현체들
    PostgresAuditService,
    MongoAuditService,
    
    // 팩토리를 통한 동적 서비스 생성
    {
      provide: IAuditService,
      useFactory: AuditServiceFactory.create,
      inject: [ConfigService, MongoAuditService, PostgresAuditService],
    },
    
    // 하위 호환성을 위한 문자열 토큰 별칭
    {
      provide: 'AuditService',
      useExisting: IAuditService,
    },
  ],
  exports: [
    IAuditService,
    'AuditService', // 하위 호환성
    PostgresAuditService,
    MongoAuditService,
  ],
})
export class AuditModule {}