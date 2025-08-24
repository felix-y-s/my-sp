import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private subscriber: Redis;
  private eventHandlers = new Map<string, ((data: any) => void)[]>();
  private messageListenerInitialized = false;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    const redisConfig = this.configService.get('redis');

    // 구독 전용 Redis 클라이언트 생성
    this.subscriber = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      ...(redisConfig.tls && { tls: {} }),
    });

    // 단일 message 리스너 초기화
    this.initializeMessageListener();
  }

  /**
   * 단일 message 리스너 초기화 (한 번만 실행)
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
          this.logger.log(`이벤트 수신: ${channel}`, eventData.data);

          // 해당 채널의 모든 핸들러 실행
          handlers.forEach((handler) => {
            try {
              handler(eventData.data);
            } catch (handlerError) {
              this.logger.error(`핸들러 실행 실패: ${channel}`, handlerError);
            }
          });
        } catch (error) {
          this.logger.error(`이벤트 파싱 실패: ${channel}`, error);
        }
      }
    });

    this.messageListenerInitialized = true;
    this.logger.log('EventBus 메시지 리스너 초기화 완료');
  }

  /**
   * 이벤트 발행
   */
  async publish(eventType: string, data: any): Promise<void> {
    try {
      const eventData = JSON.stringify({
        eventType,
        data,
        timestamp: new Date(),
      });

      await this.redis.publish(eventType, eventData);
      this.logger.log(`이벤트 발행: ${eventType}`, data);
    } catch (error) {
      this.logger.error(`이벤트 발행 실패: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * 이벤트 구독
   */
  async subscribe(
    eventType: string,
    handler: (data: any) => void,
  ): Promise<void> {
    try {
      // Redis 채널 구독 (중복 구독은 Redis가 자동으로 처리)
      await this.subscriber.subscribe(eventType);

      // 핸들러를 내부 맵에 등록
      if (!this.eventHandlers.has(eventType)) {
        this.eventHandlers.set(eventType, []);
      }

      const handlers = this.eventHandlers.get(eventType)!;
      handlers.push(handler);

      this.logger.log(
        `이벤트 구독 시작: ${eventType} (핸들러 수: ${handlers.length})`,
      );
    } catch (error) {
      this.logger.error(`이벤트 구독 실패: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * 이벤트 구독 해제
   */
  async unsubscribe(
    eventType: string,
    handler?: (data: any) => void,
  ): Promise<void> {
    try {
      const handlers = this.eventHandlers.get(eventType);
      if (!handlers) {
        this.logger.warn(`구독되지 않은 이벤트 타입: ${eventType}`);
        return;
      }

      if (handler) {
        // 특정 핸들러만 제거
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
          this.logger.log(
            `특정 핸들러 구독 해제: ${eventType} (남은 핸들러: ${handlers.length})`,
          );
        }
      } else {
        // 모든 핸들러 제거
        handlers.length = 0;
        this.logger.log(`모든 핸들러 구독 해제: ${eventType}`);
      }

      // 핸들러가 없으면 Redis 채널 구독도 해제
      if (handlers.length === 0) {
        await this.subscriber.unsubscribe(eventType);
        this.eventHandlers.delete(eventType);
        this.logger.log(`Redis 채널 구독 해제: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(`이벤트 구독 해제 실패: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * 모든 구독 해제 (서비스 종료 시 사용)
   */
  async unsubscribeAll(): Promise<void> {
    try {
      await this.subscriber.unsubscribe();
      this.eventHandlers.clear();
      this.logger.log('모든 이벤트 구독 해제 완료');
    } catch (error) {
      this.logger.error('모든 이벤트 구독 해제 실패', error);
      throw error;
    }
  }

  /**
   * @deprecated Redis 분산 락은 더 이상 사용하지 않음 (DB 트랜잭션으로 대체)
   * 분산 락 구현 (동시성 제어용)
   * TODO: 실제 환경에서는 더 정교한 분산 락 구현 필요
   */
  // async acquireLock(
  //   resource: string,
  //   timeout: number = 5000,
  // ): Promise<boolean> {
  //   const lockKey = `lock:${resource}`;
  //   const lockValue = Date.now().toString();

  //   try {
  //     const result = await this.redis.set(
  //       lockKey,
  //       lockValue,
  //       'PX',
  //       timeout,
  //       'NX',
  //     );
  //     return result === 'OK';
  //   } catch (error) {
  //     this.logger.error(`락 획득 실패: ${resource}`, error);
  //     return false;
  //   }
  // }

  /**
   * @deprecated Redis 분산 락은 더 이상 사용하지 않음 (DB 트랜잭션으로 대체)
   * 분산 락 해제
   */
  // async releaseLock(resource: string): Promise<void> {
  //   const lockKey = `lock:${resource}`;
  //   try {
  //     await this.redis.del(lockKey);
  //   } catch (error) {
  //     this.logger.error(`락 해제 실패: ${resource}`, error);
  //   }
  // }

  /**
   * 임시 상태 저장 (예약 상태 등)
   */
  async setReservation(
    key: string,
    value: any,
    ttl: number = 300,
  ): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`예약 상태 저장 실패: ${key}`, error);
      throw error;
    }
  }

  /**
   * 임시 상태 조회
   */
  async getReservation(key: string): Promise<any> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`예약 상태 조회 실패: ${key}`, error);
      return null;
    }
  }

  /**
   * 임시 상태 삭제
   */
  async deleteReservation(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`예약 상태 삭제 실패: ${key}`, error);
    }
  }
}
