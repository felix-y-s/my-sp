import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from '../../infrastructure/redis/event-bus.service';
import { EventType } from '../../common/events/event-types.enum';
import {
  PaymentProcessedEvent,
  PaymentFailedEvent,
} from '../../common/events/event-interfaces';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private eventBus: EventBusService,
    private configService: ConfigService,
  ) {
    this.initializeEventHandlers();
  }

  /**
   * Saga 이벤트 핸들러 초기화
   */
  private async initializeEventHandlers(): Promise<void> {
    // 아이템 예약 성공 시 결제 처리 시작
    await this.eventBus.subscribe(
      EventType.ITEM_RESERVED,
      this.handleItemReserved.bind(this),
    );
  }

  /**
   * 아이템 예약 성공 시 결제 처리
   */
  private async handleItemReserved(eventData: any): Promise<void> {
    const { orderId, userId } = eventData;

    try {
      this.logger.log(`결제 처리 시작: 주문 ${orderId} | 사용자 ${userId}`);

      // 결제 처리 시뮬레이션
      const paymentResult = await this.processPayment(orderId, userId);

      if (paymentResult.success) {
        // 결제 성공 이벤트 발행
        const paymentProcessedEvent: PaymentProcessedEvent = {
          orderId,
          userId,
          paymentAmount: paymentResult.amount,
          paymentMethod: paymentResult.method,
        };

        await this.eventBus.publish(
          EventType.PAYMENT_PROCESSED,
          paymentProcessedEvent,
        );
        this.logger.log(
          `결제 처리 완료: 주문 ${orderId} | 금액 ${paymentResult.amount}`,
        );
      } else {
        // 결제 실패 이벤트 발행
        await this.publishPaymentFailed(
          orderId,
          userId,
          paymentResult.reason || '알 수 없는 오류',
          paymentResult.amount,
        );
      }
    } catch (error) {
      this.logger.error(`결제 처리 중 오류: 주문 ${orderId}`, error);
      await this.publishPaymentFailed(
        orderId,
        userId,
        '시스템 오류가 발생했습니다',
        0,
      );
    }
  }

  /**
   * 실제 결제 처리 로직 (모의 구현)
   * 실제 환경에서는 PG사 연동 (Stripe, PayPal, 토스 등)
   */
  private async processPayment(
    orderId: string,
    userId: string,
  ): Promise<{
    success: boolean;
    amount: number;
    method: string;
    reason?: string;
  }> {
    // 결제 정보 조회 (예약된 금액)
    const reservationKey = `balance_reserve:${userId}:${orderId}`;
    const reservation = await this.eventBus.getReservation(reservationKey);

    if (!reservation) {
      return {
        success: false,
        amount: 0,
        method: 'unknown',
        reason: '결제 예약 정보를 찾을 수 없습니다',
      };
    }

    const { amount } = reservation;

    // 결제 처리 시뮬레이션 (랜덤 실패 포함)
    await this.simulatePaymentDelay();

    // 환경 설정 기반 결제 실패 시뮬레이션
    const paymentConfig = this.configService.get('payment');
    const successRate = paymentConfig.successRate || 0.9;
    const shouldFail = Math.random() > successRate;

    if (shouldFail) {
      return {
        success: false,
        amount,
        method: 'credit_card',
        reason: '결제 승인이 거절되었습니다',
      };
    }

    // TODO: 실제 결제 게이트웨이 연동 로직
    // - 결제 요청 생성
    // - PG사 API 호출
    // - 결제 결과 검증
    // - 결제 로그 저장

    this.logger.log(`모의 결제 처리: 주문 ${orderId} | 금액 ${amount}`);

    return {
      success: true,
      amount,
      method: 'credit_card', // 실제로는 사용자가 선택한 결제 수단
    };
  }

  /**
   * 결제 처리 지연 시뮬레이션
   */
  private async simulatePaymentDelay(): Promise<void> {
    // 100ms ~ 2초 사이의 랜덤 지연
    const delay = Math.random() * 1900 + 100;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * 결제 실패 이벤트 발행
   */
  private async publishPaymentFailed(
    orderId: string,
    userId: string,
    reason: string,
    attemptedAmount: number,
  ): Promise<void> {
    const paymentFailedEvent: PaymentFailedEvent = {
      orderId,
      userId,
      reason,
      attemptedAmount,
    };

    await this.eventBus.publish(EventType.PAYMENT_FAILED, paymentFailedEvent);
    this.logger.error(
      `결제 실패: 주문 ${orderId} | 사유: ${reason} | 시도금액: ${attemptedAmount}`,
    );
  }

  /**
   * 결제 상태 조회 (관리자용)
   * TODO: 실제 환경에서는 결제 로그 테이블에서 조회
   */
  async getPaymentStatus(orderId: string): Promise<{
    status: 'pending' | 'completed' | 'failed' | 'unknown';
    amount?: number;
    method?: string;
    processedAt?: Date;
    failureReason?: string;
  }> {
    // 간단한 구현: Redis에서 결제 기록 조회
    try {
      const paymentKey = `payment_result:${orderId}`;
      const result = await this.eventBus.getReservation(paymentKey);

      if (result) {
        return {
          status: result.success ? 'completed' : 'failed',
          amount: result.amount,
          method: result.method,
          processedAt: new Date(result.processedAt),
          failureReason: result.reason,
        };
      }

      return { status: 'unknown' };
    } catch (error) {
      this.logger.error(`결제 상태 조회 실패: ${orderId}`, error);
      return { status: 'unknown' };
    }
  }

  /**
   * 결제 취소/환불 (관리자용)
   * TODO: 실제 환경에서는 PG사 환불 API 호출
   */
  async refundPayment(
    orderId: string,
    reason: string = '관리자 환불',
  ): Promise<boolean> {
    try {
      this.logger.log(`결제 환불 처리: 주문 ${orderId} | 사유: ${reason}`);

      // TODO: 실제 PG사 환불 API 호출
      // TODO: 환불 결과에 따른 사용자 잔고 복원
      // TODO: 인벤토리에서 아이템 제거
      // TODO: 환불 로그 기록

      // 환불 완료 이벤트 발행
      await this.eventBus.publish('payment.refunded', {
        orderId,
        reason,
        refundedAt: new Date(),
      });

      return true;
    } catch (error) {
      this.logger.error(`결제 환불 실패: ${orderId}`, error);
      return false;
    }
  }

  /**
   * 테스트용: 특정 주문의 결제 강제 성공
   */
  async forcePaymentSuccess(orderId: string, userId: string): Promise<void> {
    const paymentProcessedEvent: PaymentProcessedEvent = {
      orderId,
      userId,
      paymentAmount: 1000, // 테스트용 금액
      paymentMethod: 'test',
    };

    await this.eventBus.publish(
      EventType.PAYMENT_PROCESSED,
      paymentProcessedEvent,
    );
    this.logger.log(`결제 강제 성공 처리: 주문 ${orderId}`);
  }

  /**
   * 테스트용: 특정 주문의 결제 강제 실패
   */
  async forcePaymentFailure(
    orderId: string,
    userId: string,
    reason: string = '테스트 실패',
  ): Promise<void> {
    await this.publishPaymentFailed(orderId, userId, reason, 1000);
  }
}
