# 권장 개발 명령어

## 개발 실행 명령어
### 애플리케이션 실행
```bash
npm run start:dev          # 개발 모드 (파일 변경 감지)
npm run start:debug        # 디버그 모드 (파일 변경 감지)
npm run start              # 프로덕션 모드 (빌드 필요)
npm run start:prod         # 프로덕션 모드 (NODE_ENV=production)
```

### 빌드
```bash
npm run build              # TypeScript → JavaScript 컴파일
```

## 코드 품질 명령어
### 린팅 및 포맷팅
```bash
npm run lint               # ESLint 자동 수정 실행
npm run format             # Prettier 코드 포맷팅
```

## 테스트 명령어
### 기본 테스트
```bash
npm run test               # 단위 테스트 실행
npm run test:watch         # 테스트 감시 모드
npm run test:cov           # 커버리지 리포트 포함
npm run test:e2e           # E2E 테스트 실행
npm run test:debug         # 디버거로 테스트 실행
```

### 특정 테스트 실행
```bash
npm run test -- app.controller.spec.ts                    # 특정 파일
npm run test:e2e -- --testNamePattern="특정 테스트 이름"   # 특정 테스트
```

## 데이터베이스 마이그레이션
### TypeORM 명령어
```bash
npm run typeorm migration:run          # 마이그레이션 실행
npm run typeorm migration:generate     # 마이그레이션 생성
npm run typeorm migration:create       # 빈 마이그레이션 생성
npm run typeorm migration:revert       # 마이그레이션 되돌리기
```

## 특수 테스트 스크립트
### 프로젝트 특화 테스트
```bash
npm run test:saga                      # Saga 패턴 테스트
npm run test:saga:enhanced             # 개선된 Saga 테스트
npm run test:env                       # 환경 변수 검증
npm run test:mongodb                   # MongoDB 연결 테스트
npm run test:audit-compat              # Audit 서비스 호환성
npm run test:audit-dual                # 이중 Audit 시스템
npm run test:audit-postgres            # PostgreSQL Audit
npm run test:audit-mongo               # MongoDB Audit
```

## 시스템 명령어 (macOS/Darwin)
### 파일 시스템
```bash
ls -la                     # 파일 목록 (숨김 파일 포함)
find . -name "*.ts"        # TypeScript 파일 찾기
grep -r "pattern" src/     # 패턴 검색
```

### Git 명령어
```bash
git status                 # 상태 확인
git add .                  # 모든 변경사항 스테이징
git commit -m "message"    # 커밋
git push origin main       # 푸시
```

## 작업 완료 시 실행 순서
1. `npm run lint`          # 코드 품질 검사
2. `npm run format`        # 코드 포맷팅
3. `npm run test`          # 단위 테스트
4. `npm run test:e2e`      # E2E 테스트
5. `npm run build`         # 빌드 확인