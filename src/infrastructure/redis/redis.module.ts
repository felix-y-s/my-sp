import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService } from './event-bus.service';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redisConfig = configService.get('redis');
        
        // Redis 연결 설정
        const redis = new Redis({
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: redisConfig.db,
          ...(redisConfig.tls && { tls: {} }),
        });

        redis.on('connect', () => {
          console.log(`Redis 연결 성공: ${redisConfig.host}:${redisConfig.port}`);
        });

        redis.on('error', (err) => {
          console.error('Redis 연결 오류:', err);
        });

        return redis;
      },
      inject: [ConfigService],
    },
    EventBusService,
  ],
  exports: ['REDIS_CLIENT', EventBusService],
})
export class RedisModule {}