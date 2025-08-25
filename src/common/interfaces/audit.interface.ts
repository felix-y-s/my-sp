import { AuditLogData, StockChangeAuditData } from '../services/postgres-audit.service';

/**
 * 감사 로그 서비스 인터페이스
 * PostgreSQL 기반과 MongoDB 기반 AuditService의 공통 인터페이스
 */
export interface IAuditService {
  /**
   * 일반 감사 로그 기록
   */
  log(auditData: AuditLogData): Promise<any>;

  /**
   * 재고 변경 감사 로그 기록
   */
  logStockChange(stockChangeData: StockChangeAuditData): Promise<void>;

  /**
   * 로그인 감사 로그 기록
   */
  logLogin(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void>;

  /**
   * 권한 없는 접근 시도 기록
   */
  logUnauthorizedAccess(
    userId: string | undefined,
    action: string,
    resource: string,
    ipAddress?: string,
  ): Promise<any>;

  /**
   * 시스템 이벤트 감사 로그 기록
   */
  logSystemEvent(
    event: string,
    details?: Record<string, any>,
  ): Promise<void>;

  /**
   * 특정 사용자의 감사 로그 조회
   */
  getLogsByUser(userId: string, limit?: number): Promise<any[]>;

  /**
   * 특정 리소스의 감사 로그 조회
   */
  getLogsByResource(
    resource: string,
    resourceId: string,
    limit?: number,
  ): Promise<any[]>;

  /**
   * 높은 심각도 이벤트 조회
   */
  getHighSeverityLogs(
    minSeverity?: number,
    limit?: number,
  ): Promise<any[]>;

  /**
   * 보안 관련 로그 조회 (권한 없는 접근, 로그인 실패 등)
   */
  getSecurityLogs(limit?: number): Promise<any[]>;

  /**
   * 통계: 액션별 카운트
   */
  getActionStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ action: string; count: string }[]>;
}