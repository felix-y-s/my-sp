import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'purchase_saga.db',
      entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
      synchronize: true, // 개발 환경에서만 사용, 프로덕션에서는 migration 사용
      logging: true,
    }),
  ],
})
export class DatabaseModule {}
