# 코드베이스 구조

## 루트 디렉토리
```
/
├── src/                   # 소스 코드
├── test/                  # E2E 테스트
├── docs/                  # 프로젝트 문서
├── dist/                  # 빌드 출력 (자동 생성)
├── coverage/              # 테스트 커버리지 (자동 생성)
├── package.json           # 의존성 및 스크립트
├── tsconfig.json          # TypeScript 설정
├── eslint.config.mjs      # ESLint 설정
├── .prettierrc            # Prettier 설정
├── nest-cli.json          # NestJS CLI 설정
└── CLAUDE.md              # Claude Code 가이드
```

## src/ 디렉토리 구조

### 핵심 애플리케이션 파일
```
src/
├── main.ts                # 애플리케이션 진입점
├── app.module.ts          # 루트 모듈
├── app.controller.ts      # 루트 컨트롤러
├── app.service.ts         # 루트 서비스
└── data-source.ts         # TypeORM 데이터 소스
```

### 아키텍처 레이어
```
src/
├── config/                # 설정 파일
│   ├── configuration.ts   # 애플리케이션 설정
│   └── env.validation.ts  # 환경 변수 검증
├── common/                # 공통 모듈
│   ├── decorators/        # 커스텀 데코레이터
│   ├── enums/            # 열거형 타입
│   ├── events/           # 이벤트 정의
│   ├── guards/           # 가드 (인증/인가)
│   ├── interfaces/       # 인터페이스
│   ├── modules/          # 공통 모듈
│   └── services/         # 공통 서비스
├── infrastructure/        # 인프라 레이어
│   ├── database/         # 데이터베이스 설정
│   ├── redis/            # Redis 및 이벤트 버스
│   └── audit/            # 감사 시스템
└── modules/              # 비즈니스 도메인 모듈
    ├── user/             # 사용자 관리
    ├── item/             # 상품 관리
    ├── inventory/        # 재고 관리
    ├── order/            # 주문 관리
    ├── payment/          # 결제 관리
    ├── coupon/           # 쿠폰 시스템
    └── notification/     # 알림 시스템
```

### 모듈 구조 패턴
각 도메인 모듈은 다음 구조를 따름:
```
modules/[domain]/
├── dto/                   # 데이터 전송 객체
├── entities/              # TypeORM 엔티티
├── enums/                # 도메인 특화 열거형
├── events/               # 도메인 이벤트
├── interfaces/           # 도메인 인터페이스
├── repositories/         # 저장소 패턴
├── services/             # 비즈니스 로직
├── [domain].controller.ts # HTTP 엔드포인트
├── [domain].service.ts   # 메인 서비스
└── [domain].module.ts    # 모듈 정의
```

## 특수 디렉토리

### database/
```
src/database/
├── migrations/           # 데이터베이스 마이그레이션
└── seeds/               # 초기 데이터
```

### scripts/
```
src/scripts/             # 유틸리티 스크립트
├── test-*.ts           # 각종 테스트 스크립트
└── ...
```

### docs/
```
docs/
├── README.md                              # 프로젝트 문서 인덱스
├── SAGA_README.md                         # Saga 패턴 가이드
├── API_DOCUMENTATION.md                   # API 문서
├── AUDIT_SYSTEM_IMPROVEMENT_WORKFLOW.md   # Audit 시스템 개선
└── ... (기타 기술 문서들)
```