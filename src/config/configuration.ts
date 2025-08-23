export default () => ({
  // 환경 설정
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '', 10) || 3000,
  appName: process.env.APP_NAME || 'Purchase Saga',

  // Redis 설정
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '', 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '', 10) || 0,
    tls: process.env.REDIS_TLS === 'true',
  },

  // 데이터베이스 설정
  database: {
    type: process.env.DATABASE_TYPE || 'sqlite',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '', 10) || 5432,
    database: process.env.DATABASE_NAME || 'purchase_saga.db',
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
    logging: process.env.DATABASE_LOGGING === 'true',
    ssl: process.env.DATABASE_SSL === 'true',
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '', 10) || 10,
  },

  // 로그 설정
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    filePath: process.env.LOG_FILE_PATH,
    maxSize: process.env.LOG_MAX_SIZE || '100mb',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '', 10) || 30,
  },

  // Saga 설정
  saga: {
    timeout: parseInt(process.env.SAGA_TIMEOUT || '', 10) || 300000, // 5분
    retryCount: parseInt(process.env.SAGA_RETRY_COUNT || '', 10) || 3,
    deadLetterQueue: process.env.SAGA_DEAD_LETTER_QUEUE === 'true',
  },

  // 결제 설정
  payment: {
    gatewayUrl: process.env.PAYMENT_GATEWAY_URL,
    apiKey: process.env.PAYMENT_API_KEY,
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET,
    successRate: parseFloat(process.env.PAYMENT_SUCCESS_RATE || '') || 0.9,
    timeout: parseInt(process.env.PAYMENT_TIMEOUT || '', 10) || 2000,
  },

  // 알림 설정
  notification: {
    enabled: process.env.NOTIFICATION_ENABLED !== 'false',
    type: process.env.NOTIFICATION_TYPE || 'console',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '', 10) || 587,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM,
    },
    sms: {
      apiKey: process.env.SMS_PROVIDER_API_KEY,
      fromNumber: process.env.SMS_FROM_NUMBER,
    },
    push: {
      fcmServerKey: process.env.FCM_SERVER_KEY,
      apnsKeyId: process.env.APNS_KEY_ID,
      apnsTeamId: process.env.APNS_TEAM_ID,
    },
  },

  // 보안 설정
  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
  },

  // 모니터링 설정
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '', 10) || 9090,
    healthCheckPath: process.env.HEALTH_CHECK_PATH || '/health',
    jaegerEndpoint: process.env.JAEGER_ENDPOINT,
  },

  // 레이트 리미팅
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '', 10) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '', 10) || 100,
  },

  // 캐싱 설정
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '', 10) || 3600,
    maxSize: parseInt(process.env.CACHE_MAX_SIZE || '', 10) || 1000,
  },

  // 백업 설정
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '', 10) || 30,
  },

  // 테스트 설정 (개발용)
  test: {
    userBalance: parseInt(process.env.TEST_USER_BALANCE || '', 10) || 50000,
    itemStock: parseInt(process.env.TEST_ITEM_STOCK || '', 10) || 100,
  },
});
