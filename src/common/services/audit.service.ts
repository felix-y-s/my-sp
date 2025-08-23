import { Injectable, Logger } from '@nestjs/common';

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

  /**
   * 일반 감사 로그 기록
   */
  async log(auditData: AuditLogData): Promise<void> {
    const logEntry = {
      ...auditData,
      timestamp: auditData.timestamp || new Date(),
    };

    // 실제 환경에서는 별도 DB 테이블이나 로그 시스템에 저장
    this.logger.log(`감사 로그: ${JSON.stringify(logEntry)}`);

    // TODO: 실제 환경에서는 audit_logs 테이블에 저장
    // await this.auditRepository.save(logEntry);
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
  ): Promise<void> {
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
    };

    await this.log(auditData);

    // 보안 경고 로그
    this.logger.warn(
      `권한 없는 접근 시도: 사용자 ${userId || 'unknown'} | 액션: ${action} | 리소스: ${resource} | IP: ${ipAddress || 'unknown'}`,
    );
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
}
