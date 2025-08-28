# API 문서

이 문서는 my-sp NestJS 애플리케이션의 API 엔드포인트를 설명합니다.

## 목차

- [인증 및 권한](#인증-및-권한)
- [기본 API](#기본-api)
- [아이템 API](#아이템-api)
- [주문 API](#주문-api)
- [에러 응답](#에러-응답)

## 인증 및 권한

이 애플리케이션은 역할 기반 접근 제어(RBAC)를 사용합니다.

### 역할 종류
- `ADMIN`: 전체 시스템 관리자
- `INVENTORY_MANAGER`: 재고 관리자

### 보호된 엔드포인트
보호된 엔드포인트는 `@Roles` 데코레이터로 표시되며, 적절한 권한이 필요합니다.

## 기본 API

### GET /
애플리케이션 헬스 체크

**응답**
```
Hello World!
```

### POST /setup-test-data
테스트 데이터를 초기화합니다.

**응답**
```json
{
  "success": true,
  "message": "테스트 데이터가 성공적으로 생성되었습니다.",
  "data": {
    "user": {
      "id": "uuid",
      "username": "testuser",
      "balance": 50000
    },
    "items": [
      {
        "id": "uuid",
        "name": "마법검",
        "price": 10000,
        "stock": 50
      },
      {
        "id": "uuid", 
        "name": "방패",
        "price": 5000,
        "stock": 30
      },
      {
        "id": "uuid",
        "name": "회복물약", 
        "price": 1000,
        "stock": 100
      }
    ]
  }
}
```

### GET /user/{id}/balance
사용자의 잔고를 조회합니다.

**파라미터**
- `id` (string): 사용자 ID

**응답**
```json
{
  "userId": "user-id",
  "balance": 50000
}
```

### GET /user/{id}/inventory
사용자의 인벤토리를 조회합니다.

**파라미터**
- `id` (string): 사용자 ID

**응답**
```json
{
  "userId": "user-id",
  "inventory": [...]
}
```

### GET /items
모든 아이템 목록을 조회합니다.

**응답**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "아이템 이름",
      "price": 1000,
      "stock": 50
    }
  ]
}
```

### GET /user/{id}/orders
사용자별 주문 목록을 조회합니다.

**파라미터**
- `id` (string): 사용자 ID

**응답**
```json
{
  "userId": "user-id",
  "orders": [...]
}
```

## 아이템 API

베이스 경로: `/items`

### GET /items
모든 아이템 조회 (공개 API)

**응답**
```json
[
  {
    "id": "uuid",
    "name": "아이템 이름",
    "price": 1000,
    "stock": 50,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### GET /items/{id}
특정 아이템 조회 (공개 API)

**파라미터**
- `id` (string): 아이템 ID

**응답**
```json
{
  "id": "uuid",
  "name": "아이템 이름",
  "price": 1000,
  "stock": 50,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /items/{id}/stock
아이템 재고 조회 (공개 API)

**파라미터**
- `id` (string): 아이템 ID

**응답**
```json
{
  "stock": 50
}
```

### POST /items/{id}/stock
아이템 재고 직접 업데이트 (관리자 전용)

**권한 필요**: `ADMIN`, `INVENTORY_MANAGER`

**파라미터**
- `id` (string): 아이템 ID

**요청 본문**
```json
{
  "newStock": 100,
  "reason": "재고 보충"
}
```

**응답**
```json
{
  "message": "아이템 uuid의 재고가 100개로 업데이트되었습니다."
}
```

### POST /items
아이템 생성 (관리자 전용)

**권한 필요**: `ADMIN`, `INVENTORY_MANAGER`

**요청 본문**
```json
{
  "name": "새 아이템",
  "price": 1500,
  "stock": 100
}
```

**응답**
```json
{
  "id": "uuid",
  "name": "새 아이템",
  "price": 1500,
  "stock": 100,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /items/reservations/stats
예약 현황 조회 (관리자 전용)

**권한 필요**: `ADMIN`, `INVENTORY_MANAGER`

**응답**
```json
{
  "total": 100,
  "active": 25,
  "confirmed": 50,
  "cancelled": 15,
  "expired": 10
}
```

### GET /items/reservations/order/{orderId}
특정 주문의 예약 정보 조회 (관리자 전용)

**권한 필요**: `ADMIN`, `INVENTORY_MANAGER`

**파라미터**
- `orderId` (string): 주문 ID

**응답**
```json
[
  {
    "id": "uuid",
    "orderId": "order-uuid",
    "itemId": "item-uuid", 
    "quantity": 2,
    "status": "ACTIVE",
    "expiresAt": "2024-01-01T01:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### GET /items/{id}/reservations
특정 아이템의 활성 예약 조회 (관리자 전용)

**권한 필요**: `ADMIN`, `INVENTORY_MANAGER`

**파라미터**
- `id` (string): 아이템 ID

**응답**
```json
[
  {
    "id": "uuid",
    "orderId": "order-uuid",
    "itemId": "item-uuid",
    "quantity": 1,
    "status": "ACTIVE",
    "expiresAt": "2024-01-01T01:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### POST /items/reservations/{id}/status
예약 상태 수동 업데이트 (관리자 전용)

**권한 필요**: `ADMIN`, `INVENTORY_MANAGER`

**파라미터**
- `id` (string): 예약 ID

**요청 본문**
```json
{
  "status": "CONFIRMED",
  "reason": "수동 승인"
}
```

**응답**
```json
{
  "message": "예약 uuid의 상태가 CONFIRMED로 업데이트되었습니다."
}
```

## 주문 API

베이스 경로: `/orders`

### POST /orders
주문 생성 - Saga 시작점

**요청 본문**
```json
{
  "userId": "user-uuid",
  "items": [
    {
      "itemId": "item-uuid",
      "quantity": 2
    }
  ],
  "couponCode": "DISCOUNT10"
}
```

**응답**
```json
{
  "id": "order-uuid",
  "userId": "user-uuid",
  "status": "PENDING",
  "totalAmount": 20000,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /orders/{id}
주문 단건 조회

**파라미터**
- `id` (string): 주문 ID

**응답**
```json
{
  "id": "order-uuid",
  "userId": "user-uuid",
  "status": "COMPLETED",
  "totalAmount": 20000,
  "items": [...],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /orders/user/{userId}
사용자별 주문 목록 조회

**파라미터**
- `userId` (string): 사용자 ID

**응답**
```json
[
  {
    "id": "order-uuid",
    "userId": "user-uuid",
    "status": "COMPLETED",
    "totalAmount": 20000,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

## 에러 응답

모든 에러는 다음과 같은 형식으로 반환됩니다:

### 400 Bad Request
```json
{
  "success": false,
  "message": "잘못된 요청입니다.",
  "error": "상세 에러 메시지"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Not Found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "내부 서버 오류가 발생했습니다.",
  "error": "상세 에러 메시지"
}
```

## 상태 코드

- `200 OK`: 성공적인 GET 요청
- `201 Created`: 성공적인 POST 요청 (생성)
- `400 Bad Request`: 잘못된 요청 데이터
- `401 Unauthorized`: 인증 필요
- `403 Forbidden`: 권한 없음
- `404 Not Found`: 리소스를 찾을 수 없음
- `500 Internal Server Error`: 서버 내부 오류

## 참고 사항

- 모든 날짜는 ISO 8601 형식으로 반환됩니다
- UUID는 v4 형식을 사용합니다
- 페이지네이션이 필요한 경우 추후 추가될 예정입니다
- API 버전 관리는 현재 v1입니다