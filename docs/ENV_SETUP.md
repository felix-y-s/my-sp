# 🔧 환경 설정 가이드

이 프로젝트는 개발, 운영 환경별로 다른 설정을 사용할 수 있도록 구성되었습니다.

## 📁 환경 파일 구조

```
├── .env.development      # 개발 환경 설정
├── .env.production       # 운영 환경 설정
├── .env.local           # 로컬 개인 설정 (gitignore에 포함)
└── .env.example         # 환경 변수 템플릿
```

## 🚀 설정 방법

### 1. 개발 환경 설정

```bash
# .env.development 파일이 기본으로 제공됩니다
npm run start:dev
```

### 2. 로컬 개인 설정

```bash
# .env.example 파일을 복사하여 .env.local 생성
cp .env.example .env.local

# 개인별 설정 수정
vi .env.local
```

### 3. 운영 환경 설정

```bash
# 운영 서버에서 .env.production 사용
NODE_ENV=production npm run start:prod
```

## 🔑 주요 환경 변수

### Redis 설정
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password  # 운영 환경에서만
```

### 데이터베이스 설정
```env
# 개발용 (SQLite)
DATABASE_TYPE=sqlite
DATABASE_NAME=purchase_saga_dev.db

# 운영용 (PostgreSQL)
DATABASE_TYPE=postgres
DATABASE_HOST=your-db-host
DATABASE_PORT=5432
DATABASE_NAME=purchase_saga_prod
DATABASE_USERNAME=saga_user
DATABASE_PASSWORD=your-secure-password
```

### Saga 설정
```env
SAGA_TIMEOUT=300000        # 5분 (밀리초)
SAGA_RETRY_COUNT=3         # 재시도 횟수
```

### 결제 설정
```env
PAYMENT_SUCCESS_RATE=0.9   # 90% 성공률 (테스트용)
PAYMENT_TIMEOUT=2000       # 2초
```

### 알림 설정
```env
NOTIFICATION_ENABLED=true
NOTIFICATION_TYPE=console  # console, email, sms, all

# 이메일 설정 (운영용)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 🎯 환경별 실행 방법

### 개발 환경
```bash
# 개발 모드 (자동 재시작)
npm run start:dev

# 디버그 모드
npm run start:debug
```

### 운영 환경
```bash
# 프로덕션 빌드
npm run build

# 운영 모드 실행
npm run start:prod
```

### 테스트
```bash
# Saga 플로우 테스트
npm run test:saga

# 단위 테스트
npm test
```

## 🔒 보안 고려사항

### 개발 환경
- 기본값 사용 가능
- 간단한 비밀번호 사용 가능
- 로그 레벨: debug

### 운영 환경
- **모든 비밀번호 변경 필수**
- 강력한 JWT 시크릿 사용
- HTTPS 사용
- 로그 레벨: warn 또는 error
- CORS 설정 제한

```env
# 운영 환경 보안 설정 예시
JWT_SECRET=your-super-secure-256-bit-secret-key
REDIS_PASSWORD=your-secure-redis-password
DATABASE_PASSWORD=your-secure-db-password
CORS_ORIGINS=https://yourdomain.com
```

## 🛠️ 환경별 특화 설정

### 개발 환경 특징
- SQLite 사용 (간편함)
- 동기화 활성화
- 상세 로깅
- 높은 결제 성공률

### 운영 환경 특징
- PostgreSQL 사용 (성능, 확장성)
- 동기화 비활성화 (마이그레이션 사용)
- 최소 로깅
- 실제 결제 처리
- SSL/TLS 활성화
- 모니터링 도구 연동

## 📋 환경 변수 검증

애플리케이션 시작 시 필수 환경 변수를 자동 검증합니다:

```typescript
// 운영 환경에서 필수 검증 항목
const requiredInProduction = [
  'DATABASE_PASSWORD',
  'REDIS_PASSWORD', 
  'JWT_SECRET',
];
```

## 🔄 설정 변경 시 주의사항

1. **Redis 설정 변경**
   - 애플리케이션 재시작 필요
   - 기존 세션 데이터 손실 가능

2. **데이터베이스 설정 변경**
   - 마이그레이션 실행 필요
   - 백업 필수

3. **Saga 타임아웃 변경**
   - 진행 중인 트랜잭션에 영향
   - 단계적 변경 권장

## 💡 팁

### 로컬 개발 시
```bash
# 개발자별 다른 포트 사용
echo "PORT=3001" >> .env.local

# 테스트용 데이터 설정
echo "TEST_USER_BALANCE=100000" >> .env.local
echo "TEST_ITEM_STOCK=999" >> .env.local
```

### Docker 사용 시
```bash
# Redis 컨테이너 실행
docker run -d -p 6379:6379 --name redis redis:alpine

# PostgreSQL 컨테이너 실행 (운영 환경)
docker run -d \
  -p 5432:5432 \
  -e POSTGRES_DB=purchase_saga_prod \
  -e POSTGRES_USER=saga_user \
  -e POSTGRES_PASSWORD=your-password \
  --name postgres \
  postgres:13
```

환경 설정이 완료되면 `npm run start:dev`로 애플리케이션을 실행할 수 있습니다! 🚀