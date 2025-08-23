import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ItemService } from './item.service';
import { ItemReservationService } from './services/item-reservation.service';
import { ItemController } from './item.controller';
import { Item } from './entities/item.entity';
import { ItemReservation } from './entities/item-reservation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item, ItemReservation]),
    ScheduleModule.forRoot(),
  ],
  controllers: [ItemController],
  providers: [ItemService, ItemReservationService],
  exports: [ItemService, ItemReservationService],
})
export class ItemModule {}
