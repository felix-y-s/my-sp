import { Injectable, Logger } from '@nestjs/common';
import { EventBusService } from '../../infrastructure/redis/event-bus.service';
import { EventType } from '../../common/events/event-types.enum';
import { NotificationEvent } from '../../common/events/event-interfaces';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private eventBus: EventBusService) {
    this.initializeEventHandlers();
  }

  /**
   * Saga 이벤트 핸들러 초기화
   */
  private async initializeEventHandlers(): Promise<void> {
    // 주문 완료 시 성공 알림
    await this.eventBus.subscribe(
      EventType.ORDER_COMPLETED,
      this.handleOrderCompleted.bind(this),
    );

    // 주문 실패 시 실패 알림
    await this.eventBus.subscribe(
      EventType.ORDER_FAILED,
      this.handleOrderFailed.bind(this),
    );

    // 결제 완료 시 결제 알림
    await this.eventBus.subscribe(
      EventType.PAYMENT_PROCESSED,
      this.handlePaymentProcessed.bind(this),
    );

    // 결제 실패 시 결제 실패 알림
    await this.eventBus.subscribe(
      EventType.PAYMENT_FAILED,
      this.handlePaymentFailed.bind(this),
    );
  }

  /**
   * 주문 완료 시 성공 알림 처리
   */
  private async handleOrderCompleted(eventData: any): Promise<void> {
    const { orderId, userId, itemName, totalAmount } = eventData;

    const message =
      `🎉 구매가 완료되었습니다!\n` +
      `- 상품: ${itemName}\n` +
      `- 결제금액: ${totalAmount}원\n` +
      `- 주문번호: ${orderId}`;

    await this.sendNotification({
      orderId,
      userId,
      message,
      type: 'success',
    });

    // 구매 완료 로그
    this.logger.log(
      `🛒 [구매완료] 사용자 ${userId}님이 "${itemName}" 아이템을 ${totalAmount}원에 구매했습니다. (주문: ${orderId})`,
    );
  }

  /**
   * 주문 실패 시 실패 알림 처리
   */
  private async handleOrderFailed(eventData: any): Promise<void> {
    const { orderId, userId, reason, failedStep } = eventData;

    const message =
      `❌ 구매에 실패했습니다.\n` +
      `- 실패 사유: ${reason}\n` +
      `- 실패 단계: ${this.getStepDescription(failedStep)}\n` +
      `- 주문번호: ${orderId}`;

    await this.sendNotification({
      orderId,
      userId,
      message,
      type: 'error',
    });

    // 구매 실패 로그
    this.logger.warn(
      `🚫 [구매실패] 사용자 ${userId}의 주문이 실패했습니다. (주문: ${orderId}, 단계: ${failedStep}, 사유: ${reason})`,
    );
  }

  /**
   * 결제 완료 시 결제 알림 처리
   */
  private async handlePaymentProcessed(eventData: any): Promise<void> {
    const { orderId, userId, paymentAmount, paymentMethod } = eventData;

    const message =
      `💳 결제가 완료되었습니다.\n` +
      `- 결제금액: ${paymentAmount}원\n` +
      `- 결제수단: ${this.getPaymentMethodDescription(paymentMethod)}\n` +
      `- 주문번호: ${orderId}`;

    await this.sendNotification({
      orderId,
      userId,
      message,
      type: 'success',
    });

    // 결제 완료 로그
    this.logger.log(
      `💰 [결제완료] 사용자 ${userId}의 결제가 완료되었습니다. (주문: ${orderId}, 금액: ${paymentAmount}원, 수단: ${paymentMethod})`,
    );
  }

  /**
   * 결제 실패 시 결제 실패 알림 처리
   */
  private async handlePaymentFailed(eventData: any): Promise<void> {
    const { orderId, userId, reason, attemptedAmount } = eventData;

    const message =
      `💸 결제에 실패했습니다.\n` +
      `- 실패 사유: ${reason}\n` +
      `- 시도 금액: ${attemptedAmount}원\n` +
      `- 주문번호: ${orderId}`;

    await this.sendNotification({
      orderId,
      userId,
      message,
      type: 'error',
    });

    // 결제 실패 로그
    this.logger.error(
      `💥 [결제실패] 사용자 ${userId}의 결제가 실패했습니다. (주문: ${orderId}, 금액: ${attemptedAmount}원, 사유: ${reason})`,
    );
  }

  /**
   * 실제 알림 발송 (현재는 로그로 대체)
   */
  private async sendNotification(
    notificationData: NotificationEvent,
  ): Promise<void> {
    const { orderId, userId, message, type } = notificationData;

    try {
      // 실제 환경에서 구현할 알림 채널들:
      // TODO: 푸시 알림 (FCM, APNS)
      // TODO: 이메일 알림 (SendGrid, AWS SES)
      // TODO: SMS 알림 (Twilio, AWS SNS)
      // TODO: 인앱 알림 (WebSocket, Server-Sent Events)
      // TODO: 슬랙/디스코드 알림 (Webhook)

      // 현재는 로그로 알림 대체
      const emoji = this.getNotificationEmoji(type);
      const typeText = this.getNotificationTypeText(type);

      this.logger.log(`${emoji} [${typeText}] 사용자 ${userId}에게 알림 발송:`);
      this.logger.log(`${message}`);

      // 알림 발송 완료 이벤트 발행
      await this.eventBus.publish(EventType.NOTIFICATION_SENT, {
        orderId,
        userId,
        message,
        type,
        sentAt: new Date(),
      });

      // 실제 환경에서 추가할 기능:
      // - 알림 히스토리 저장
      // - 사용자별 알림 설정 확인
      // - 알림 발송 실패 시 재시도 로직
      // - 알림 통계 및 분석
    } catch (error) {
      this.logger.error(
        `알림 발송 실패: 사용자 ${userId} | 주문 ${orderId}`,
        error,
      );

      // TODO: 알림 발송 실패 시 Dead Letter Queue로 전송하여 재시도
    }
  }

  /**
   * 실패 단계 설명 변환
   */
  private getStepDescription(step: string): string {
    const descriptions: Record<string, string> = {
      USER_VALIDATION: '사용자 검증',
      INVENTORY_RESERVATION: '인벤토리 예약',
      ITEM_RESERVATION: '아이템 예약',
      PAYMENT_PROCESSING: '결제 처리',
      UNKNOWN: '알 수 없음',
    };

    return descriptions[step] || step;
  }

  /**
   * 결제 수단 설명 변환
   */
  private getPaymentMethodDescription(method: string): string {
    const descriptions: Record<string, string> = {
      credit_card: '신용카드',
      debit_card: '체크카드',
      bank_transfer: '계좌이체',
      digital_wallet: '디지털지갑',
      test: '테스트',
    };

    return descriptions[method] || method;
  }

  /**
   * 알림 타입별 이모지
   */
  private getNotificationEmoji(type: string): string {
    const emojis: Record<string, string> = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
    };

    return emojis[type] || 'ℹ️';
  }

  /**
   * 알림 타입별 텍스트
   */
  private getNotificationTypeText(type: string): string {
    const texts: Record<string, string> = {
      success: '성공알림',
      error: '실패알림',
      warning: '경고알림',
    };

    return texts[type] || '일반알림';
  }

  /**
   * 관리자용 시스템 알림 발송
   */
  async sendSystemNotification(
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' = 'success',
  ): Promise<void> {
    const emoji = this.getNotificationEmoji(type);
    const typeText = this.getNotificationTypeText(type);

    this.logger.log(`${emoji} [시스템${typeText}] ${title}`);
    this.logger.log(`${message}`);
  }

  /**
   * 사용자별 알림 히스토리 조회 (관리자용)
   * TODO: 실제 환경에서는 알림 히스토리 테이블에서 조회
   */
  async getNotificationHistory(userId: string): Promise<any[]> {
    try {
      // Redis에서 사용자별 알림 히스토리 조회 (간단한 구현)
      const historyKey = `notification_history:${userId}`;
      const history = await this.eventBus.getReservation(historyKey);

      return history || [];
    } catch (error) {
      this.logger.error(`알림 히스토리 조회 실패: ${userId}`, error);
      return [];
    }
  }

  /**
   * 테스트용 알림 발송
   */
  async sendTestNotification(userId: string): Promise<void> {
    await this.sendNotification({
      orderId: 'test-order',
      userId,
      message: '테스트 알림입니다.',
      type: 'success',
    });
  }
}
