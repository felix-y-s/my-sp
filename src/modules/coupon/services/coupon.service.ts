import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

// Entities
import { Coupon } from '../entities/coupon.entity';
import { UserCoupon } from '../entities/user-coupon.entity';
import { CouponUsageLog } from '../entities/coupon-usage-log.entity';

// Repositories
import { CouponRepository } from '../repositories/coupon.repository';
import { UserCouponRepository } from '../repositories/user-coupon.repository';
import { CouponUsageLogRepository } from '../repositories/coupon-usage-log.repository';

// Services
import { CouponEventBusService } from './coupon-eventbus.service';

// Events
import { COUPON_EVENTS } from '../events/coupon-events';
import { EventBusService } from '../../../infrastructure/redis/event-bus.service';
import { EventType } from '../../../common/events/event-types.enum';
import {
  CouponValidationRequestedEvent,
  CouponValidatedEvent,
  CouponValidationFailedEvent,
} from '../../../common/events/event-interfaces';

// Enums
import {
  UserCouponStatus,
  DiscountType,
  ApplicableType,
  ValidityType,
} from '../enums';

/**
 * 쿠폰 비즈니스 로직 서비스
 * 쿠폰 생성, 발급, 사용, 검증 등의 핵심 기능을 제공
 */
@Injectable()
export class CouponService implements OnModuleInit {
  private readonly logger = new Logger(CouponService.name);

  constructor(
    private readonly couponRepository: CouponRepository,
    private readonly userCouponRepository: UserCouponRepository,
    private readonly couponUsageLogRepository: CouponUsageLogRepository,
    private readonly couponEventBus: CouponEventBusService,
    private readonly mainEventBus: EventBusService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 모듈 초기화 시 주문 시스템 이벤트 구독 설정
   */
  async onModuleInit(): Promise<void> {
    await this.setupOrderEventHandlers();
  }

  /**
   * 주문 시스템 이벤트 핸들러 설정
   */
  private async setupOrderEventHandlers(): Promise<void> {
    try {
      // 쿠폰 검증 요청 처리
      await this.mainEventBus.subscribe(
        EventType.COUPON_VALIDATION_REQUESTED,
        this.handleCouponValidationRequested.bind(this),
      );

      // 주문 실패 시 쿠폰 사용 취소 처리
      await this.mainEventBus.subscribe(
        EventType.ORDER_FAILED,
        this.handleOrderFailed.bind(this),
      );

      // 주문 완료 시 쿠폰 사용 확정 처리 (필요시)
      await this.mainEventBus.subscribe(
        EventType.ORDER_COMPLETED,
        this.handleOrderCompleted.bind(this),
      );

      this.logger.log('주문 시스템 이벤트 핸들러 설정 완료');
    } catch (error) {
      this.logger.error('주문 시스템 이벤트 핸들러 설정 실패:', error);
    }
  }

  /**
   * 쿠폰 검증 요청 이벤트 핸들러
   */
  private async handleCouponValidationRequested(
    eventData: CouponValidationRequestedEvent,
  ): Promise<void> {
    const { orderId, userId, itemId, quantity, totalAmount, userCouponId } =
      eventData;

    try {
      this.logger.log(
        `쿠폰 검증 요청 처리 시작: ${userCouponId}, 주문: ${orderId}`,
      );

      // 사용자 쿠폰 조회 및 검증
      const userCoupon =
        await this.userCouponRepository.findByIdWithRelations(userCouponId);
      if (!userCoupon) {
        throw new NotFoundException('사용자 쿠폰을 찾을 수 없습니다.');
      }

      // 쿠폰 사용 가능 여부 검증
      this.validateCouponForUse(userCoupon, totalAmount, [itemId]);

      // 할인 금액 계산
      const discountAmount = userCoupon.coupon.calculateDiscount(totalAmount);
      const finalAmount = totalAmount - discountAmount;

      // 쿠폰 검증 성공 이벤트 발행
      const couponValidatedEvent: CouponValidatedEvent = {
        orderId,
        userId,
        userCouponId,
        discountAmount,
        finalAmount,
        originalAmount: totalAmount,
        couponInfo: {
          id: userCoupon.coupon.id,
          name: userCoupon.coupon.name,
          discountType: userCoupon.coupon.discountType,
          discountValue: userCoupon.coupon.discountValue,
        },
      };

      await this.mainEventBus.publish(
        EventType.COUPON_VALIDATED,
        couponValidatedEvent,
      );
      this.logger.log(
        `쿠폰 검증 성공: ${userCouponId}, 할인금액: ${discountAmount}원`,
      );
    } catch (error) {
      this.logger.error(`쿠폰 검증 실패: ${userCouponId}`, error);

      // 쿠폰 검증 실패 이벤트 발행
      const couponValidationFailedEvent: CouponValidationFailedEvent = {
        orderId,
        userId,
        userCouponId,
        errors: [error.message],
        reason:
          error instanceof BadRequestException ||
          error instanceof NotFoundException
            ? error.message
            : '쿠폰 검증 중 오류가 발생했습니다.',
      };

      await this.mainEventBus.publish(
        EventType.COUPON_VALIDATION_FAILED,
        couponValidationFailedEvent,
      );
    }
  }

  /**
   * 주문 실패 이벤트 핸들러 - 쿠폰 사용 취소
   */
  private async handleOrderFailed(eventData: any): Promise<void> {
    const { orderId, userId, userCouponId, reason } = eventData;

    if (!userCouponId) {
      // 쿠폰을 사용하지 않은 주문이므로 처리할 것이 없음
      return;
    }

    try {
      this.logger.log(
        `주문 실패로 인한 쿠폰 사용 취소 시작: ${userCouponId}, 주문: ${orderId}`,
      );

      await this.cancelCouponUsage(userCouponId, orderId, reason);

      this.logger.log(`주문 실패로 인한 쿠폰 사용 취소 완료: ${userCouponId}`);

      // 쿠폰 사용 취소 이벤트 발행
      await this.couponEventBus.publishCouponEvent('usage.cancelled', {
        userCouponId,
        userId,
        orderId,
        reason: `주문 실패: ${reason}`,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `주문 실패 시 쿠폰 사용 취소 실패: ${userCouponId}`,
        error,
      );

      // 쿠폰 취소 실패 알림 이벤트 발행 (수동 처리 필요)
      await this.couponEventBus.publishCouponEvent('usage.cancel.failed', {
        userCouponId,
        userId,
        orderId,
        reason: `취소 실패: ${error.message}`,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 주문 완료 이벤트 핸들러 - 쿠폰 사용 확정
   */
  private async handleOrderCompleted(eventData: any): Promise<void> {
    const { orderId, userId, userCouponId, finalAmount } = eventData;

    if (!userCouponId) {
      // 쿠폰을 사용하지 않은 주문이므로 처리할 것이 없음
      return;
    }

    try {
      this.logger.log(
        `주문 완료로 인한 쿠폰 사용 확정: ${userCouponId}, 주문: ${orderId}`,
      );

      // 쿠폰 사용 확정 로그 업데이트 (필요시)
      const usageLog =
        await this.couponUsageLogRepository.findByUserCouponAndOrder(
          userCouponId,
          orderId,
        );

      if (usageLog) {
        usageLog.confirmUsage();
        await this.couponUsageLogRepository.save(usageLog);
      }

      // 쿠폰 사용 확정 이벤트 발행
      await this.couponEventBus.publishCouponEvent('usage.confirmed', {
        userCouponId,
        userId,
        orderId,
        finalAmount,
        timestamp: new Date(),
      });

      this.logger.log(`주문 완료로 인한 쿠폰 사용 확정 완료: ${userCouponId}`);
    } catch (error) {
      this.logger.error(
        `주문 완료 시 쿠폰 사용 확정 실패: ${userCouponId}`,
        error,
      );
    }
  }

  /**
   * 쿠폰 생성 (관리자)
   */
  async createCoupon(couponData: {
    name: string;
    description?: string;
    discountType: DiscountType;
    discountValue: number;
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    applicableType: ApplicableType;
    applicableTargetIds?: string[];
    totalQuantity: number;
    validityType: ValidityType;
    validityDays?: number;
    validFrom?: Date;
    validUntil?: Date;
    createdBy: string;
  }): Promise<Coupon> {
    try {
      this.logger.log(`쿠폰 생성 시작: ${couponData.name}`);

      // 입력값 검증
      this.validateCouponData(couponData);

      // applicableTargetIds 배열을 JSON 문자열로 변환
      const couponDataForDb = {
        ...couponData,
        applicableTargetIds: couponData.applicableTargetIds
          ? JSON.stringify(couponData.applicableTargetIds)
          : undefined,
      };

      // 쿠폰 생성
      const coupon = await this.couponRepository.create(couponDataForDb);

      // 쿠폰 생성 이벤트 발행
      await this.couponEventBus.publishCouponEvent(
        COUPON_EVENTS.COUPON_CREATED,
        {
          couponId: coupon.id,
          couponName: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          totalQuantity: coupon.totalQuantity,
          createdBy: coupon.createdBy,
          createdAt: coupon.createdAt,
        },
      );

      this.logger.log(`쿠폰 생성 완료: ${coupon.id}`);
      return coupon;
    } catch (error) {
      this.logger.error('쿠폰 생성 실패', error);
      throw error;
    }
  }

  /**
   * 쿠폰 발급 (사용자에게)
   */
  async issueCoupon(couponId: string, userId: string): Promise<UserCoupon> {
    return this.dataSource.transaction(async () => {
      try {
        this.logger.log(`쿠폰 발급 시작: ${couponId} → ${userId}`);

        // 쿠폰 조회 및 검증
        const coupon = await this.couponRepository.findById(couponId);
        if (!coupon) {
          throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
        }

        // 쿠폰 발급 가능 여부 검증
        this.validateCouponForIssue(coupon);

        // 중복 발급 체크
        const existingUserCoupon =
          await this.userCouponRepository.findUserCoupon(userId, couponId);
        if (existingUserCoupon) {
          throw new BadRequestException('이미 발급받은 쿠폰입니다.');
        }

        // 만료일 계산
        const expiresAt = coupon.calculateExpiryDate();

        // 사용자 쿠폰 생성
        const userCoupon = await this.userCouponRepository.issueCoupon(
          userId,
          couponId,
          expiresAt,
        );

        // 쿠폰 사용량 증가
        await this.couponRepository.incrementUsedQuantity(couponId);

        // 쿠폰 발급 이벤트 발행
        await this.couponEventBus.publishCouponEvent(
          COUPON_EVENTS.COUPON_ISSUED,
          {
            couponId,
            userId,
            userCouponId: userCoupon.id,
            issuedAt: userCoupon.createdAt,
            expiresAt: userCoupon.expiresAt,
          },
        );

        // 재고 부족 경고 확인
        await this.checkAndNotifyLowStock(coupon);

        this.logger.log(`쿠폰 발급 완료: ${userCoupon.id}`);
        return userCoupon;
      } catch (error) {
        this.logger.error(`쿠폰 발급 실패: ${couponId} → ${userId}`, error);
        throw error;
      }
    });
  }

  /**
   * 쿠폰 사용 (주문에 적용)
   */
  async useCoupon(
    userCouponId: string,
    orderId: string,
    orderAmount: number,
    targetIds: string[] = [],
  ): Promise<{
    discountAmount: number;
    finalAmount: number;
    usageLog: CouponUsageLog;
  }> {
    return this.dataSource.transaction(async () => {
      try {
        this.logger.log(`쿠폰 사용 시작: ${userCouponId} → 주문 ${orderId}`);

        // 사용자 쿠폰 조회
        const userCoupon =
          await this.userCouponRepository.findByIdWithRelations(userCouponId);
        if (!userCoupon) {
          throw new NotFoundException('사용자 쿠폰을 찾을 수 없습니다.');
        }

        // 쿠폰 사용 가능 여부 검증
        this.validateCouponForUse(userCoupon, orderAmount, targetIds);

        // 할인 금액 계산
        const discountAmount = userCoupon.coupon.calculateDiscount(orderAmount);
        const finalAmount = orderAmount - discountAmount;

        // 사용자 쿠폰 상태 변경
        await this.userCouponRepository.markAsUsed(userCouponId, orderId);

        // 사용 로그 생성
        const usageLog = await this.couponUsageLogRepository.createUsageLog(
          userCouponId,
          orderId,
          discountAmount,
          orderAmount,
        );

        // 쿠폰 사용 이벤트 발행
        await this.couponEventBus.publishCouponEvent(
          COUPON_EVENTS.COUPON_USED,
          {
            userCouponId,
            couponId: userCoupon.couponId,
            userId: userCoupon.userId,
            orderId,
            discountAmount,
            originalAmount: orderAmount,
            usedAt: new Date(),
          },
        );

        this.logger.log(`쿠폰 사용 완료: 할인금액 ${discountAmount}원`);
        return { discountAmount, finalAmount, usageLog };
      } catch (error) {
        this.logger.error(`쿠폰 사용 실패: ${userCouponId}`, error);
        throw error;
      }
    });
  }

  /**
   * 쿠폰 사용 취소 (주문 취소 시)
   */
  async cancelCouponUsage(
    userCouponId: string,
    orderId: string,
    reason: string,
  ): Promise<void> {
    return this.dataSource.transaction(async () => {
      try {
        this.logger.log(
          `쿠폰 사용 취소 시작: ${userCouponId} → 주문 ${orderId}`,
        );

        // 사용자 쿠폰 조회
        const userCoupon =
          await this.userCouponRepository.findById(userCouponId);
        if (!userCoupon) {
          throw new NotFoundException('사용자 쿠폰을 찾을 수 없습니다.');
        }

        // 사용 상태 검증
        if (
          userCoupon.status !== UserCouponStatus.USED ||
          userCoupon.usedInOrderId !== orderId
        ) {
          throw new BadRequestException(
            '취소할 수 있는 쿠폰 사용 내역이 아닙니다.',
          );
        }

        // 사용자 쿠폰 상태 복원
        await this.userCouponRepository.markAsActive(userCouponId);

        // 쿠폰 사용량 감소
        await this.couponRepository.decrementUsedQuantity(userCoupon.couponId);

        // 쿠폰 사용 취소 이벤트 발행
        await this.couponEventBus.publishCouponEvent(
          COUPON_EVENTS.COUPON_USAGE_CANCELLED,
          {
            userCouponId,
            couponId: userCoupon.couponId,
            userId: userCoupon.userId,
            orderId,
            cancelledAt: new Date(),
            reason,
          },
        );

        this.logger.log(`쿠폰 사용 취소 완료: ${userCouponId}`);
      } catch (error) {
        this.logger.error(`쿠폰 사용 취소 실패: ${userCouponId}`, error);
        throw error;
      }
    });
  }

  /**
   * 사용자의 사용 가능한 쿠폰 목록 조회
   */
  async getUserAvailableCoupons(userId: string): Promise<UserCoupon[]> {
    try {
      return await this.userCouponRepository.findActiveByUserId(userId);
    } catch (error) {
      this.logger.error(`사용자 쿠폰 조회 실패: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 특정 주문에 적용 가능한 쿠폰 목록 조회
   */
  async getApplicableCoupons(
    userId: string,
    orderAmount: number,
    targetIds: string[] = [],
  ): Promise<UserCoupon[]> {
    try {
      return await this.userCouponRepository.findApplicableForOrder(
        userId,
        orderAmount,
        targetIds,
      );
    } catch (error) {
      this.logger.error(`적용 가능 쿠폰 조회 실패: ${userId}`, error);
      throw error;
    }
  }

  /**
   * 쿠폰 데이터 검증
   */
  private validateCouponData(data: any): void {
    if (data.discountValue <= 0) {
      throw new BadRequestException('할인값은 0보다 커야 합니다.');
    }

    if (
      data.discountType === DiscountType.PERCENTAGE &&
      data.discountValue > 100
    ) {
      throw new BadRequestException('정률 할인은 100%를 초과할 수 없습니다.');
    }

    if (data.totalQuantity < 0) {
      throw new BadRequestException('총 수량은 0 이상이어야 합니다.');
    }

    if (
      data.validityType === ValidityType.RELATIVE &&
      (!data.validityDays || data.validityDays <= 0)
    ) {
      throw new BadRequestException(
        '상대적 유효기간에는 유효 일수가 필요합니다.',
      );
    }

    if (
      data.validityType === ValidityType.ABSOLUTE &&
      (!data.validFrom || !data.validUntil)
    ) {
      throw new BadRequestException(
        '절대적 유효기간에는 시작일과 종료일이 필요합니다.',
      );
    }
  }

  /**
   * 쿠폰 발급 가능 여부 검증
   */
  private validateCouponForIssue(coupon: Coupon): void {
    if (!coupon.isCurrentlyValid()) {
      throw new BadRequestException('현재 발급할 수 없는 쿠폰입니다.');
    }

    if (!coupon.hasStock()) {
      throw new BadRequestException('쿠폰 재고가 부족합니다.');
    }
  }

  /**
   * 쿠폰 사용 가능 여부 검증
   */
  private validateCouponForUse(
    userCoupon: UserCoupon,
    orderAmount: number,
    targetIds: string[],
  ): void {
    if (!userCoupon.isUsable()) {
      throw new BadRequestException('사용할 수 없는 쿠폰입니다.');
    }

    if (!userCoupon.coupon.meetsMinOrderAmount(orderAmount)) {
      throw new BadRequestException(
        `최소 주문 금액 ${userCoupon.coupon.minOrderAmount}원을 만족하지 않습니다.`,
      );
    }

    if (!userCoupon.coupon.isApplicableTo(targetIds)) {
      throw new BadRequestException(
        '해당 상품/카테고리에 적용할 수 없는 쿠폰입니다.',
      );
    }
  }

  /**
   * 재고 부족 경고 확인 및 알림
   */
  private async checkAndNotifyLowStock(coupon: Coupon): Promise<void> {
    const remainingQuantity = coupon.totalQuantity - coupon.usedQuantity;
    const threshold = Math.ceil(coupon.totalQuantity * 0.1); // 10% 임계치

    if (remainingQuantity <= threshold && remainingQuantity > 0) {
      await this.couponEventBus.publishCouponEvent(
        COUPON_EVENTS.COUPON_LOW_STOCK,
        {
          couponId: coupon.id,
          couponName: coupon.name,
          remainingQuantity,
          totalQuantity: coupon.totalQuantity,
          threshold,
        },
      );
    } else if (remainingQuantity === 0) {
      await this.couponEventBus.publishCouponEvent(
        COUPON_EVENTS.COUPON_OUT_OF_STOCK,
        {
          couponId: coupon.id,
          couponName: coupon.name,
          soldOutAt: new Date(),
        },
      );
    }
  }
}
