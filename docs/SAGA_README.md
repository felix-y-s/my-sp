# 🏛️ Saga Choreography 패턴 아이템 구매 시스템

NestJS와 TypeScript로 구현한 **Saga Choreography 패턴** 기반 아이템 구매 시스템입니다.

## 📋 프로젝트 개요

이 프로젝트는 **학습용**으로, 분산 시스템에서 트랜잭션 일관성을 보장하는 Saga Choreography 패턴을 실제로 구현해본 예제입니다.

### 🎯 핵심 특징

- ✅ **Saga Choreography 패턴** - 중앙 오케스트레이터 없는 이벤트 기반 분산 트랜잭션
- ✅ **이벤트 기반 아키텍처** - Redis Pub/Sub를 활용한 비동기 이벤트 처리  
- ✅ **보상 트랜잭션** - 실패 시 자동 롤백 체인 구현
- ✅ **동시성 제어** - 분산 락을 통한 race condition 방지
- ✅ **간결한 구현** - 학습에 집중할 수 있도록 핵심 로직만 구현

## 🏗️ 시스템 아키텍처

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Order       │    │ User        │    │ Inventory   │
│ Service     │───▶│ Service     │───▶│ Service     │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Item        │◀───│ Payment     │◀───│ Notification│
│ Service     │    │ Service     │    │ Service     │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
                  ┌─────────────┐
                  │   Redis     │
                  │ Event Bus   │
                  └─────────────┘
```

## 🔄 Saga 흐름

### 성공 시나리오 (Happy Path)
1. **Order Service**: 주문 생성 → `OrderCreated` 이벤트 발행
2. **User Service**: 사용자/잔고 검증 → `PaymentReserved` 이벤트 발행  
3. **Inventory Service**: 인벤토리 공간 예약 → `InventoryReserved` 이벤트 발행
4. **Item Service**: 아이템 재고 예약 → `ItemReserved` 이벤트 발행
5. **Payment Service**: 결제 처리 → `PaymentProcessed` 이벤트 발행
6. **Order Service**: 주문 완료 → `OrderCompleted` 이벤트 발행
7. **Notification Service**: 구매 완료 알림

### 실패 시나리오 (보상 트랜잭션)
실패 지점에 따른 자동 롤백 체인이 실행됩니다:

- **User Service 실패** → Order 취소
- **Inventory Service 실패** → User 잔고 롤백 + Order 취소  
- **Item Service 실패** → Inventory 해제 + User 잔고 롤백 + Order 취소
- **Payment Service 실패** → 전체 롤백 체인 실행

## 🛠️ 기술 스택

- **Backend**: NestJS + TypeScript
- **Database**: SQLite + TypeORM (간단한 로컬 개발용)
- **Event Bus**: Redis (Pub/Sub)
- **Caching**: Redis (상태 관리, 분산 락)

## 🚀 실행 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. Redis 실행 (Docker 사용)
```bash
# Redis 컨테이너 실행
docker run -d -p 6379:6379 --name redis redis:alpine

# 또는 로컬 Redis 설치 후 실행
redis-server
```

### 3. 애플리케이션 실행
```bash
# 개발 모드
npm run start:dev

# 프로덕션 빌드
npm run build
npm run start:prod
```

### 4. Saga 패턴 테스트
```bash
# 전체 Saga 플로우 테스트
npm run test:saga
```

## 🧪 API 테스트

### 테스트 데이터 생성
```bash
curl -X POST http://localhost:3000/setup-test-data
```

### 아이템 구매 (Saga 시작)
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "{사용자ID}",
    "itemId": "{아이템ID}", 
    "quantity": 1
  }'
```

### 상태 조회
```bash
# 사용자 잔고 확인
curl http://localhost:3000/user/{사용자ID}/balance

# 사용자 인벤토리 확인  
curl http://localhost:3000/user/{사용자ID}/inventory

# 주문 내역 확인
curl http://localhost:3000/user/{사용자ID}/orders
```

## 📝 구현 세부사항

### 이벤트 타입
```typescript
enum EventType {
  ORDER_CREATED = 'order.created',
  USER_VALIDATED = 'user.validated', 
  INVENTORY_RESERVED = 'inventory.reserved',
  ITEM_RESERVED = 'item.reserved',
  PAYMENT_PROCESSED = 'payment.processed',
  ORDER_COMPLETED = 'order.completed',
  // ... 실패 및 롤백 이벤트들
}
```

### 핵심 서비스별 역할
- **OrderService**: Saga 시작점, 주문 상태 관리
- **UserService**: 사용자 검증, 잔고 예약/복원  
- **InventoryService**: 인벤토리 공간 관리
- **ItemService**: 아이템 재고 관리
- **PaymentService**: 결제 처리 (모의 구현)
- **NotificationService**: 알림 (로그 출력)

### 보상 트랜잭션 예제
```typescript
// User Service - 잔고 롤백
private async rollbackBalance(eventData: any, reason: string) {
  const reservation = await this.eventBus.getReservation(reservationKey);
  user.balance = reservation.originalBalance; // 원래 잔고로 복원
  await this.userRepository.save(user);
  await this.eventBus.publish(EventType.PAYMENT_ROLLBACK, rollbackEvent);
}
```

## 🎓 학습 포인트

### 1. Saga Choreography vs Orchestrator
- **Choreography**: 각 서비스가 독립적으로 이벤트 발행/구독 (본 프로젝트)
- **Orchestrator**: 중앙 조정자가 전체 플로우 관리

### 2. 이벤트 기반 아키텍처
- 서비스 간 느슨한 결합
- 확장성과 복원력 향상
- 비동기 처리로 성능 개선

### 3. 분산 시스템 과제들
- **일관성**: 모든 서비스의 데이터가 동기화되어야 함
- **동시성**: 여러 요청이 동시에 처리될 때 충돌 방지  
- **복원력**: 일부 서비스 장애 시에도 시스템 전체 안정성 유지

### 4. 보상 트랜잭션 설계
- 각 단계별 롤백 로직 구현
- 멱등성(Idempotency) 보장
- 순환 의존성 방지

## ⚠️ 현재 구현의 한계 (학습용)

- **실제 PG 연동 없음**: 결제는 모의 처리 (10% 확률 실패)
- **트랜잭션 타임아웃**: 무한 대기 방지 로직 미구현
- **Dead Letter Queue**: 실패 이벤트 재처리 로직 미구현  
- **감사 로그**: 상세한 추적 로그 시스템 미구현
- **복잡한 재고 관리**: 예약/할당/확정 단계 간소화

## 🔧 실제 환경 적용 시 고려사항

1. **데이터베이스**: PostgreSQL/MySQL + 연결 풀링
2. **메시지 브로커**: Apache Kafka, RabbitMQ 등  
3. **모니터링**: 분산 추적 (Jaeger, Zipkin)
4. **보안**: 인증/인가, API 게이트웨이
5. **테스트**: 통합 테스트, 카오스 엔지니어링
6. **운영**: 헬스 체크, 메트릭스, 알럿

## 📚 참고 자료

- [Saga Pattern - Microservices.io](https://microservices.io/patterns/data/saga.html)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [NestJS Documentation](https://docs.nestjs.com/)

---

💡 **이 프로젝트는 Saga Choreography 패턴의 핵심 개념을 이해하기 위한 학습용 구현입니다.**