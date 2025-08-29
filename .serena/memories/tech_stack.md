# 기술 스택

## 백엔드 프레임워크
- **NestJS v11**: 메인 프레임워크 (TypeScript)
- **TypeScript**: 언어 (ES2023 타겟)
- **Node.js**: 런타임

## 데이터베이스
- **PostgreSQL**: 메인 데이터베이스
- **MongoDB**: 감사 로그 및 이중화
- **TypeORM**: PostgreSQL ORM
- **Mongoose**: MongoDB ODM

## 캐싱 및 메시징
- **Redis**: 캐싱 및 이벤트 버스
- **ioredis**: Redis 클라이언트

## 검증 및 변환
- **class-validator**: 입력 데이터 검증
- **class-transformer**: 데이터 변환

## API 문서화
- **Swagger**: API 문서 자동 생성 (@nestjs/swagger)

## 개발 도구
- **ESLint**: 코드 품질 검사 (TypeScript ESLint)
- **Prettier**: 코드 포맷팅
- **Jest**: 테스트 프레임워크
- **ts-jest**: TypeScript Jest 변환기
- **Supertest**: E2E 테스트

## 아키텍처 패턴
- **Saga Choreography Pattern**: 분산 트랜잭션 관리
- **Event-Driven Architecture**: 비동기 이벤트 기반
- **Domain-Driven Design**: 도메인 중심 설계
- **Dependency Injection**: NestJS 의존성 주입