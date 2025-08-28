import { registerAs } from '@nestjs/config';

/**
 * 감사 시스템 설정
 * 
 * 환경변수를 통해 감사 시스템의 동작을 제어할 수 있습니다:
 * - AUDIT_STORAGE_TYPE: 'postgresql' | 'mongodb' | 'dual'
 * - AUDIT_BATCH_SIZE: 배치 처리 크기 (기본: 100)
 * - AUDIT_RETENTION_DAYS: 로그 보존 기간 (기본: 365일)
 * - AUDIT_HIGH_SEVERITY_THRESHOLD: 높은 심각도 임계값 (기본: 4)
 */
export default registerAs('audit', () => ({
  /**
   * 저장소 타입
   * - postgresql: PostgreSQL 단독 사용
   * - mongodb: MongoDB 단독 사용  
   * - dual: 이중 저장소 (PostgreSQL primary, MongoDB backup)
   */
  storageType: process.env.AUDIT_STORAGE_TYPE || 'dual',
  
  /**
   * 배치 처리 설정
   */
  batch: {
    // 한 번에 처리할 로그 수
    size: parseInt(process.env.AUDIT_BATCH_SIZE || '100', 10),
    
    // 배치 처리 간격 (밀리초)
    intervalMs: parseInt(process.env.AUDIT_BATCH_INTERVAL_MS || '5000', 10),
  },
  
  /**
   * 데이터 보존 정책
   */
  retention: {
    // 로그 보존 기간 (일)
    days: parseInt(process.env.AUDIT_RETENTION_DAYS || '365', 10),
    
    // 높은 심각도 로그 보존 기간 (일) - 일반 로그보다 길게
    highSeverityDays: parseInt(process.env.AUDIT_HIGH_SEVERITY_RETENTION_DAYS || '1095', 10), // 3년
    
    // 자동 정리 활성화 여부
    autoCleanup: process.env.AUDIT_AUTO_CLEANUP === 'true',
  },
  
  /**
   * 심각도 관리
   */
  severity: {
    // 높은 심각도로 분류할 임계값
    highThreshold: parseInt(process.env.AUDIT_HIGH_SEVERITY_THRESHOLD || '4', 10),
    
    // 중요한 로그를 추가 로거로 기록할 심각도 임계값
    logThreshold: parseInt(process.env.AUDIT_LOG_THRESHOLD || '4', 10),
  },
  
  /**
   * 성능 최적화 설정
   */
  performance: {
    // 비동기 로깅 활성화
    asyncLogging: process.env.AUDIT_ASYNC_LOGGING !== 'false',
    
    // 연결 풀 크기
    connectionPoolSize: parseInt(process.env.AUDIT_CONNECTION_POOL_SIZE || '10', 10),
    
    // 쿼리 타임아웃 (밀리초)
    queryTimeoutMs: parseInt(process.env.AUDIT_QUERY_TIMEOUT_MS || '5000', 10),
  },
  
  /**
   * 보안 설정
   */
  security: {
    // 민감한 데이터 마스킹 활성화
    enableDataMasking: process.env.AUDIT_ENABLE_DATA_MASKING === 'true',
    
    // 마스킹할 필드 목록
    maskFields: (process.env.AUDIT_MASK_FIELDS || 'password,token,secret,key').split(','),
    
    // 감사 로그 자체에 대한 접근 제한
    restrictedAccess: process.env.AUDIT_RESTRICTED_ACCESS === 'true',
  },
  
  /**
   * 모니터링 및 알림
   */
  monitoring: {
    // 헬스체크 간격 (밀리초)
    healthCheckIntervalMs: parseInt(process.env.AUDIT_HEALTH_CHECK_INTERVAL_MS || '30000', 10),
    
    // 실패율이 이 값을 초과하면 알림
    failureRateThreshold: parseFloat(process.env.AUDIT_FAILURE_RATE_THRESHOLD || '0.05'), // 5%
    
    // 메트릭 수집 활성화
    enableMetrics: process.env.AUDIT_ENABLE_METRICS !== 'false',
  },
  
  /**
   * 개발 및 디버깅
   */
  development: {
    // 상세한 로깅 활성화 (개발/디버깅용)
    verboseLogging: process.env.NODE_ENV === 'development' || process.env.AUDIT_VERBOSE_LOGGING === 'true',
    
    // 테스트 모드 (테스트 데이터 자동 정리)
    testMode: process.env.NODE_ENV === 'test',
  }
}));