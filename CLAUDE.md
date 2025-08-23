# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 필요한 가이드를 제공합니다.

## 프로젝트 개요

NestJS TypeScript 스타터 애플리케이션입니다. 데코레이터와 의존성 주입을 사용하는 Node.js 서버 사이드 프레임워크로, 현재 기본적인 "Hello World" API 엔드포인트를 제공합니다.

## 개발 명령어

### 빌드 및 실행
- `npm run build` - TypeScript를 JavaScript로 컴파일하여 dist/ 디렉토리에 출력
- `npm run start` - 프로덕션 모드로 시작 (빌드 필요)
- `npm run start:dev` - 파일 변경 감지와 함께 개발 모드로 시작
- `npm run start:debug` - Node.js 디버거와 파일 변경 감지로 시작

### 코드 품질
- `npm run lint` - src/ 및 test/ 디렉토리에서 ESLint 자동 수정 실행
- `npm run format` - Prettier로 코드 포맷팅

### 테스트
- `npm run test` - 단위 테스트 실행
- `npm run test:watch` - 단위 테스트를 감시 모드로 실행
- `npm run test:cov` - 커버리지 리포트와 함께 테스트 실행
- `npm run test:e2e` - E2E 테스트 실행
- `npm run test:debug` - Node.js 디버거로 테스트 실행

### 단일 테스트 실행
Jest를 직접 사용하여 특정 테스트 파일 실행:
```bash
npm run test -- app.controller.spec.ts
npm run test:e2e -- --testNamePattern="특정 테스트 이름"
```

## 아키텍처

### 핵심 NestJS 패턴
- **모듈** (`*.module.ts`): 관련된 컨트롤러, 서비스, 프로바이더를 그룹화하는 기능 컨테이너
- **컨트롤러** (`*.controller.ts`): `@Get()`, `@Post()` 같은 데코레이터를 사용해 HTTP 요청과 응답을 처리
- **서비스** (`*.service.ts`): `@Injectable()` 데코레이터로 표시되는 비즈니스 로직 계층
- **의존성 주입**: 애플리케이션 전체에서 생성자 기반 주입 사용

### 프로젝트 구조
- `src/main.ts` - 애플리케이션 진입점, NestFactory 생성 및 포트 3000에서 서버 시작
- `src/app.module.ts` - 다른 모든 모듈을 가져오는 루트 모듈
- `src/app.controller.ts` - 기본 GET 엔드포인트가 있는 루트 컨트롤러
- `src/app.service.ts` - 비즈니스 로직이 있는 루트 서비스
- `test/` - Supertest를 사용한 E2E 테스트

### 설정
- ES2023 타겟, 실험적 데코레이터가 활성화된 TypeScript
- ts-jest 변환기를 사용하는 Jest 테스트
- 코드 품질과 포맷팅을 위한 ESLint + Prettier
- 빌드 출력은 `dist/` 디렉토리로 (빌드 시 자동 정리)

## 개발 참고사항

새로운 기능 생성 시:
1. NestJS CLI를 사용하여 모듈/컨트롤러/서비스 생성: `nest generate module|controller|service 이름`
2. 의존성 주입 패턴 따르기 - 생성자를 통해 컨트롤러에 서비스 주입
3. 라우팅(`@Get()`, `@Post()` 등)과 의존성 주입(`@Injectable()`)을 위한 TypeScript 데코레이터 사용
4. 단위 테스트는 소스 파일과 함께 (`.spec.ts`), E2E 테스트는 `test/` 디렉토리에 배치