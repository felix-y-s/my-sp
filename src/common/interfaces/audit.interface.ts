import { AuditLogData, StockChangeAuditData } from '../services/postgres-audit.service';

/**
 * Audit 심각도 레벨 정의
 */
export enum AuditSeverity {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * 확장된 감사 로그 데이터 인터페이스
 */
export interface ExtendedAuditLogData {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: Date;
  severity: AuditSeverity;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 감사 로그 서비스 추상 클래스
 * PostgreSQL 기반과 MongoDB 기반 AuditService의 공통 인터페이스
 * abstract class로 정의하여 의존성 주입 토큰으로 사용
 */
export abstract class IAuditService {
  /**
   * 일반 감사 로그 기록
   */
  abstract log(auditData: AuditLogData): Promise<any>;

  /**
   * 확장된 감사 로그 기록 (새로운 타입 안전한 메서드)
   */
  abstract logExtended<T extends ExtendedAuditLogData>(auditData: T): Promise<any>;

  /**
   * 재고 변경 감사 로그 기록
   */
  abstract logStockChange(stockChangeData: StockChangeAuditData): Promise<void>;

  /**
   * 로그인 감사 로그 기록
   */
  abstract logLogin(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void>;

  /**
   * 권한 없는 접근 시도 기록
   */
  abstract logUnauthorizedAccess(
    userId: string | undefined,
    action: string,
    resource: string,
    ipAddress?: string,
  ): Promise<any>;

  /**
   * 시스템 이벤트 감사 로그 기록
   */
  abstract logSystemEvent(
    event: string,
    details?: Record<string, any>,
  ): Promise<void>;

  /**
   * 특정 사용자의 감사 로그 조회
   */
  abstract getLogsByUser(userId: string, limit?: number): Promise<any[]>;

  /**
   * 특정 리소스의 감사 로그 조회
   */
  abstract getLogsByResource(
    resource: string,
    resourceId: string,
    limit?: number,
  ): Promise<any[]>;

  /**
   * 높은 심각도 이벤트 조회
   */
  abstract getHighSeverityLogs(
    minSeverity?: number,
    limit?: number,
  ): Promise<any[]>;

  /**
   * 보안 관련 로그 조회 (권한 없는 접근, 로그인 실패 등)
   */
  abstract getSecurityLogs(limit?: number): Promise<any[]>;

  /**
   * 통계: 액션별 카운트
   */
  abstract getActionStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ action: string; count: string }[]>;

  /**
   * 배치 로그 처리 (성능 향상을 위한 새 메서드)
   */
  abstract logBatch(auditDataList: ExtendedAuditLogData[]): Promise<any[]>;

  /**
   * 헬스체크 메서드 (시스템 상태 확인)
   */
  abstract healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details?: Record<string, any>;
  }>;
}