import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../../infrastructure/redis/redis.module';

// Entities
import { Coupon } from './entities/coupon.entity';
import { UserCoupon } from './entities/user-coupon.entity';
import { CouponUsageLog } from './entities/coupon-usage-log.entity';

// Repositories
import { CouponRepository } from './repositories/coupon.repository';
import { UserCouponRepository } from './repositories/user-coupon.repository';
import { CouponUsageLogRepository } from './repositories/coupon-usage-log.repository';

// Services
import { CouponEventBusService } from './services/coupon-eventbus.service';
import { CouponService } from './services/coupon.service';
import { CouponValidationService } from './services/coupon-validation.service';
import { CouponDiscountService } from './services/coupon-discount.service';

// Event Handlers
import { CouponNotificationHandler } from './events/handlers/coupon-notification.handler';
import { CouponAnalyticsHandler } from './events/handlers/coupon-analytics.handler';

@Module({
  imports: [
    // TypeORM 엔티티 등록
    TypeOrmModule.forFeature([Coupon, UserCoupon, CouponUsageLog]),
    // 설정 모듈 (Redis 설정 접근용)
    ConfigModule,
    // Redis 모듈 (메인 EventBus 사용용)
    RedisModule,
  ],
  providers: [
    // Repository 등록
    CouponRepository,
    UserCouponRepository,
    CouponUsageLogRepository,

    // 쿠폰 서비스들
    CouponService,
    CouponValidationService,
    CouponDiscountService,
    CouponEventBusService,

    // 이벤트 핸들러들
    CouponNotificationHandler,
    CouponAnalyticsHandler,
  ],
  exports: [
    // 다른 모듈에서 사용할 수 있도록 export
    CouponService,
    CouponValidationService,
    CouponDiscountService,
    CouponRepository,
    UserCouponRepository,
    CouponUsageLogRepository,
    CouponEventBusService,
    CouponNotificationHandler,
    CouponAnalyticsHandler,
  ],
})
export class CouponModule {
  constructor(
    private readonly couponEventBus: CouponEventBusService,
    private readonly notificationHandler: CouponNotificationHandler,
    private readonly analyticsHandler: CouponAnalyticsHandler,
  ) {
    this.setupEventHandlers();
  }

  /**
   * 쿠폰 이벤트 핸들러 설정
   * 모듈 초기화 시 각 이벤트에 대한 핸들러를 등록
   */
  private async setupEventHandlers(): Promise<void> {
    try {
      // 쿠폰 발급 이벤트
      await this.couponEventBus.subscribeCouponEvent('issued', (data) =>
        this.notificationHandler.handle(data),
      );
      await this.couponEventBus.subscribeCouponEvent('issued', (data) =>
        this.analyticsHandler.handle(data),
      );

      // 쿠폰 사용 이벤트
      await this.couponEventBus.subscribeCouponEvent('used', (data) =>
        this.notificationHandler.handle(data),
      );
      await this.couponEventBus.subscribeCouponEvent('used', (data) =>
        this.analyticsHandler.handle(data),
      );

      // 쿠폰 만료 이벤트
      await this.couponEventBus.subscribeCouponEvent('expired', (data) =>
        this.notificationHandler.handle(data),
      );
      await this.couponEventBus.subscribeCouponEvent('expired', (data) =>
        this.analyticsHandler.handle(data),
      );

      // 쿠폰 사용 취소 이벤트
      await this.couponEventBus.subscribeCouponEvent(
        'usage.cancelled',
        (data) => this.notificationHandler.handle(data),
      );

      // 쿠폰 만료 예정 경고 이벤트
      await this.couponEventBus.subscribeCouponEvent(
        'expiring.warning',
        (data) => this.notificationHandler.handle(data),
      );

      // 쿠폰 재고 관련 이벤트 (관리자용)
      await this.couponEventBus.subscribeCouponEvent('low.stock', (data) =>
        this.notificationHandler.handle(data),
      );
      await this.couponEventBus.subscribeCouponEvent('out.of.stock', (data) =>
        this.notificationHandler.handle(data),
      );

      // 쿠폰 생성/상태 변경 이벤트
      await this.couponEventBus.subscribeCouponEvent('created', (data) =>
        this.analyticsHandler.handle(data),
      );
      await this.couponEventBus.subscribeCouponEvent('status.changed', (data) =>
        this.analyticsHandler.handle(data),
      );

      console.log('쿠폰 이벤트 핸들러 설정 완료');
    } catch (error) {
      console.error('쿠폰 이벤트 핸들러 설정 실패:', error);
    }
  }
}
