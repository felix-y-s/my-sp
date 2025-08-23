import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface AuditLogData {
  action: string;
  resource: string;
  resourceId: string;
  userId?: string;
  userRole?: string;
  details?: Record<string, any>;
  timestamp?: Date;
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failed' | 'blocked';
  severity?: number;
}

export interface StockChangeAuditData {
  itemId: string;
  oldStock: number;
  newStock: number;
  changedBy: string;
  reason: string;
  timestamp: Date;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 일반 감사 로그 기록
   */
  async log(auditData: AuditLogData): Promise<AuditLog> {
    try {
      const logEntry = this.auditLogRepository.create({
        ...auditData,
        timestamp: auditData.timestamp || new Date(),
        status: auditData.status || 'success',
        severity: auditData.severity || 3,
      });

      // 데이터베이스에 저장
      const savedLog = await this.auditLogRepository.save(logEntry);

      // 추가적으로 로그파일에도 기록 (중요한 이벤트의 경우)
      if (auditData.severity && auditData.severity >= 4) {
        this.logger.warn(`[HIGH PRIORITY] 감사 로그: ${JSON.stringify(auditData)}`);
      } else {
        this.logger.log(`감사 로그: ${auditData.action} | ${auditData.resource}:${auditData.resourceId} | 사용자: ${auditData.userId || 'unknown'}`);
      }

      return savedLog;
    } catch (error) {
      // DB 저장 실패 시에도 최소한 로그는 남김
      this.logger.error(`감사 로그 저장 실패: ${error.message}`, error.stack);
      this.logger.log(`[FALLBACK] 감사 로그: ${JSON.stringify(auditData)}`);
      throw error;
    }
  }

  /**
   * 재고 변경 감사 로그 기록
   */
  async logStockChange(stockChangeData: StockChangeAuditData): Promise<void> {
    const auditData: AuditLogData = {
      action: 'STOCK_UPDATE',
      resource: 'Item',
      resourceId: stockChangeData.itemId,
      userId: stockChangeData.changedBy,
      details: {
        oldStock: stockChangeData.oldStock,
        newStock: stockChangeData.newStock,
        difference: stockChangeData.newStock - stockChangeData.oldStock,
        reason: stockChangeData.reason,
      },
      timestamp: stockChangeData.timestamp,
    };

    await this.log(auditData);
  }

  /**
   * 로그인 감사 로그 기록
   */
  async logLogin(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const auditData: AuditLogData = {
      action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      resource: 'User',
      resourceId: userId,
      userId: userId,
      ipAddress,
      userAgent,
    };

    await this.log(auditData);
  }

  /**
   * 권한 없는 접근 시도 기록
   */
  async logUnauthorizedAccess(
    userId: string | undefined,
    action: string,
    resource: string,
    ipAddress?: string,
  ): Promise<AuditLog> {
    const auditData: AuditLogData = {
      action: 'UNAUTHORIZED_ACCESS',
      resource,
      resourceId: 'N/A',
      userId,
      details: {
        attemptedAction: action,
        blocked: true,
      },
      ipAddress,
      status: 'blocked',
      severity: 5, // 최고 심각도
    };

    const savedLog = await this.log(auditData);

    // 보안 경고 로그
    this.logger.warn(
      `🚨 권한 없는 접근 시도: 사용자 ${userId || 'unknown'} | 액션: ${action} | 리소스: ${resource} | IP: ${ipAddress || 'unknown'}`,
    );

    return savedLog;
  }

  /**
   * 시스템 이벤트 감사 로그 기록
   */
  async logSystemEvent(
    event: string,
    details?: Record<string, any>,
  ): Promise<void> {
    const auditData: AuditLogData = {
      action: 'SYSTEM_EVENT',
      resource: 'System',
      resourceId: 'system',
      details: {
        event,
        ...details,
      },
    };

    await this.log(auditData);
  }

  /**
   * 특정 사용자의 감사 로그 조회
   */
  async getLogsByUser(
    userId: string, 
    limit: number = 50
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * 특정 리소스의 감사 로그 조회
   */
  async getLogsByResource(
    resource: string, 
    resourceId: string, 
    limit: number = 50
  ): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { resource, resourceId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * 높은 심각도 이벤트 조회
   */
  async getHighSeverityLogs(
    minSeverity: number = 4,
    limit: number = 100
  ): Promise<AuditLog[]> {
    return this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.severity >= :minSeverity', { minSeverity })
      .orderBy('audit.timestamp', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * 보안 관련 로그 조회 (권한 없는 접근, 로그인 실패 등)
   */
  async getSecurityLogs(limit: number = 100): Promise<AuditLog[]> {
    return this.auditLogRepository
      .createQueryBuilder('audit')
      .where(
        'audit.action IN (:...actions) OR audit.status = :status',
        {
          actions: ['UNAUTHORIZED_ACCESS', 'LOGIN_FAILED'],
          status: 'blocked'
        }
      )
      .orderBy('audit.timestamp', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * 통계: 액션별 카운트
   */
  async getActionStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{ action: string; count: string }[]> {
    let query = this.auditLogRepository
      .createQueryBuilder('audit')
      .select('audit.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('audit.action');

    if (startDate) {
      query = query.andWhere('audit.timestamp >= :startDate', { startDate });
    }
    if (endDate) {
      query = query.andWhere('audit.timestamp <= :endDate', { endDate });
    }

    return query.getRawMany();
  }
}
