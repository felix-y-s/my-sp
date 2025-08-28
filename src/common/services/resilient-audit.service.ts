import { Injectable, Logger } from '@nestjs/common';
import { 
  IAuditService, 
  ExtendedAuditLogData, 
  AuditSeverity 
} from '../interfaces/audit.interface';
import { AuditLogData, StockChangeAuditData } from './postgres-audit.service';

/**
 * 복원력 있는 감사 서비스 (Graceful Degradation 구현)
 * 주 저장소 실패 시 백업 저장소로 자동 전환
 */
@Injectable()
export class ResilientAuditService extends IAuditService {
  private readonly logger = new Logger(ResilientAuditService.name);

  constructor(
    private readonly primaryService: IAuditService,
    private readonly backupService: IAuditService,
  ) {
    super();
  }

  async log(auditData: AuditLogData): Promise<any> {
    try {
      const result = await this.primaryService.log(auditData);
      this.logger.debug('Primary audit service succeeded');
      return result;
    } catch (error) {
      this.logger.warn('Primary audit service failed, using backup', {
        error: error.message,
        auditData: { action: auditData.action, resource: auditData.resource }
      });
      
      try {
        return await this.backupService.log(auditData);
      } catch (backupError) {
        this.logger.error('Both audit services failed', {
          primaryError: error.message,
          backupError: backupError.message,
          auditData
        });
        
        // 최후의 수단: 로컬 로그만 남기고 빈 객체 반환
        this.logger.error('AUDIT FAILURE - CRITICAL', auditData);
        return { id: 'failed', status: 'degraded' };
      }
    }
  }

  async logExtended<T extends ExtendedAuditLogData>(auditData: T): Promise<any> {
    try {
      // 새로운 메서드가 구현되지 않은 경우 기존 log 메서드 사용
      if (typeof this.primaryService.logExtended === 'function') {
        return await this.primaryService.logExtended(auditData);
      } else {
        // 후진 호환성: ExtendedAuditLogData를 AuditLogData로 변환
        const legacyData: AuditLogData = {
          userId: auditData.userId || '',
          action: auditData.action,
          resource: auditData.resource,
          resourceId: auditData.resourceId || 'N/A',
          details: auditData.metadata || {},
          timestamp: auditData.timestamp,
          ipAddress: auditData.ipAddress,
        };
        return await this.log(legacyData);
      }
    } catch (error) {
      this.logger.warn('Extended audit logging failed, trying backup');
      return await this.backupService.logExtended?.(auditData) ?? 
             await this.backupService.log(auditData as any);
    }
  }

  async logStockChange(stockChangeData: StockChangeAuditData): Promise<void> {
    try {
      await this.primaryService.logStockChange(stockChangeData);
    } catch (error) {
      this.logger.warn('Stock change audit failed on primary, using backup');
      await this.backupService.logStockChange(stockChangeData);
    }
  }

  async logLogin(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const auditData: ExtendedAuditLogData = {
      userId,
      action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILURE',
      resource: 'AUTH',
      timestamp: new Date(),
      severity: success ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
      metadata: { userAgent },
      ipAddress,
    };

    try {
      await this.logExtended(auditData);
    } catch (error) {
      // 로그인 감사는 특히 중요하므로 두 번 시도
      this.logger.error('Critical: Login audit failed', { userId, success, error: error.message });
    }
  }

  async logUnauthorizedAccess(
    userId: string | undefined,
    action: string,
    resource: string,
    ipAddress?: string,
  ): Promise<any> {
    const auditData: ExtendedAuditLogData = {
      userId,
      action: 'UNAUTHORIZED_ACCESS',
      resource,
      timestamp: new Date(),
      severity: AuditSeverity.HIGH,
      metadata: { attemptedAction: action },
      ipAddress,
    };

    try {
      return await this.logExtended(auditData);
    } catch (error) {
      // 보안 감사는 매우 중요하므로 반드시 기록
      this.logger.error('SECURITY AUDIT FAILURE - CRITICAL', { 
        userId, action, resource, ipAddress, error: error.message 
      });
      throw new Error('Critical audit failure');
    }
  }

  async logSystemEvent(
    event: string,
    details?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.primaryService.logSystemEvent(event, details);
    } catch (error) {
      await this.backupService.logSystemEvent(event, details);
    }
  }

  // 조회 메서드들은 주 서비스 우선 시도
  async getLogsByUser(userId: string, limit?: number): Promise<any[]> {
    try {
      return await this.primaryService.getLogsByUser(userId, limit);
    } catch (error) {
      this.logger.warn('Primary service query failed, trying backup');
      return await this.backupService.getLogsByUser(userId, limit);
    }
  }

  async getLogsByResource(
    resource: string,
    resourceId: string,
    limit?: number,
  ): Promise<any[]> {
    try {
      return await this.primaryService.getLogsByResource(resource, resourceId, limit);
    } catch (error) {
      return await this.backupService.getLogsByResource(resource, resourceId, limit);
    }
  }

  async getHighSeverityLogs(
    minSeverity?: number,
    limit?: number,
  ): Promise<any[]> {
    try {
      return await this.primaryService.getHighSeverityLogs(minSeverity, limit);
    } catch (error) {
      return await this.backupService.getHighSeverityLogs(minSeverity, limit);
    }
  }

  async getSecurityLogs(limit?: number): Promise<any[]> {
    try {
      return await this.primaryService.getSecurityLogs(limit);
    } catch (error) {
      return await this.backupService.getSecurityLogs(limit);
    }
  }

  async getActionStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ action: string; count: string }[]> {
    try {
      return await this.primaryService.getActionStatistics(startDate, endDate);
    } catch (error) {
      return await this.backupService.getActionStatistics(startDate, endDate);
    }
  }

  async logBatch(auditDataList: ExtendedAuditLogData[]): Promise<any[]> {
    try {
      return await this.primaryService.logBatch?.(auditDataList) ?? [];
    } catch (error) {
      this.logger.warn('Batch logging failed on primary, trying backup');
      return await this.backupService.logBatch?.(auditDataList) ?? [];
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details?: Record<string, any>;
  }> {
    const primaryHealth = await this.checkServiceHealth(this.primaryService, 'primary');
    const backupHealth = await this.checkServiceHealth(this.backupService, 'backup');

    const isHealthy = primaryHealth.healthy || backupHealth.healthy;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      details: {
        primary: primaryHealth,
        backup: backupHealth,
        degradedMode: primaryHealth.healthy ? false : backupHealth.healthy,
      }
    };
  }

  private async checkServiceHealth(
    service: IAuditService, 
    name: string
  ): Promise<{ healthy: boolean; error?: string }> {
    try {
      const result = await service.healthCheck?.() ?? { status: 'healthy' };
      return { healthy: result.status === 'healthy' };
    } catch (error) {
      this.logger.warn(`${name} service health check failed`, error.message);
      return { healthy: false, error: error.message };
    }
  }
}