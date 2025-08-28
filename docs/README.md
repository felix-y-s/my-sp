# 📚 NestJS 구매 시스템 문서 인덱스

> **Saga Choreography 패턴**을 활용한 분산 트랜잭션 기반 이커머스 시스템

## 🏗️ 프로젝트 개요

이 프로젝트는 NestJS 기반의 구매 시스템으로, **Saga Choreography 패턴**을 통해 분산 트랜잭션을 관리하는 학습 및 실무용 프로젝트입니다. Phase 1부터 Phase 3까지 단계적으로 발전하여 현재는 **엔터프라이즈급 운영 시스템** 수준에 도달했습니다.

### 🎯 핵심 특징
- **Saga Choreography**: 중앙 오케스트레이터 없는 이벤트 드리븐 분산 트랜잭션
- **이중 저장소**: PostgreSQL + MongoDB 복원력 보장
- **배치 처리**: 318% 성능 향상 달성
- **이벤트 드리븐**: Redis 기반 비동기 메시지 처리
- **모듈러 아키텍처**: 확장 가능한 도메인 기반 설계

---

## 📖 문서 카탈로그

### 🏠 **시작하기**

| 문서 | 설명 | 상태 | 대상 독자 |
|-----|-----|------|----------|
| **[ENV_SETUP.md](ENV_SETUP.md)** | 개발 환경 구축 가이드 | 🟢 완료 | 모든 개발자 |
| **[SAGA_README.md](SAGA_README.md)** | 전체 아키텍처 및 Saga 패턴 | 🟢 완료 | 개발자, 아키텍트 |
| **[purchase-flow.md](purchase-flow.md)** | 구매 시스템 플로우 시각화 | 🟢 완료 | 시스템 아키텍트 |

### 🔧 **API 및 개발 가이드**

| 문서 | 설명 | 상태 | 대상 독자 |
|-----|-----|------|----------|
| **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** | 전체 API 엔드포인트 레퍼런스 | 🟡 90% | 프론트엔드, QA |
| **[coupon-implementation-workflow.md](coupon-implementation-workflow.md)** | 쿠폰 시스템 이벤트 드리븐 통합 | 🟡 70% | 백엔드 개발자 |
| **[ITEM_TODO_IMPLEMENTATION_PLAN.md](ITEM_TODO_IMPLEMENTATION_PLAN.md)** | ItemService 미완성 기능 계획서 | 🟡 75% | 백엔드 개발자 |

### 🏗️ **인프라 및 아키텍처**

| 문서 | 설명 | 상태 | 대상 독자 |
|-----|-----|------|----------|
| **[db-migration.md](db-migration.md)** | SQLite → PostgreSQL 마이그레이션 | 🟢 완료 | DevOps, 백엔드 |
| **[AUDIT_SYSTEM_IMPROVEMENT_WORKFLOW.md](AUDIT_SYSTEM_IMPROVEMENT_WORKFLOW.md)** | Audit 시스템 Phase 1-3 완료 | ✅ 완료 | 시스템 아키텍트 |
| **[AUDIT_SERVICE_MONGODB_TRANSITION.md](AUDIT_SERVICE_MONGODB_TRANSITION.md)** | MongoDB 하이브리드 전환 완료 | ✅ 완료 | 백엔드 개발자 |

---

## 🚀 빠른 시작

### 1. 환경 설정
```bash
# 문서를 먼저 확인하세요
📖 ENV_SETUP.md → 개발 환경 구축
📖 SAGA_README.md → 전체 시스템 이해
```

### 2. 시스템 이해
```bash
# 아키텍처 이해를 위한 권장 읽기 순서
1️⃣ SAGA_README.md        # 전체 패턴과 아키텍처
2️⃣ purchase-flow.md      # 구매 플로우 시각화
3️⃣ API_DOCUMENTATION.md  # API 사용 방법
```

### 3. 개발 참여
```bash
# 개발에 기여하려면
📋 coupon-implementation-workflow.md  # Phase 4 쿠폰 API 구현
📋 ITEM_TODO_IMPLEMENTATION_PLAN.md   # ItemService 완성
```

---

## 📊 프로젝트 진행 상황

### ✅ **완료된 Phase**

#### **Phase 1**: 기본 Saga 패턴 구현
- 기본적인 주문 → 결제 → 인벤토리 플로우
- 이벤트 기반 상태 관리
- **완료일**: 2024년 11월

#### **Phase 2**: 인프라스트럭처 개선
- Infrastructure 레이어 분리
- PostgreSQL 마이그레이션
- Audit 시스템 아키텍처 개선
- **완료일**: 2025년 1월

#### **Phase 3**: 성능 최적화 및 고급 기능 ✨
- **배치 처리 시스템**: 318% 성능 향상 달성
- **실시간 모니터링 API**: 상태 추적 시스템
- **자동 정리 시스템**: 데이터 라이프사이클 관리
- **MongoDB 하이브리드 저장소**: 완전한 이중화
- **완료일**: 2025년 1월 26일

### 🔄 **진행 중인 Phase**

#### **Phase 4**: 쿠폰 시스템 API 구현 (70% 완료)
- 이벤트 드리븐 쿠폰 검증 완료
- REST API 구현 진행 중
- 관리자 도구 개발 예정

#### **Phase 5**: ItemService 완성 (75% 계획)
- 예약 정보 관리 시스템
- 완전한 보상 트랜잭션
- 보안 강화된 관리자 API

---

## 🔍 문서 품질 현황

### 📈 **완성도 분포**
- **🟢 완료 (90-100%)**: 4개 문서
- **🟡 대부분 완료 (70-90%)**: 5개 문서
- **🔵 진행 중 (50-70%)**: 0개 문서

### 🔗 **문서 간 연결성**
- **핵심 허브**: SAGA_README.md, API_DOCUMENTATION.md
- **기술 문서**: Audit 시스템 관련 완성된 문서들
- **실용 가이드**: ENV_SETUP.md, purchase-flow.md

---

## 🎯 다음 단계 로드맵

### 즉시 우선순위 (1-2주)
- [ ] 쿠폰 API 엔드포인트 완성 및 API 문서 업데이트
- [ ] ItemService TODO 항목 구현 시작

### 중기 우선순위 (1개월)
- [ ] 모니터링 및 관측성 가이드 문서
- [ ] 운영 환경 배포 가이드
- [ ] 성능 최적화 결과 검증 문서

### 장기 목표 (분기별)
- [ ] 프로덕션 운영 가이드
- [ ] 확장 아키텍처 가이드
- [ ] 마이크로서비스 분해 계획

---

## 👥 기여하기

### 문서 개선
1. **오타 및 내용 수정**: 직접 PR 생성
2. **새로운 섹션 제안**: Issue로 먼저 논의
3. **번역 기여**: 다국어 지원 환영

### 코드 기여
1. **쿠폰 시스템 API**: Phase 4 구현 참여
2. **ItemService 완성**: Phase 5 구현 참여
3. **테스트 케이스 추가**: 품질 향상 기여

---

## 📞 연락처 및 지원

- **기술 문의**: 코드 리뷰 및 아키텍처 질문
- **문서 개선**: 문서 품질 및 번역 관련
- **버그 리포트**: 시스템 오류 및 개선 제안

---

## 📄 라이선스 및 크레딧

이 프로젝트는 학습 목적으로 개발된 오픈소스 프로젝트입니다.

**주요 기술 스택**:
- NestJS, TypeScript, TypeORM
- PostgreSQL, MongoDB, Redis
- Docker, Jest, Swagger

**아키텍처 패턴**:
- Saga Choreography Pattern
- Event-Driven Architecture
- Domain-Driven Design

---

*📅 마지막 업데이트: 2025년 1월 28일*
*🎉 Phase 3 완료 기념으로 문서 체계 정비 완료*