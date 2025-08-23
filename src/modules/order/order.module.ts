import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { Order } from './entities/order.entity';
import { User } from '../user/entities/user.entity';
import { Item } from '../item/entities/item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User, Item])],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}