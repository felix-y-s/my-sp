import { Injectable, Logger } from '@nestjs/common';
import {
  CouponEventHandler,
  CouponIssuedEvent,
  CouponUsedEvent,
  CouponExpiredEvent,
  CouponExpiringWarningEvent,
  CouponLowStockEvent,
  CouponOutOfStockEvent,
} from '../coupon-events';

/**
 * 쿠폰 관련 알림 처리 핸들러
 * 쿠폰 이벤트에 대한 사용자 및 관리자 알림을 담당
 */
@Injectable()
export class CouponNotificationHandler implements CouponEventHandler<any> {
  private readonly logger = new Logger(CouponNotificationHandler.name);

  async handle(eventData: any): Promise<void> {
    // 이벤트 타입에 따라 분기 처리
    if (this.isCouponIssuedEvent(eventData)) {
      await this.handleCouponIssued(eventData);
    } else if (this.isCouponUsedEvent(eventData)) {
      await this.handleCouponUsed(eventData);
    } else if (this.isCouponExpiredEvent(eventData)) {
      await this.handleCouponExpired(eventData);
    } else if (this.isCouponExpiringWarningEvent(eventData)) {
      await this.handleCouponExpiringWarning(eventData);
    } else if (this.isCouponLowStockEvent(eventData)) {
      await this.handleCouponLowStock(eventData);
    } else if (this.isCouponOutOfStockEvent(eventData)) {
      await this.handleCouponOutOfStock(eventData);
    }
  }

  /**
   * 쿠폰 발급 알림
   */
  private async handleCouponIssued(event: CouponIssuedEvent): Promise<void> {
    try {
      this.logger.log(`쿠폰 발급 알림 처리: ${event.userCouponId}`);

      // TODO: 실제 알림 서비스 연동
      // await this.notificationService.sendCouponIssuedNotification({
      //   userId: event.userId,
      //   couponId: event.couponId,
      //   expiresAt: event.expiresAt,
      // });

      this.logger.log(
        `쿠폰 발급 알림 완료: 사용자 ${event.userId}에게 쿠폰 ${event.couponId} 발급됨`,
      );
    } catch (error) {
      this.logger.error('쿠폰 발급 알림 실패', error);
    }
  }

  /**
   * 쿠폰 사용 알림
   */
  private async handleCouponUsed(event: CouponUsedEvent): Promise<void> {
    try {
      this.logger.log(`쿠폰 사용 알림 처리: ${event.userCouponId}`);

      // TODO: 실제 알림 서비스 연동
      // await this.notificationService.sendCouponUsedNotification({
      //   userId: event.userId,
      //   orderId: event.orderId,
      //   discountAmount: event.discountAmount,
      // });

      this.logger.log(
        `쿠폰 사용 알림 완료: 사용자 ${event.userId}, 할인금액 ${event.discountAmount}원`,
      );
    } catch (error) {
      this.logger.error('쿠폰 사용 알림 실패', error);
    }
  }

  /**
   * 쿠폰 만료 알림
   */
  private async handleCouponExpired(event: CouponExpiredEvent): Promise<void> {
    try {
      this.logger.log(`쿠폰 만료 알림 처리: ${event.userCouponId}`);

      // TODO: 실제 알림 서비스 연동
      // await this.notificationService.sendCouponExpiredNotification({
      //   userId: event.userId,
      //   couponId: event.couponId,
      //   expiredAt: event.expiredAt,
      // });

      this.logger.log(
        `쿠폰 만료 알림 완료: 사용자 ${event.userId}의 쿠폰 ${event.couponId} 만료됨`,
      );
    } catch (error) {
      this.logger.error('쿠폰 만료 알림 실패', error);
    }
  }

  /**
   * 쿠폰 만료 예정 경고 알림
   */
  private async handleCouponExpiringWarning(
    event: CouponExpiringWarningEvent,
  ): Promise<void> {
    try {
      this.logger.log(`쿠폰 만료 예정 알림 처리: ${event.userCouponId}`);

      // TODO: 실제 알림 서비스 연동
      // await this.notificationService.sendCouponExpiringWarningNotification({
      //   userId: event.userId,
      //   couponName: event.couponName,
      //   expiresAt: event.expiresAt,
      //   daysLeft: event.daysLeft,
      // });

      this.logger.log(
        `쿠폰 만료 예정 알림 완료: 사용자 ${event.userId}, ${event.daysLeft}일 후 만료`,
      );
    } catch (error) {
      this.logger.error('쿠폰 만료 예정 알림 실패', error);
    }
  }

  /**
   * 쿠폰 재고 부족 알림 (관리자용)
   */
  private async handleCouponLowStock(
    event: CouponLowStockEvent,
  ): Promise<void> {
    try {
      this.logger.log(`쿠폰 재고 부족 알림 처리: ${event.couponId}`);

      // TODO: 실제 관리자 알림 서비스 연동
      // await this.adminNotificationService.sendCouponLowStockAlert({
      //   couponId: event.couponId,
      //   couponName: event.couponName,
      //   remainingQuantity: event.remainingQuantity,
      //   totalQuantity: event.totalQuantity,
      // });

      this.logger.log(
        `쿠폰 재고 부족 알림 완료: ${event.couponName}, 잔여 ${event.remainingQuantity}개`,
      );
    } catch (error) {
      this.logger.error('쿠폰 재고 부족 알림 실패', error);
    }
  }

  /**
   * 쿠폰 재고 소진 알림 (관리자용)
   */
  private async handleCouponOutOfStock(
    event: CouponOutOfStockEvent,
  ): Promise<void> {
    try {
      this.logger.log(`쿠폰 재고 소진 알림 처리: ${event.couponId}`);

      // TODO: 실제 관리자 알림 서비스 연동
      // await this.adminNotificationService.sendCouponOutOfStockAlert({
      //   couponId: event.couponId,
      //   couponName: event.couponName,
      //   soldOutAt: event.soldOutAt,
      // });

      this.logger.log(`쿠폰 재고 소진 알림 완료: ${event.couponName} 품절`);
    } catch (error) {
      this.logger.error('쿠폰 재고 소진 알림 실패', error);
    }
  }

  // 타입 가드 함수들
  private isCouponIssuedEvent(data: any): data is CouponIssuedEvent {
    return data && typeof data.userCouponId === 'string' && data.issuedAt;
  }

  private isCouponUsedEvent(data: any): data is CouponUsedEvent {
    return (
      data &&
      typeof data.userCouponId === 'string' &&
      data.usedAt &&
      data.orderId
    );
  }

  private isCouponExpiredEvent(data: any): data is CouponExpiredEvent {
    return data && typeof data.userCouponId === 'string' && data.expiredAt;
  }

  private isCouponExpiringWarningEvent(
    data: any,
  ): data is CouponExpiringWarningEvent {
    return (
      data &&
      typeof data.userCouponId === 'string' &&
      typeof data.daysLeft === 'number'
    );
  }

  private isCouponLowStockEvent(data: any): data is CouponLowStockEvent {
    return (
      data &&
      typeof data.couponId === 'string' &&
      typeof data.remainingQuantity === 'number' &&
      data.threshold
    );
  }

  private isCouponOutOfStockEvent(data: any): data is CouponOutOfStockEvent {
    return data && typeof data.couponId === 'string' && data.soldOutAt;
  }
}
