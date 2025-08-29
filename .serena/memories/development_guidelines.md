# 개발 가이드라인 및 패턴

## NestJS 아키텍처 패턴

### 1. 모듈 구조 패턴
```typescript
@Module({
  imports: [/* 의존 모듈 */],
  controllers: [/* 컨트롤러 */],
  providers: [/* 서비스, 저장소 */],
  exports: [/* 외부 노출 서비스 */],
})
export class ExampleModule {}
```

### 2. 컨트롤러 패턴
```typescript
@Controller('api/v1/example')
export class ExampleController {
  constructor(private readonly exampleService: ExampleService) {}

  @Get()
  async findAll(): Promise<ExampleDto[]> {
    return this.exampleService.findAll();
  }
}
```

### 3. 서비스 패턴
```typescript
@Injectable()
export class ExampleService {
  constructor(
    private readonly exampleRepository: ExampleRepository,
    private readonly eventBus: EventBusService,
  ) {}
}
```

## 프로젝트 특화 패턴

### 1. Saga Choreography 패턴
- **이벤트 기반**: 각 서비스가 이벤트를 발행하고 구독
- **보상 트랜잭션**: 실패 시 롤백 이벤트 처리
- **상태 관리**: 분산 트랜잭션 상태 추적

### 2. 이중 저장소 패턴
- **PostgreSQL**: 메인 비즈니스 데이터
- **MongoDB**: 감사 로그 및 이벤트 저장
- **동기화**: 두 저장소 간 데이터 일관성 보장

### 3. 이벤트 드리븐 아키텍처
```typescript
// 이벤트 발행
await this.eventBus.publish('order.created', orderData);

// 이벤트 구독
@EventHandler('order.created')
async handleOrderCreated(event: OrderCreatedEvent) {
  // 처리 로직
}
```

## 코드 품질 가이드라인

### 1. 타입 안전성
- `any` 타입 사용 최소화 (현재 허용되지만 지양)
- 인터페이스 정의로 타입 명시
- DTO 클래스 사용으로 런타임 검증

### 2. 에러 핸들링
- HTTP 예외 적절히 사용 (`@nestjs/common`)
- 비즈니스 로직 예외 처리
- 로깅 시스템 활용

### 3. 테스트 작성 규칙
- **단위 테스트**: `*.spec.ts` 파일명
- **E2E 테스트**: `test/` 디렉토리, `*.e2e-spec.ts`
- **모킹**: 의존성 주입을 활용한 테스트 격리

## 성능 최적화 패턴

### 1. 배치 처리
- 대량 데이터 처리 시 배치 단위로 분할
- 현재 시스템: 318% 성능 향상 달성

### 2. 캐싱 전략
- Redis 활용한 메모리 캐싱
- 데이터베이스 쿼리 최적화

### 3. 비동기 처리
- 이벤트 기반 비동기 처리
- Promise 체이닝보다 async/await 선호

## 보안 가이드라인

### 1. 인증/인가
- Guard 패턴 사용
- JWT 토큰 기반 인증
- 역할 기반 접근 제어 (RBAC)

### 2. 데이터 검증
- class-validator로 입력 데이터 검증
- DTO 변환으로 데이터 정제
- SQL 인젝션 방지 (TypeORM 사용)

## 환경 설정 가이드라인

### 1. 환경 변수 관리
- `.env.development`, `.env.production` 분리
- ConfigService 활용한 타입 안전 설정 접근
- 환경 변수 검증 로직 구현

### 2. 데이터베이스 연결
- 개발/프로덕션 환경별 설정 분리
- 연결 풀링 설정 최적화
- 마이그레이션 관리 체계