# 코드 스타일 및 규칙

## TypeScript 설정
- **타겟**: ES2023
- **모듈**: nodenext
- **Decorators**: 실험적 데코레이터 활성화 (NestJS 필수)
- **엄격성**: strictNullChecks 활성화, noImplicitAny 비활성화

## ESLint 규칙
- **기본**: @eslint/js 권장 설정
- **TypeScript**: typescript-eslint 권장 타입 검사 설정
- **Prettier 통합**: eslint-plugin-prettier 사용

### 커스텀 규칙
```typescript
'@typescript-eslint/no-explicit-any': 'off'          // any 타입 허용
'@typescript-eslint/no-floating-promises': 'warn'    // Promise 처리 경고
'@typescript-eslint/no-unsafe-argument': 'warn'      // 안전하지 않은 인수 경고
```

## Prettier 설정
```json
{
  "singleQuote": true,      // 작은 따옴표 사용
  "trailingComma": "all"    // 모든 곳에 후행 쉼표
}
```

## NestJS 규칙
### 파일 명명 규칙
- **모듈**: `*.module.ts`
- **컨트롤러**: `*.controller.ts` 
- **서비스**: `*.service.ts`
- **엔티티**: `*.entity.ts`
- **DTO**: `*.dto.ts`
- **테스트**: `*.spec.ts` (단위), `*.e2e-spec.ts` (E2E)

### 데코레이터 사용
- **@Injectable()**: 서비스 클래스
- **@Controller()**: 컨트롤러 클래스
- **@Get()**, **@Post()** 등: HTTP 메소드
- **@Module()**: 모듈 정의

### 의존성 주입 패턴
- 생성자 기반 주입 사용
- private readonly 필드로 선언

```typescript
constructor(
  private readonly userService: UserService,
  private readonly configService: ConfigService,
) {}
```