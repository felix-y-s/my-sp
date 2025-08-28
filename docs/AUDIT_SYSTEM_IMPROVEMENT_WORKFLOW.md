# Audit 시스템 개선 워크플로우

## 📋 개요

백엔드 아키텍트 분석을 기반으로 한 audit 시스템의 체계적 개선 계획입니다. 현재 common 폴더에 혼재된 audit 로직을 infrastructure 계층으로 분리하고, 성능과 확장성을 대폭 향상시키는 것이 목표입니다.

## 🎯 개선 목표

### 아키텍처 개선
- ✅ 계층 분리 완료 (Common vs Infrastructure)
- ✅ 의존성 역전 원칙 준수 (IAuditService 추상화)
- ✅ 단일 책임 원칙 적용

### 성능 향상
- 🚀 로그 처리 속도 **10배 향상** (동기 → 비동기 배치)
- ⚡ 응답 시간 **80% 단축** (비즈니스 로직 블로킹 제거)
- 💾 시스템 리소스 사용량 **30% 감소**

### 품질 향상
- 🧪 테스트 커버리지 **80% 이상**
- 📊 코드 복잡도 감소 (Cyclomatic complexity < 10)
- 🔒 TypeScript strict 모드 준수

## 📅 3단계 실행 계획

---

## 🔥 Phase 1: 즉시 개선 (1-2주)

### 목표
기존 시스템의 안정성을 유지하면서 핵심적인 문제점을 해결합니다.

### 📝 작업 항목

#### 1.1 의존성 주입 개선
```typescript
// 현재 (문자열 토큰)
@Inject('AuditService')
private auditService: IAuditService;

// ✅ 개선 (클래스 토큰)
@Inject(IAuditService)
private readonly auditService: IAuditService;
```

**구체적 작업:**
- `common/interfaces/audit.interface.ts` 수정
- `abstract class IAuditService` 정의
- 모든 서비스에서 `@Inject` 어노테이션 업데이트

#### 1.2 타입 안전성 강화
```typescript
// ✅ 개선된 인터페이스
export abstract class IAuditService {
  abstract log<T extends AuditLogData>(auditData: T): Promise<AuditLog>;
  abstract logStockChange(data: StockChangeAuditData): Promise<void>;
  abstract logUnauthorizedAccess(userId: string, action: string, resource: string): Promise<void>;
}

// ✅ 강화된 타입 정의
export interface AuditLogData {
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  severity: AuditSeverity;
  metadata?: Record<string, any>;
}
```

#### 1.3 에러 처리 개선
```typescript
// ✅ Graceful degradation 구현
export class ResilientAuditService implements IAuditService {
  async log(auditData: AuditLogData): Promise<AuditLog> {
    try {
      return await this.primaryService.log(auditData);
    } catch (error) {
      // 백업 저장소로 fallback
      this.logger.warn('Primary audit storage failed, using backup', error);
      return await this.backupService.log(auditData);
    }
  }
}
```

#### 1.4 기본 단위 테스트 추가
```bash
src/common/services/__tests__/
├── postgres-audit.service.spec.ts
├── mongo-audit.service.spec.ts
└── audit-service.integration.spec.ts
```

### ✅ 완료 기준
- [ ] 모든 `@Inject('AuditService')` → `@Inject(IAuditService)` 변경
- [ ] 타입 안전성 검증 통과 (TypeScript strict 모드)
- [ ] 에러 처리 로직 구현 및 테스트
- [ ] 기본 단위 테스트 작성 (커버리지 50% 이상)
- [ ] 기존 기능 정상 동작 확인

---

## 🏗️ Phase 2: 구조 개선 (3-4주)

### 목표
아키텍처 계층을 명확히 분리하고 Infrastructure 패턴을 적용합니다.

### 📁 새로운 디렉토리 구조
```
src/
├── common/
│   └── interfaces/
│       └── audit.interface.ts          # 순수 도메인 인터페이스
├── infrastructure/
│   └── audit/
│       ├── audit.module.ts             # 글로벌 모듈
│       ├── factories/
│       │   └── audit-service.factory.ts # 팩토리 패턴
│       ├── services/
│       │   ├── postgres-audit.service.ts
│       │   ├── mongo-audit.service.ts
│       │   └── hybrid-audit.service.ts  # 이중 저장소 관리
│       ├── entities/
│       │   └── audit-log.entity.ts
│       ├── schemas/
│       │   └── audit-log-mongo.schema.ts
│       ├── config/
│       │   └── audit.config.ts
│       └── __tests__/
│           ├── unit/
│           └── integration/
```

### 📝 작업 항목

#### 2.1 Infrastructure 모듈 생성
```bash
# 디렉토리 구조 생성
mkdir -p src/infrastructure/audit/{factories,services,entities,schemas,config,__tests__/{unit,integration}}

# 파일 이동
mv src/common/modules/audit.module.ts src/infrastructure/audit/
mv src/common/entities/audit-log.entity.ts src/infrastructure/audit/entities/
mv src/common/schemas/audit-log-mongo.schema.ts src/infrastructure/audit/schemas/
mv src/common/services/*audit*.ts src/infrastructure/audit/services/
```

#### 2.2 개선된 AuditModule 구현
```typescript
// infrastructure/audit/audit.module.ts
@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AuditLog]),
    MongooseModule.forFeature([
      { name: AuditLogMongo.name, schema: AuditLogMongoSchema }
    ]),
  ],
  providers: [
    PostgresAuditService,
    MongoAuditService,
    {
      provide: IAuditService,
      useFactory: auditServiceFactory,
      inject: [ConfigService, PostgresAuditService, MongoAuditService],
    },
    AuditHealthIndicator, // ✅ 헬스체크 추가
  ],
  exports: [IAuditService],
})
export class AuditModule {}
```

#### 2.3 팩토리 패턴 구현
```typescript
// infrastructure/audit/factories/audit-service.factory.ts
export function auditServiceFactory(
  config: ConfigService,
  postgresService: PostgresAuditService,
  mongoService: MongoAuditService,
): IAuditService {
  const strategy = config.get<string>('audit.strategy', 'hybrid');
  
  switch (strategy) {
    case 'postgresql':
      return postgresService;
    case 'mongodb':
      return mongoService;
    case 'hybrid':
    default:
      return new HybridAuditService(postgresService, mongoService, {
        primaryStorage: config.get<string>('audit.primary', 'postgresql'),
        backupEnabled: config.get<boolean>('audit.backup.enabled', true),
        syncMode: config.get<'sync'|'async'>('audit.sync.mode', 'async'),
      });
  }
}
```

#### 2.4 HybridAuditService 구현
```typescript
// infrastructure/audit/services/hybrid-audit.service.ts
@Injectable()
export class HybridAuditService implements IAuditService {
  constructor(
    private readonly postgresService: PostgresAuditService,
    private readonly mongoService: MongoAuditService,
    private readonly options: HybridAuditOptions,
  ) {}

  async log(auditData: AuditLogData): Promise<AuditLog> {
    const primary = this.getPrimaryService();
    const backup = this.getBackupService();

    try {
      const result = await primary.log(auditData);
      
      // 백업 저장소에 비동기 저장
      if (this.options.backupEnabled) {
        this.saveToBackupAsync(auditData, backup);
      }
      
      return result;
    } catch (error) {
      this.logger.error('Primary audit storage failed', error);
      return await backup.log(auditData);
    }
  }
}
```

### ✅ 완료 기준
- [ ] 새로운 디렉토리 구조 생성 및 파일 이동 완료
- [ ] AuditModule을 infrastructure로 이전
- [ ] 팩토리 패턴으로 복잡한 생성 로직 분리
- [ ] HybridAuditService로 이중 저장소 로직 캡슐화
- [ ] 모든 import 경로 업데이트
- [ ] 기존 기능 정상 동작 확인

---

## 🚀 Phase 3: 성능 최적화 (4-6주)

### 목표
비동기 처리, 배치 처리, 모니터링을 통한 대폭적인 성능 향상을 달성합니다.

### 📝 작업 항목

#### 3.1 비동기 로깅 시스템 구현
```typescript
// infrastructure/audit/services/async-audit.service.ts
@Injectable()
export class AsyncAuditService implements IAuditService {
  constructor(
    @InjectQueue('audit-queue') private auditQueue: Queue,
    private readonly syncAuditService: IAuditService,
  ) {}

  // 비동기 로깅 (즉시 반환)
  async logAsync(auditData: AuditLogData): Promise<void> {
    await this.auditQueue.add('process-audit', auditData, {
      priority: this.getPriority(auditData),
      attempts: 3,
      backoff: {
        type: 'exponential',
        settings: { delay: 2000 },
      },
    });
  }

  // 동기 로깅 (호환성)
  async log(auditData: AuditLogData): Promise<AuditLog> {
    return this.syncAuditService.log(auditData);
  }
}
```

#### 3.2 배치 처리 시스템
```typescript
// infrastructure/audit/processors/audit-batch.processor.ts
@Processor('audit-queue')
export class AuditBatchProcessor {
  private batchBuffer: AuditLogData[] = [];
  private batchTimer: NodeJS.Timeout;

  @Process('process-audit')
  async processAudit(job: Job<AuditLogData>) {
    this.batchBuffer.push(job.data);
    
    // 배치 크기 또는 시간 간격 도달 시 처리
    if (this.shouldFlushBatch()) {
      await this.flushBatch();
    }
  }

  private async flushBatch(): Promise<void> {
    const batch = [...this.batchBuffer];
    this.batchBuffer = [];

    try {
      await this.auditService.logBatch(batch);
      this.metrics.incrementSuccess(batch.length);
    } catch (error) {
      this.logger.error('Batch processing failed', error);
      // 재시도 로직
      await this.retryBatch(batch);
    }
  }
}
```

#### 3.3 스마트 라우팅 시스템
```typescript
// infrastructure/audit/services/smart-routing.service.ts
@Injectable()
export class SmartRoutingAuditService implements IAuditService {
  async log(auditData: AuditLogData): Promise<AuditLog> {
    const route = this.determineRoute(auditData);
    
    switch (route.storage) {
      case 'postgresql':
        // 중요한 감사 로그 (ACID 보장 필요)
        return this.postgresService.log(auditData);
      case 'mongodb':
        // 대용량 일반 로그 (스키마 유연성 필요)
        return this.mongoService.log(auditData);
      case 'both':
        // 최고 중요도 로그 (이중 저장)
        return this.hybridService.log(auditData);
    }
  }

  private determineRoute(auditData: AuditLogData): RoutingDecision {
    if (auditData.severity === 'CRITICAL') {
      return { storage: 'both', priority: 'high' };
    } else if (auditData.action.includes('SECURITY')) {
      return { storage: 'postgresql', priority: 'medium' };
    } else {
      return { storage: 'mongodb', priority: 'low' };
    }
  }
}
```

#### 3.4 성능 모니터링 및 메트릭
```typescript
// infrastructure/audit/monitoring/audit-metrics.service.ts
@Injectable()
export class AuditMetricsService {
  private readonly metrics = {
    logsProcessed: new Counter('audit_logs_processed_total'),
    processingTime: new Histogram('audit_processing_duration_seconds'),
    queueSize: new Gauge('audit_queue_size'),
    errorRate: new Counter('audit_errors_total'),
  };

  recordLogProcessed(storageType: string): void {
    this.metrics.logsProcessed.inc({ storage_type: storageType });
  }

  recordProcessingTime(duration: number, storageType: string): void {
    this.metrics.processingTime.observe({ storage_type: storageType }, duration);
  }

  recordQueueSize(size: number): void {
    this.metrics.queueSize.set(size);
  }
}
```

#### 3.5 헬스체크 및 관찰가능성
```typescript
// infrastructure/audit/health/audit-health.indicator.ts
@Injectable()
export class AuditHealthIndicator extends HealthIndicator {
  constructor(
    @Inject(IAuditService) private auditService: IAuditService,
    @InjectQueue('audit-queue') private auditQueue: Queue,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // 저장소 연결 확인
      await this.checkStorageConnections();
      
      // 큐 상태 확인
      const queueStats = await this.auditQueue.getJobCounts();
      
      if (queueStats.waiting > 1000) {
        throw new Error('Queue backlog too high');
      }

      return this.getStatus(key, true, {
        queue: queueStats,
        storage: 'connected',
      });
    } catch (error) {
      return this.getStatus(key, false, { error: error.message });
    }
  }
}
```

### ✅ 완료 기준
- [ ] Redis Queue 기반 비동기 처리 구현
- [ ] 배치 처리 시스템 구현 (성능 10배 향상)
- [ ] 스마트 라우팅으로 저장소별 최적화
- [ ] Prometheus 메트릭 수집 시스템
- [ ] 헬스체크 엔드포인트 구현
- [ ] Grafana 대시보드 구축
- [ ] 성능 테스트 및 검증 완료

---

## 🧪 테스트 전략

### Unit Tests (70% 커버리지 목표)
```typescript
// 각 서비스별 독립 테스트
describe('PostgresAuditService', () => {
  it('should save audit log to PostgreSQL', async () => {
    // Mock DB 연결
    // 실제 저장 로직 테스트
  });
});

describe('HybridAuditService', () => {
  it('should fallback to backup when primary fails', async () => {
    // 장애 시나리오 테스트
  });
});
```

### Integration Tests (80% 커버리지 목표)
```typescript
// TestContainer 활용한 실제 DB 테스트
describe('Audit System Integration', () => {
  beforeAll(async () => {
    await startTestContainers(); // PostgreSQL + MongoDB + Redis
  });

  it('should handle high-load batch processing', async () => {
    // 1000건 동시 로그 처리 테스트
  });
});
```

### Performance Tests
```typescript
describe('Audit Performance', () => {
  it('should process 1000 logs/second', async () => {
    // 처리량 성능 테스트
  });

  it('should have <100ms response time', async () => {
    // 응답 시간 테스트
  });
});
```

---

## 📊 모니터링 및 알림

### Grafana 대시보드 구성
- **처리량**: 초당 로그 처리 수
- **응답시간**: 저장소별 평균 응답 시간
- **에러율**: 저장 실패율 및 재시도 횟수
- **큐 상태**: 백로그 크기 및 처리 지연시간
- **저장소 상태**: PostgreSQL/MongoDB 연결 상태

### 알림 규칙
```yaml
alerts:
  - name: high_error_rate
    condition: error_rate > 5%
    duration: 5m
    severity: warning
    
  - name: queue_backlog
    condition: queue_size > 1000
    duration: 2m
    severity: critical
    
  - name: storage_down
    condition: storage_health == 0
    duration: 30s
    severity: critical
```

---

## 🔄 마이그레이션 및 롤백 전략

### 마이그레이션 계획
1. **Feature Flag 활용**: 새로운 시스템을 점진적 활성화
2. **Parallel Running**: 기존 시스템과 병렬 실행으로 검증
3. **Data Validation**: 로그 데이터 일관성 검증
4. **Gradual Rollout**: 트래픽의 10% → 50% → 100% 순차 전환

### 롤백 시나리오
```typescript
// 각 단계별 롤백 계획
const rollbackPlan = {
  phase1: {
    trigger: 'TypeScript 컴파일 오류',
    action: 'git revert 및 의존성 원복',
    duration: '15분'
  },
  phase2: {
    trigger: '모듈 로딩 실패',
    action: '파일 경로 원복 및 모듈 재등록',
    duration: '30분'
  },
  phase3: {
    trigger: '성능 저하 또는 데이터 손실',
    action: 'Feature flag OFF 및 기존 시스템 복구',
    duration: '10분'
  }
};
```

---

## 📈 성공 측정 지표

### Phase 1 완료 기준
- ✅ TypeScript strict 모드 통과
- ✅ 기존 기능 100% 호환성
- ✅ 단위 테스트 50% 커버리지
- ✅ 에러 처리 개선 완료

### Phase 2 완료 기준
- ✅ 아키텍처 계층 분리 완료
- ✅ 코드 복잡도 50% 감소
- ✅ 의존성 역전 원칙 적용
- ✅ 통합 테스트 70% 커버리지

### Phase 3 완료 기준
- 🚀 **성능 10배 향상** (1000 logs/second 처리)
- ⚡ **응답시간 80% 단축** (<100ms)
- 📊 **모니터링 대시보드** 구축
- 🔧 **자동화된 알림 시스템** 구축

---

## 👥 팀 역할 및 책임

### 백엔드 개발자
- 핵심 로직 구현 및 리팩토링
- 성능 최적화 및 테스트 작성
- 코드 리뷰 및 품질 관리

### DevOps 엔지니어
- 모니터링 시스템 구축
- 알림 및 대시보드 설정
- 배포 및 롤백 자동화

### QA 엔지니어
- 테스트 시나리오 작성
- 성능 테스트 수행
- 품질 검증 및 승인

### 아키텍트
- 전체 설계 검토 및 승인
- 아키텍처 가이드라인 제공
- 기술적 의사결정 지원

---

## 🗓️ 상세 일정

### Week 1-2: Phase 1 실행
- **Day 1-3**: 의존성 주입 개선
- **Day 4-7**: 타입 안전성 및 에러 처리
- **Day 8-10**: 단위 테스트 작성
- **Day 11-14**: 통합 테스트 및 검증

### Week 3-6: Phase 2 실행
- **Week 3**: Infrastructure 구조 생성
- **Week 4**: 모듈 이전 및 팩토리 패턴
- **Week 5**: HybridAuditService 구현
- **Week 6**: 통합 테스트 및 성능 검증

### Week 7-10: Phase 3 실행
- **Week 7**: 비동기 처리 시스템
- **Week 8**: 배치 처리 및 스마트 라우팅
- **Week 9**: 모니터링 및 메트릭 시스템
- **Week 10**: 성능 테스트 및 최적화

---

이 워크플로우를 통해 audit 시스템을 **엔터프라이즈급 수준으로 개선**하고, **10배 성능 향상**과 **80% 이상 테스트 커버리지**를 달성할 수 있습니다. 각 단계별로 품질 게이트를 통과하여 안전하고 체계적인 개선이 이루어집니다.