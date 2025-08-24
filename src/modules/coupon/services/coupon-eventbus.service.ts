import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * 쿠폰 전용 EventBus 서비스
 * 기존 EventBusService와 독립적으로 동작하는 쿠폰 도메인 전용 이벤트 시스템
 */
@Injectable()
export class CouponEventBusService {
  private readonly logger = new Logger(CouponEventBusService.name);
  private publisher: Redis;
  private subscriber: Redis;
  private eventHandlers = new Map<string, ((data: any) => void)[]>();
  private messageListenerInitialized = false;

  constructor(private readonly configService: ConfigService) {
    const redisConfig = this.configService.get('redis');

    // 쿠폰 전용 Redis 클라이언트 - DB 2를 사용 (기본 시스템은 DB 0)
    const couponRedisConfig = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db + 1, // 기존 DB보다 1 증가
      ...(redisConfig.tls && { tls: {} }),
    };

    // 발행 전용 클라이언트
    this.publisher = new Redis(couponRedisConfig);

    // 구독 전용 클라이언트
    this.subscriber = new Redis(couponRedisConfig);

    // 쿠폰 전용 message 리스너 초기화
    this.initializeMessageListener();
  }

  /**
   * 쿠폰 전용 message 리스너 초기화 (한 번만 실행)
   */
  private initializeMessageListener(): void {
    if (this.messageListenerInitialized) {
      return;
    }

    this.subscriber.on('message', (channel, message) => {
      const handlers = this.eventHandlers.get(channel);
      if (handlers && handlers.length > 0) {
        try {
          const eventData = JSON.parse(message);
          this.logger.log(`쿠폰 이벤트 수신: ${channel}`, eventData.data);

          // 해당 채널의 모든 핸들러 실행
          handlers.forEach((handler) => {
            try {
              handler(eventData.data);
            } catch (handlerError) {
              this.logger.error(
                `쿠폰 핸들러 실행 실패: ${channel}`,
                handlerError,
              );
            }
          });
        } catch (error) {
          this.logger.error(`쿠폰 이벤트 파싱 실패: ${channel}`, error);
        }
      }
    });

    this.messageListenerInitialized = true;
    this.logger.log('CouponEventBus 메시지 리스너 초기화 완료');
  }

  /**
   * 쿠폰 이벤트 발행
   */
  async publishCouponEvent(eventType: string, data: any): Promise<void> {
    try {
      const eventData = JSON.stringify({
        eventType,
        data,
        timestamp: new Date(),
        domain: 'coupon', // 쿠폰 도메인 식별자
      });

      const channelName = `coupon.${eventType}`;
      await this.publisher.publish(channelName, eventData);
      this.logger.log(`쿠폰 이벤트 발행: ${channelName}`, data);
    } catch (error) {
      this.logger.error(`쿠폰 이벤트 발행 실패: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * 쿠폰 이벤트 구독
   */
  async subscribeCouponEvent(
    eventType: string,
    handler: (data: any) => void,
  ): Promise<void> {
    try {
      const channelName = `coupon.${eventType}`;

      // Redis 채널 구독
      await this.subscriber.subscribe(channelName);

      // 핸들러를 내부 맵에 등록
      if (!this.eventHandlers.has(channelName)) {
        this.eventHandlers.set(channelName, []);
      }

      const handlers = this.eventHandlers.get(channelName)!;
      handlers.push(handler);

      this.logger.log(
        `쿠폰 이벤트 구독 시작: ${channelName} (핸들러 수: ${handlers.length})`,
      );
    } catch (error) {
      this.logger.error(`쿠폰 이벤트 구독 실패: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * 쿠폰 이벤트 구독 해제
   */
  async unsubscribeCouponEvent(
    eventType: string,
    handler?: (data: any) => void,
  ): Promise<void> {
    try {
      const channelName = `coupon.${eventType}`;
      const handlers = this.eventHandlers.get(channelName);

      if (!handlers) {
        this.logger.warn(`구독되지 않은 쿠폰 이벤트 타입: ${channelName}`);
        return;
      }

      if (handler) {
        // 특정 핸들러만 제거
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
          this.logger.log(
            `특정 쿠폰 핸들러 구독 해제: ${channelName} (남은 핸들러: ${handlers.length})`,
          );
        }
      } else {
        // 모든 핸들러 제거
        handlers.length = 0;
        this.logger.log(`모든 쿠폰 핸들러 구독 해제: ${channelName}`);
      }

      // 핸들러가 없으면 Redis 채널 구독도 해제
      if (handlers.length === 0) {
        await this.subscriber.unsubscribe(channelName);
        this.eventHandlers.delete(channelName);
        this.logger.log(`쿠폰 Redis 채널 구독 해제: ${channelName}`);
      }
    } catch (error) {
      this.logger.error(`쿠폰 이벤트 구독 해제 실패: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * 모든 쿠폰 이벤트 구독 해제 (서비스 종료 시 사용)
   */
  async unsubscribeAllCouponEvents(): Promise<void> {
    try {
      await this.subscriber.unsubscribe();
      this.eventHandlers.clear();
      this.logger.log('모든 쿠폰 이벤트 구독 해제 완료');
    } catch (error) {
      this.logger.error('모든 쿠폰 이벤트 구독 해제 실패', error);
      throw error;
    }
  }

  /**
   * 쿠폰 상태 임시 저장 (예약, 검증 등)
   */
  async setCouponReservation(
    key: string,
    value: any,
    ttl: number = 300, // 5분 기본값
  ): Promise<void> {
    try {
      const reservationKey = `coupon:reservation:${key}`;
      await this.publisher.setex(reservationKey, ttl, JSON.stringify(value));
      this.logger.log(`쿠폰 예약 상태 저장: ${reservationKey}`);
    } catch (error) {
      this.logger.error(`쿠폰 예약 상태 저장 실패: ${key}`, error);
      throw error;
    }
  }

  /**
   * 쿠폰 상태 임시 조회
   */
  async getCouponReservation(key: string): Promise<any> {
    try {
      const reservationKey = `coupon:reservation:${key}`;
      const value = await this.publisher.get(reservationKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`쿠폰 예약 상태 조회 실패: ${key}`, error);
      return null;
    }
  }

  /**
   * 쿠폰 상태 임시 삭제
   */
  async deleteCouponReservation(key: string): Promise<void> {
    try {
      const reservationKey = `coupon:reservation:${key}`;
      await this.publisher.del(reservationKey);
      this.logger.log(`쿠폰 예약 상태 삭제: ${reservationKey}`);
    } catch (error) {
      this.logger.error(`쿠폰 예약 상태 삭제 실패: ${key}`, error);
    }
  }

  /**
   * 쿠폰 사용량 카운터 증가 (동시성 제어용)
   */
  async incrementCouponUsage(couponId: string): Promise<number> {
    try {
      const counterKey = `coupon:usage:${couponId}`;
      const count = await this.publisher.incr(counterKey);
      this.logger.log(`쿠폰 사용량 증가: ${couponId}, 현재 사용량: ${count}`);
      return count;
    } catch (error) {
      this.logger.error(`쿠폰 사용량 증가 실패: ${couponId}`, error);
      throw error;
    }
  }

  /**
   * 쿠폰 사용량 카운터 감소 (롤백용)
   */
  async decrementCouponUsage(couponId: string): Promise<number> {
    try {
      const counterKey = `coupon:usage:${couponId}`;
      const count = await this.publisher.decr(counterKey);
      this.logger.log(`쿠폰 사용량 감소: ${couponId}, 현재 사용량: ${count}`);
      return count;
    } catch (error) {
      this.logger.error(`쿠폰 사용량 감소 실패: ${couponId}`, error);
      throw error;
    }
  }

  /**
   * 쿠폰 사용량 조회
   */
  async getCouponUsage(couponId: string): Promise<number> {
    try {
      const counterKey = `coupon:usage:${couponId}`;
      const count = await this.publisher.get(counterKey);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      this.logger.error(`쿠폰 사용량 조회 실패: ${couponId}`, error);
      return 0;
    }
  }

  /**
   * 연결 종료 (서비스 종료 시)
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.unsubscribeAllCouponEvents();
      await this.publisher.quit();
      await this.subscriber.quit();
      this.logger.log('CouponEventBus 서비스 종료 완료');
    } catch (error) {
      this.logger.error('CouponEventBus 서비스 종료 실패', error);
    }
  }
}
