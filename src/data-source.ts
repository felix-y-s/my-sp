import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { validateEnvironment } from './config/env.validation';

// 환경 변수 로드
config({ path: '.env.development' });

// 환경 변수 검증
const validatedEnv = validateEnvironment(process.env);

// 공통 설정
const commonConfig = {
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
  migrationsTableName: 'typeorm_migrations',
  migrationsRun: false,
  synchronize: validatedEnv.DATABASE_SYNCHRONIZE && validatedEnv.NODE_ENV !== 'production',
  logging: validatedEnv.DATABASE_LOGGING && validatedEnv.NODE_ENV === 'development',
};

// 데이터베이스 타입별 설정
let dataSourceConfig: DataSourceOptions;

if (validatedEnv.DATABASE_TYPE === 'postgres') {
  dataSourceConfig = {
    type: 'postgres',
    host: validatedEnv.DATABASE_HOST,
    port: validatedEnv.DATABASE_PORT,
    database: validatedEnv.DATABASE_NAME,
    username: validatedEnv.DATABASE_USERNAME,
    password: validatedEnv.DATABASE_PASSWORD,
    ssl: validatedEnv.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    ...commonConfig,
  };
} else {
  dataSourceConfig = {
    type: 'sqlite',
    database: validatedEnv.DATABASE_NAME,
    ...commonConfig,
  };
}

// TypeORM 데이터 소스 생성 및 기본 export (CLI에서 사용)
const AppDataSource = new DataSource(dataSourceConfig);
export default AppDataSource;