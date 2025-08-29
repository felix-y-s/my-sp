# 작업 완료 체크리스트

## 코드 작성 후 필수 실행 순서

### 1. 코드 품질 검사
```bash
npm run lint               # ESLint 자동 수정 - 코드 품질 표준 준수
```
- TypeScript 타입 에러 해결
- 코딩 규칙 위반 자동 수정
- 사용하지 않는 import 제거

### 2. 코드 포맷팅
```bash
npm run format             # Prettier - 일관된 코드 스타일 적용
```
- 작은 따옴표 통일
- 후행 쉼표 추가
- 들여쓰기 정규화

### 3. 단위 테스트 실행
```bash
npm run test               # Jest 단위 테스트
```
- 새로 작성한 코드의 테스트 통과 확인
- 기존 테스트 회귀 확인
- 필요시 새로운 테스트 작성

### 4. E2E 테스트 실행
```bash
npm run test:e2e           # 전체 시스템 통합 테스트
```
- API 엔드포인트 정상 작동 확인
- 데이터베이스 연동 확인
- 전체 플로우 검증

### 5. 빌드 검증
```bash
npm run build              # TypeScript 컴파일 확인
```
- 프로덕션 빌드 가능성 검증
- 타입 에러 최종 확인
- dist/ 디렉토리 생성 확인

## 특수 상황별 추가 체크리스트

### 데이터베이스 관련 작업 시
```bash
npm run typeorm migration:generate    # 스키마 변경 감지
npm run typeorm migration:run         # 마이그레이션 적용
```

### 환경 변수 변경 시
```bash
npm run test:env                      # 환경 변수 검증
```

### Saga 패턴 관련 작업 시
```bash
npm run test:saga                     # Saga 패턴 테스트
npm run test:saga:enhanced            # 개선된 Saga 테스트
```

### Audit 시스템 작업 시
```bash
npm run test:audit-dual               # 이중 Audit 시스템 테스트
```

## 커밋 전 최종 체크리스트

### 필수 확인 사항
- [ ] `npm run lint` 통과
- [ ] `npm run format` 실행 완료
- [ ] `npm run test` 모든 테스트 통과
- [ ] `npm run test:e2e` E2E 테스트 통과
- [ ] `npm run build` 빌드 성공

### 코드 리뷰 자가 점검
- [ ] NestJS 패턴 준수 (데코레이터, 의존성 주입)
- [ ] TypeScript 타입 안전성 확보
- [ ] 적절한 에러 핸들링 구현
- [ ] 테스트 커버리지 유지/개선
- [ ] 문서 업데이트 (필요시)

### 특별 주의사항
- **절대 실행하지 말 것**: `npm test` (package.json에 없는 명령어)
- **프로덕션 환경**: `NODE_ENV=production npm run start:prod` 사용
- **디버깅**: `npm run start:debug` 사용 권장
- **성능 테스트**: 관련 스크립트 있을 시 실행 고려