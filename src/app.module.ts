import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';

// Infrastructure
import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';

// Common Modules
import { AuditModule } from './common/modules/audit.module';

// Business Modules
import { OrderModule } from './modules/order/order.module';
import { UserModule } from './modules/user/user.module';
import { ItemModule } from './modules/item/item.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PaymentModule } from './modules/payment/payment.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [
    // 환경 설정
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env.local',
        '.env',
      ],
      validate: (config) => {
        // 1. 기본 환경 변수 검증
        const {
          validateEnvironment,
          validateProductionEnvironment,
        } = require('./config/env.validation');
        const validatedConfig = validateEnvironment(config);

        // 2. 운영 환경 추가 검증
        validateProductionEnvironment(config);
        return validatedConfig;
      },
    }),

    // Infrastructure 모듈
    DatabaseModule,
    RedisModule,

    // Common 모듈
    AuditModule,

    // Business 모듈 (Saga Choreography 참여자들)
    OrderModule,
    UserModule,
    ItemModule,
    InventoryModule,
    PaymentModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
