import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectModel } from '@nestjs/mongoose';
import { Repository, LessThan } from 'typeorm';
import { Model } from 'mongoose';

import { AuditLog } from '../entities/audit-log.entity';
import { AuditLogMongo, AuditLogMongoDocument } from '../schemas/audit-log-mongo.schema';

/**
 * 감사 로그 자동 정리 서비스
 * 
 * 데이터 보존 정책에 따라 오래된 감사 로그를 자동으로 정리합니다.
 * PostgreSQL과 MongoDB 모두에서 작동하며, 설정 가능한 보존 기간을 지원합니다.
 */
@Injectable()
export class AuditCleanupService {
  private readonly logger = new Logger(AuditCleanupService.name);

  // 보존 정책 설정
  private readonly retentionDays: number;
  private readonly highSeverityRetentionDays: number;
  private readonly autoCleanupEnabled: boolean;
  private readonly batchSize: number = 1000; // 한 번에 삭제할 레코드 수

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectModel(AuditLogMongo.name)
    private readonly auditLogModel: Model<AuditLogMongoDocument>,
    private readonly configService: ConfigService,
  ) {
    this.retentionDays = this.configService.get<number>('audit.retention.days', 365);
    this.highSeverityRetentionDays = this.configService.get<number>('audit.retention.highSeverityDays', 1095);
    this.autoCleanupEnabled = this.configService.get<boolean>('audit.retention.autoCleanup', false);

    this.logger.log(`감사 로그 정리 서비스 초기화:`);
    this.logger.log(`- 일반 로그 보존기간: ${this.retentionDays}일`);
    this.logger.log(`- 높은 심각도 로그 보존기간: ${this.highSeverityRetentionDays}일`);
    this.logger.log(`- 자동 정리 활성화: ${this.autoCleanupEnabled}`);
  }

  /**
   * 매일 새벽 2시에 자동 정리 실행
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledCleanup(): Promise<void> {
    if (!this.autoCleanupEnabled) {
      this.logger.debug('자동 정리가 비활성화되어 있어 건너뜀');
      return;
    }

    this.logger.log('예약된 감사 로그 자동 정리 시작');
    
    try {
      const result = await this.performCleanup();
      this.logger.log('예약된 자동 정리 완료', result);
    } catch (error) {
      this.logger.error('예약된 자동 정리 실패', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 수동 정리 실행 (API나 관리자 요청)
   */
  async manualCleanup(): Promise<{
    success: boolean;
    postgres?: any;
    mongodb?: any;
    summary: any;
    error?: string;
  }> {
    this.logger.log('수동 감사 로그 정리 요청 시작');
    
    try {
      const result = await this.performCleanup();
      return {
        success: true,
        ...result
      };
    } catch (error) {
      this.logger.error('수동 정리 실패', {
        error: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message,
        summary: { totalCleaned: 0, processingTimeMs: 0 }
      };
    }
  }

  /**
   * 실제 정리 작업 수행
   */
  private async performCleanup(): Promise<{
    postgres: any;
    mongodb: any;
    summary: any;
  }> {
    const startTime = Date.now();
    
    // 정리 기준 날짜 계산
    const generalCutoffDate = new Date();
    generalCutoffDate.setDate(generalCutoffDate.getDate() - this.retentionDays);
    
    const highSeverityCutoffDate = new Date();
    highSeverityCutoffDate.setDate(highSeverityCutoffDate.getDate() - this.highSeverityRetentionDays);

    this.logger.log(`정리 기준 날짜:`);
    this.logger.log(`- 일반 로그 (심각도 < 4): ${generalCutoffDate.toISOString()} 이전`);
    this.logger.log(`- 높은 심각도 로그 (심각도 >= 4): ${highSeverityCutoffDate.toISOString()} 이전`);

    // PostgreSQL과 MongoDB 병렬 정리
    const [postgresResult, mongoResult] = await Promise.allSettled([
      this.cleanupPostgreSQL(generalCutoffDate, highSeverityCutoffDate),
      this.cleanupMongoDB(generalCutoffDate, highSeverityCutoffDate)
    ]);

    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;

    // 결과 정리
    const postgres = postgresResult.status === 'fulfilled' 
      ? postgresResult.value 
      : { error: postgresResult.reason.message, cleaned: 0 };
      
    const mongodb = mongoResult.status === 'fulfilled'
      ? mongoResult.value
      : { error: mongoResult.reason.message, cleaned: 0 };

    const totalCleaned = (postgres.cleaned || 0) + (mongodb.cleaned || 0);

    const summary = {
      totalCleaned,
      processingTimeMs,
      generalCutoffDate: generalCutoffDate.toISOString(),
      highSeverityCutoffDate: highSeverityCutoffDate.toISOString(),
      completedAt: new Date().toISOString()
    };

    this.logger.log('정리 작업 완료', summary);

    return { postgres, mongodb, summary };
  }

  /**
   * PostgreSQL 감사 로그 정리
   */
  private async cleanupPostgreSQL(
    generalCutoffDate: Date,
    highSeverityCutoffDate: Date
  ): Promise<{ cleaned: number; details: any }> {
    this.logger.log('PostgreSQL 감사 로그 정리 시작');
    
    let totalCleaned = 0;
    const details = { 
      generalSeverity: 0, 
      highSeverity: 0,
      batches: 0
    };

    try {
      // 1. 일반 심각도 로그 정리 (severity < 4)
      let hasMoreGeneral = true;
      while (hasMoreGeneral) {
        const result = await this.auditLogRepository.delete({
          timestamp: LessThan(generalCutoffDate),
          severity: LessThan(4) // 심각도 4 미만
        });

        const affected = result.affected || 0;
        details.generalSeverity += affected;
        totalCleaned += affected;
        details.batches++;

        if (affected < this.batchSize) {
          hasMoreGeneral = false;
        }

        // 배치 간 잠깐 대기 (데이터베이스 부하 방지)
        if (hasMoreGeneral) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // 2. 높은 심각도 로그 정리 (severity >= 4)
      let hasMoreHigh = true;
      while (hasMoreHigh) {
        // TypeORM의 DeleteQueryBuilder는 limit을 지원하지 않으므로
        // 서브쿼리를 사용하여 배치 단위로 삭제
        const idsToDelete = await this.auditLogRepository
          .createQueryBuilder('log')
          .select('log.id')
          .where('log.timestamp < :cutoff AND (log.severity >= 4 OR log.severity IS NULL)', {
            cutoff: highSeverityCutoffDate
          })
          .limit(this.batchSize)
          .getMany();

        if (idsToDelete.length === 0) {
          hasMoreHigh = false;
          break;
        }

        const result = await this.auditLogRepository
          .delete(idsToDelete.map(log => log.id));

        const affected = result.affected || 0;
        details.highSeverity += affected;
        totalCleaned += affected;
        details.batches++;

        if (affected < this.batchSize) {
          hasMoreHigh = false;
        }

        if (hasMoreHigh) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      this.logger.log(`PostgreSQL 정리 완료: ${totalCleaned}개 레코드`, details);
      
      return { cleaned: totalCleaned, details };

    } catch (error) {
      this.logger.error('PostgreSQL 정리 중 오류 발생', {
        error: error.message,
        cleanedSoFar: totalCleaned
      });
      throw error;
    }
  }

  /**
   * MongoDB 감사 로그 정리
   */
  private async cleanupMongoDB(
    generalCutoffDate: Date,
    highSeverityCutoffDate: Date
  ): Promise<{ cleaned: number; details: any }> {
    this.logger.log('MongoDB 감사 로그 정리 시작');
    
    let totalCleaned = 0;
    const details = { 
      generalSeverity: 0, 
      highSeverity: 0,
      batches: 0
    };

    try {
      // 1. 일반 심각도 로그 정리 (severity < 4)
      const generalResult = await this.auditLogModel.deleteMany({
        createdAt: { $lt: generalCutoffDate },
        severity: { $lt: 4 }
      });

      details.generalSeverity = generalResult.deletedCount || 0;
      totalCleaned += details.generalSeverity;
      details.batches++;

      // 2. 높은 심각도 로그 정리 (severity >= 4)
      const highSeverityResult = await this.auditLogModel.deleteMany({
        createdAt: { $lt: highSeverityCutoffDate },
        $or: [
          { severity: { $gte: 4 } },
          { severity: { $exists: false } }
        ]
      });

      details.highSeverity = highSeverityResult.deletedCount || 0;
      totalCleaned += details.highSeverity;
      details.batches++;

      this.logger.log(`MongoDB 정리 완료: ${totalCleaned}개 도큐먼트`, details);
      
      return { cleaned: totalCleaned, details };

    } catch (error) {
      this.logger.error('MongoDB 정리 중 오류 발생', {
        error: error.message,
        cleanedSoFar: totalCleaned
      });
      throw error;
    }
  }

  /**
   * 정리 예상 통계 (실제 삭제하지 않고 개수만 조회)
   */
  async getCleanupEstimate(): Promise<{
    postgres: { general: number; highSeverity: number };
    mongodb: { general: number; highSeverity: number };
    summary: any;
  }> {
    const generalCutoffDate = new Date();
    generalCutoffDate.setDate(generalCutoffDate.getDate() - this.retentionDays);
    
    const highSeverityCutoffDate = new Date();
    highSeverityCutoffDate.setDate(highSeverityCutoffDate.getDate() - this.highSeverityRetentionDays);

    try {
      const [postgresGeneral, postgresHigh, mongoGeneral, mongoHigh] = await Promise.all([
        // PostgreSQL 일반 심각도
        this.auditLogRepository.count({
          where: {
            timestamp: LessThan(generalCutoffDate),
            severity: LessThan(4)
          }
        }),
        
        // PostgreSQL 높은 심각도  
        this.auditLogRepository
          .createQueryBuilder()
          .where('timestamp < :cutoff AND (severity >= 4 OR severity IS NULL)', {
            cutoff: highSeverityCutoffDate
          })
          .getCount(),

        // MongoDB 일반 심각도
        this.auditLogModel.countDocuments({
          createdAt: { $lt: generalCutoffDate },
          severity: { $lt: 4 }
        }),

        // MongoDB 높은 심각도
        this.auditLogModel.countDocuments({
          createdAt: { $lt: highSeverityCutoffDate },
          $or: [
            { severity: { $gte: 4 } },
            { severity: { $exists: false } }
          ]
        })
      ]);

      const postgres = { 
        general: postgresGeneral, 
        highSeverity: postgresHigh 
      };
      
      const mongodb = { 
        general: mongoGeneral, 
        highSeverity: mongoHigh 
      };

      const summary = {
        totalToClean: postgresGeneral + postgresHigh + mongoGeneral + mongoHigh,
        generalCutoffDate: generalCutoffDate.toISOString(),
        highSeverityCutoffDate: highSeverityCutoffDate.toISOString(),
        estimatedAt: new Date().toISOString()
      };

      return { postgres, mongodb, summary };

    } catch (error) {
      this.logger.error('정리 예상 통계 조회 실패', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 보존 정책 설정 조회
   */
  getRetentionPolicy(): {
    retentionDays: number;
    highSeverityRetentionDays: number;
    autoCleanupEnabled: boolean;
    batchSize: number;
  } {
    return {
      retentionDays: this.retentionDays,
      highSeverityRetentionDays: this.highSeverityRetentionDays,
      autoCleanupEnabled: this.autoCleanupEnabled,
      batchSize: this.batchSize
    };
  }
}