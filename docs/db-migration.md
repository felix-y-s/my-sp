# SQLite to PostgreSQL Migration Guide

이 가이드는 Purchase Saga 프로젝트를 SQLite에서 PostgreSQL로 마이그레이션하는 방법을 설명합니다.

## 마이그레이션 개요

### 주요 변경사항
- **Enum 타입 복원**: SQLite의 제약으로 varchar로 저장되었던 enum 값들을 PostgreSQL 네이티브 enum으로 변경
- **Timestamp 최적화**: datetime에서 timestamptz(타임존 지원)로 변경
- **환경 변수 기반 설정**: 데이터베이스 타입을 환경 변수로 제어

### 복원되는 Enum 타입
1. `order_status_enum`: 주문 상태 (PENDING, PROCESSING, CONFIRMED, COMPLETED, FAILED, CANCELLED)
2. `discount_type_enum`: 할인 타입 (PERCENTAGE, FIXED_AMOUNT)
3. `applicable_type_enum`: 쿠폰 적용 범위 (ALL, CATEGORY, ITEM)
4. `validity_type_enum`: 유효기간 타입 (RELATIVE, ABSOLUTE)
5. `user_coupon_status_enum`: 사용자 쿠폰 상태 (ACTIVE, USED, EXPIRED)
6. `audit_status_enum`: 감사 로그 상태 (success, failed, blocked)
7. `reservation_status_enum`: 예약 상태 (RESERVED, CONFIRMED, CANCELLED, EXPIRED)

## 마이그레이션 실행

### 1. PostgreSQL 설치 및 데이터베이스 생성

### 2. 환경 설정 파일 준비
```bash
# PostgreSQL 환경 설정 생성
cp .env.postgresql.example .env.development

# 설정 파일 편집 (데이터베이스 접속 정보 입력)
nano .env.development
```

### 3. 마이그레이션 실행
```bash
# 의존성 확인
npm install

# TypeORM 빌드
npm run build

# 마이그레이션 실행
npm run typeorm:run-migrations
```

## 완료된 마이그레이션 작업

✅ **Phase 1: 분석 완료**
- SQLite 데이터베이스 구조 분석
- Enum 필드 및 Timestamp 필드 파악

✅ **Phase 2: 환경 설정 완료**
- PostgreSQL 드라이버 설치 (pg, @types/pg)
- DatabaseModule 환경 변수 기반으로 리팩토링
- 동적 데이터베이스 타입 지원 (SQLite ↔ PostgreSQL)

✅ **Phase 3: Entity 업데이트 완료**
- 모든 Entity에서 Enum 타입을 조건부로 설정
- Timestamp 필드를 timestamptz로 최적화
- 환경 변수 기반 데이터 타입 동적 적용

✅ **Phase 4: 마이그레이션 스크립트 생성**
- PostgreSQL Enum 타입 생성 마이그레이션
- SQLite → PostgreSQL 데이터 마이그레이션 스크립트
- 자동 데이터 변환 및 검증 로직
