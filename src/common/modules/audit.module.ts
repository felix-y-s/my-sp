import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoAuditService } from '../services/mongo-audit.service';
import { PostgresAuditService } from '../services/postgres-audit.service';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditLogMongo, AuditLogMongoSchema } from '../schemas/audit-log-mongo.schema';
import { IAuditService } from '../interfaces/audit.interface';

@Global()
@Module({
  imports: [
    ConfigModule,
    // PostgreSQL AuditLog을 위한 TypeORM 모듈
    TypeOrmModule.forFeature([AuditLog]),
    // MongoDB AuditLog을 위한 Mongoose 모듈
    MongooseModule.forFeature([
      { name: AuditLogMongo.name, schema: AuditLogMongoSchema }
    ]),
  ],
  providers: [
    // MongoDB 기반 MongoAuditService
    MongoAuditService,
    // PostgreSQL 기반 PostgresAuditService
    PostgresAuditService,
    // 조건부 서비스 제공자 (환경 설정에 따라 MongoDB 또는 PostgreSQL 서비스 제공)
    {
      provide: 'AuditService', // 문자열 토큰 사용
      useFactory: (
        configService: ConfigService,
        mongoAuditService: MongoAuditService,
        postgresAuditService: PostgresAuditService,
      ): IAuditService => {
        const storageType = configService.get<string>('audit.storageType');
        
        if (storageType === 'mongodb') {
          console.log('🍃 MongoDB AuditService 활성화');
          return mongoAuditService;
        } else {
          console.log('🐘 PostgreSQL AuditService 활성화');
          return postgresAuditService;
        }
      },
      inject: [ConfigService, MongoAuditService, PostgresAuditService],
    },
  ],
  exports: [
    'AuditService', // 기존 코드 호환성 (조건부로 MongoDB 또는 PostgreSQL 서비스 제공)
    MongoAuditService, // MongoDB 직접 사용이 필요한 경우
    PostgresAuditService, // PostgreSQL 직접 사용이 필요한 경우
  ],
})
export class AuditModule {}
