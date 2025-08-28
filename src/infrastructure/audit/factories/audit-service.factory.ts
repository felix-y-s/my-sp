import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

import { IAuditService } from '../../../common/interfaces/audit.interface';
import { PostgresAuditService } from '../services/postgres-audit.service';
import { MongoAuditService } from '../services/mongo-audit.service';
import { ResilientAuditService } from '../services/resilient-audit.service';

/**
 * 감사 서비스 팩토리
 * 환경 설정에 따라 적절한 감사 서비스 구현체를 생성합니다.
 */
export class AuditServiceFactory {
  private static readonly logger = new Logger(AuditServiceFactory.name);

  /**
   * 환경 설정에 따라 감사 서비스를 생성합니다
   * 
   * @param configService 환경 설정 서비스
   * @param mongoService MongoDB 감사 서비스
   * @param postgresService PostgreSQL 감사 서비스  
   * @param resilientService 복원력 있는 감사 서비스
   * @returns 선택된 감사 서비스 구현체
   */
  static create(
    configService: ConfigService,
    mongoService: MongoAuditService,
    postgresService: PostgresAuditService,
  ): IAuditService {
    
    const auditStorageType = configService.get<string>('AUDIT_STORAGE_TYPE', 'dual');
    const environment = configService.get<string>('NODE_ENV', 'development');

    AuditServiceFactory.logger.log(`감사 서비스 초기화: ${auditStorageType} (환경: ${environment})`);

    switch (auditStorageType) {
      case 'postgresql':
        AuditServiceFactory.logger.log('PostgreSQL 전용 감사 서비스 활성화');
        return postgresService;
        
      case 'mongodb':
        AuditServiceFactory.logger.log('MongoDB 전용 감사 서비스 활성화');
        return mongoService;
        
      case 'dual':
      case 'hybrid':
        AuditServiceFactory.logger.log('이중 저장소 감사 서비스 활성화');
        // ResilientAuditService에 primary/backup 서비스 주입
        return new ResilientAuditService(postgresService, mongoService);
        
      default:
        AuditServiceFactory.logger.warn(
          `알 수 없는 감사 저장소 타입: ${auditStorageType}, PostgreSQL로 기본 설정`
        );
        return postgresService;
    }
  }

  /**
   * 환경별 권장 설정을 반환합니다
   */
  static getRecommendedConfig(environment: string): string {
    switch (environment) {
      case 'production':
        return 'dual'; // 운영: 이중 저장소로 안정성 확보
        
      case 'staging':
        return 'dual'; // 스테이징: 운영과 동일한 구성
        
      case 'test':
        return 'postgresql'; // 테스트: 빠른 단일 저장소
        
      case 'development':
      default:
        return 'postgresql'; // 개발: 빠른 단일 저장소
    }
  }
}