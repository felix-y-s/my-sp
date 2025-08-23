/**
 * 환경 변수 검증 테스트 스크립트
 */

import { config } from 'dotenv';
import {
  validateEnvironment,
  validateProductionEnvironment,
} from '../config/env.validation';

async function testEnvironmentValidation() {
  console.log('🧪 환경 변수 검증 테스트 시작\n');

  // 테스트 1: 정상적인 개발 환경 설정
  console.log('✅ 테스트 1: 정상적인 개발 환경 설정');
  try {
    config({ path: '.env.development' });
    const validConfig = validateEnvironment(process.env);
    console.log('   개발 환경 검증 성공!');
    console.log(`   환경: ${validConfig.NODE_ENV}`);
    console.log(`   포트: ${validConfig.PORT}`);
    console.log(
      `   Redis: ${validConfig.REDIS_HOST}:${validConfig.REDIS_PORT}\n`,
    );
  } catch (error) {
    console.error('   개발 환경 검증 실패:', error.message);
  }

  // 테스트 2: 잘못된 환경 변수
  console.log('❌ 테스트 2: 잘못된 환경 변수 (실패 예상)');
  try {
    // 잘못된 환경 변수 설정
    const invalidEnv = {
      NODE_ENV: 'invalid-environment',
      PORT: 'abc',
      REDIS_HOST: '',
      REDIS_PORT: '99999',
      PAYMENT_SUCCESS_RATE: '2.0',
      SAGA_TIMEOUT: '0',
      JWT_SECRET: 'short',
      DATABASE_TYPE: 'sqlite',
      DATABASE_NAME: 'test.db',
    };

    validateEnvironment(invalidEnv);
    console.log('   예상과 달리 검증이 성공했습니다!');
  } catch (error) {
    console.log('   ✅ 예상대로 검증 실패:');
    console.log(`   ${error.message}\n`);
  }

  // 테스트 3: 운영 환경 필수 변수 누락
  console.log('🚨 테스트 3: 운영 환경 필수 변수 누락 (실패 예상)');
  try {
    const prodEnvMissing = {
      NODE_ENV: 'production',
      PORT: '3000',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      // REDIS_PASSWORD: 누락
      DATABASE_TYPE: 'postgres',
      DATABASE_NAME: 'prod_db',
      // DATABASE_PASSWORD: 누락
      JWT_SECRET: 'production-secret-but-no-other-required-vars',
    };

    validateProductionEnvironment(prodEnvMissing);
    console.log('   예상과 달리 검증이 성공했습니다!');
  } catch (error) {
    console.log('   ✅ 예상대로 운영 환경 검증 실패:');
    console.log(`   ${error.message}\n`);
  }

  // 테스트 4: 완전한 운영 환경 설정
  console.log('🏭 테스트 4: 완전한 운영 환경 설정');
  try {
    const completeProdEnv = {
      NODE_ENV: 'production',
      PORT: '3000',
      REDIS_HOST: 'redis-prod.internal',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: 'secure-redis-password',
      DATABASE_TYPE: 'postgres',
      DATABASE_HOST: 'postgres-prod.internal',
      DATABASE_PORT: '5432',
      DATABASE_NAME: 'purchase_saga_prod',
      DATABASE_USERNAME: 'saga_user',
      DATABASE_PASSWORD: 'secure-database-password',
      DATABASE_SYNCHRONIZE: 'false',
      JWT_SECRET: 'super-secure-jwt-secret-with-256-bits-minimum-length',
      PAYMENT_SUCCESS_RATE: '1.0',
      SAGA_TIMEOUT: '300000',
      CORS_ORIGINS: 'https://yourdomain.com',
    };

    const validConfig = validateEnvironment(completeProdEnv);
    validateProductionEnvironment(completeProdEnv);

    console.log('   ✅ 운영 환경 검증 성공!');
    console.log(`   환경: ${validConfig.NODE_ENV}`);
    console.log(`   데이터베이스: ${validConfig.DATABASE_TYPE}`);
    console.log(`   JWT Secret 길이: ${validConfig.JWT_SECRET.length}자\n`);
  } catch (error) {
    console.error('   운영 환경 검증 실패:', error.message);
  }

  // 테스트 5: 타입 변환 테스트
  console.log('🔄 테스트 5: 타입 변환 테스트');
  try {
    const typeConversionEnv = {
      NODE_ENV: 'development',
      PORT: '3001', // string -> number
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6380', // string -> number
      DATABASE_TYPE: 'sqlite',
      DATABASE_NAME: 'test.db',
      DATABASE_SYNCHRONIZE: 'true', // string -> boolean
      DATABASE_LOGGING: 'false', // string -> boolean
      PAYMENT_SUCCESS_RATE: '0.95', // string -> number
      SAGA_TIMEOUT: '180000', // string -> number
      JWT_SECRET: 'development-secret-key',
    };

    const validConfig = validateEnvironment(typeConversionEnv);

    console.log('   ✅ 타입 변환 성공!');
    console.log(
      `   포트 (number): ${validConfig.PORT} (${typeof validConfig.PORT})`,
    );
    console.log(
      `   Redis 포트 (number): ${validConfig.REDIS_PORT} (${typeof validConfig.REDIS_PORT})`,
    );
    console.log(
      `   동기화 (boolean): ${validConfig.DATABASE_SYNCHRONIZE} (${typeof validConfig.DATABASE_SYNCHRONIZE})`,
    );
    console.log(
      `   성공률 (number): ${validConfig.PAYMENT_SUCCESS_RATE} (${typeof validConfig.PAYMENT_SUCCESS_RATE})`,
    );
  } catch (error) {
    console.error('   타입 변환 실패:', error.message);
  }

  console.log('\n🎉 환경 변수 검증 테스트 완료!');
}

// 스크립트 실행
testEnvironmentValidation().catch(console.error);
