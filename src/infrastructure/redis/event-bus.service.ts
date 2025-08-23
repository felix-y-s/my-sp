import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private subscriber: Redis;

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
      await this.subscriber.subscribe(eventType);

      this.subscriber.on('message', (channel, message) => {
        if (channel === eventType) {
          try {
            const eventData = JSON.parse(message);
            this.logger.log(`이벤트 수신: ${eventType}`, eventData.data);
            handler(eventData.data);
          } catch (error) {
            this.logger.error(`이벤트 처리 실패: ${eventType}`, error);
          }
        }
      });

      this.logger.log(`이벤트 구독 시작: ${eventType}`);
    } catch (error) {
      this.logger.error(`이벤트 구독 실패: ${eventType}`, error);
      throw error;
    }
  }

  /**
   * 분산 락 구현 (동시성 제어용)
   * TODO: 실제 환경에서는 더 정교한 분산 락 구현 필요
   */
  async acquireLock(
    resource: string,
    timeout: number = 5000,
  ): Promise<boolean> {
    const lockKey = `lock:${resource}`;
    const lockValue = Date.now().toString();

    try {
      const result = await this.redis.set(
        lockKey,
        lockValue,
        'PX',
        timeout,
        'NX',
      );
      return result === 'OK';
    } catch (error) {
      this.logger.error(`락 획득 실패: ${resource}`, error);
      return false;
    }
  }

  /**
   * 분산 락 해제
   */
  async releaseLock(resource: string): Promise<void> {
    const lockKey = `lock:${resource}`;
    try {
      await this.redis.del(lockKey);
    } catch (error) {
      this.logger.error(`락 해제 실패: ${resource}`, error);
    }
  }

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
