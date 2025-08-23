import 'reflect-metadata';
import { plainToClass, Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  validateSync,
  IsUrl,
  Min,
  Max,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

enum DatabaseType {
  SQLite = 'sqlite',
  PostgreSQL = 'postgres',
  MySQL = 'mysql',
}

enum LogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
}

export class EnvironmentVariables {
  // 기본 환경 설정
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  @Min(1000)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10))
  PORT: number;

  @IsString()
  @IsOptional()
  APP_NAME?: string;

  // Redis 설정
  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_PORT: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @Min(0)
  @Max(15)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  REDIS_DB?: number;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  REDIS_TLS?: boolean;

  // 데이터베이스 설정
  @IsEnum(DatabaseType)
  DATABASE_TYPE: DatabaseType;

  @IsString()
  @IsOptional()
  DATABASE_HOST?: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  DATABASE_PORT?: number;

  @IsString()
  DATABASE_NAME: string;

  @IsString()
  @IsOptional()
  DATABASE_USERNAME?: string;

  @IsString()
  @IsOptional()
  DATABASE_PASSWORD?: string;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  DATABASE_SYNCHRONIZE?: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  DATABASE_LOGGING?: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  DATABASE_SSL?: boolean;

  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  DATABASE_POOL_SIZE?: number;

  // 로그 설정
  @IsEnum(LogLevel)
  @IsOptional()
  LOG_LEVEL?: LogLevel;

  @IsString()
  @IsOptional()
  LOG_FILE_PATH?: string;

  // Saga 설정
  @IsNumber()
  @Min(1000)
  @Max(3600000) // 최대 1시간
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  SAGA_TIMEOUT?: number;

  @IsNumber()
  @Min(1)
  @Max(10)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  SAGA_RETRY_COUNT?: number;

  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  SAGA_DEAD_LETTER_QUEUE?: boolean;

  // 결제 설정
  @IsNumber()
  @Min(0)
  @Max(1)
  @Transform(({ value }) => parseFloat(value))
  @IsOptional()
  PAYMENT_SUCCESS_RATE?: number;

  @IsNumber()
  @Min(100)
  @Max(60000) // 최대 1분
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  PAYMENT_TIMEOUT?: number;

  @IsUrl()
  @IsOptional()
  PAYMENT_GATEWAY_URL?: string;

  @IsString()
  @IsOptional()
  PAYMENT_API_KEY?: string;

  @IsString()
  @IsOptional()
  PAYMENT_WEBHOOK_SECRET?: string;

  // 알림 설정
  @IsBoolean()
  @Transform(({ value }) => value !== 'false')
  @IsOptional()
  NOTIFICATION_ENABLED?: boolean;

  @IsString()
  @IsOptional()
  NOTIFICATION_TYPE?: string;

  // SMTP 설정
  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  SMTP_PORT?: number;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  // 보안 설정
  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  // 모니터링 설정
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  MONITORING_ENABLED?: boolean;

  @IsNumber()
  @Min(1000)
  @Max(65535)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  METRICS_PORT?: number;

  @IsUrl()
  @IsOptional()
  JAEGER_ENDPOINT?: string;

  // 레이트 리미팅
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @IsOptional()
  RATE_LIMIT_ENABLED?: boolean;

  @IsNumber()
  @Min(1000)
  @Max(3600000) // 최대 1시간
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  RATE_LIMIT_WINDOW_MS?: number;

  @IsNumber()
  @Min(1)
  @Max(10000)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  RATE_LIMIT_MAX_REQUESTS?: number;

  // 캐싱 설정
  @IsNumber()
  @Min(60)
  @Max(86400) // 최대 24시간
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  CACHE_TTL?: number;

  @IsNumber()
  @Min(100)
  @Max(100000)
  @Transform(({ value }) => parseInt(value, 10))
  @IsOptional()
  CACHE_MAX_SIZE?: number;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map((error) => {
      const constraints = Object.values(error.constraints || {});
      return `${error.property}: ${constraints.join(', ')}`;
    });

    throw new Error(`환경 변수 검증 실패:\n${errorMessages.join('\n')}`);
  }

  return validatedConfig;
}

export function validateProductionEnvironment(config: Record<string, unknown>) {
  const isProduction = config.NODE_ENV === 'production';

  if (!isProduction) {
    return config;
  }

  // 운영 환경에서 필수인 환경 변수들
  const requiredInProduction = [
    'REDIS_PASSWORD',
    'DATABASE_PASSWORD',
    'JWT_SECRET',
    'DATABASE_HOST',
    'DATABASE_USERNAME',
  ];

  const missingVars = requiredInProduction.filter(
    (varName) => !config[varName],
  );

  if (missingVars.length > 0) {
    throw new Error(
      `운영 환경에서 필수 환경 변수가 누락되었습니다: ${missingVars.join(', ')}`,
    );
  }

  // JWT Secret 길이 검증 (운영 환경)
  const jwtSecret = config.JWT_SECRET as string;
  if (jwtSecret && jwtSecret.length < 32) {
    throw new Error('운영 환경에서 JWT_SECRET은 최소 32자 이상이어야 합니다');
  }

  // 데이터베이스 동기화 검증 (운영 환경)
  if (config.DATABASE_SYNCHRONIZE === 'true') {
    console.warn(
      '⚠️  운영 환경에서 DATABASE_SYNCHRONIZE=true는 권장되지 않습니다',
    );
  }

  return config;
}
