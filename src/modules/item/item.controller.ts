import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ItemService } from './item.service';
import { ItemReservationService } from './services/item-reservation.service';
import { Item } from './entities/item.entity';
import { ItemReservation } from './entities/item-reservation.entity';
import {
  CreateReservationDto,
  UpdateReservationStatusDto,
} from './dto/create-reservation.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { IsString, IsNumber, IsPositive, Min } from 'class-validator';

export class UpdateStockDto {
  @IsNumber()
  @IsPositive()
  @Min(0)
  newStock: number;

  @IsString()
  reason: string;
}

@Controller('items')
export class ItemController {
  constructor(
    private readonly itemService: ItemService,
    private readonly reservationService: ItemReservationService,
  ) {}

  /**
   * 모든 아이템 조회 (공개 API)
   */
  @Get()
  async findAll(): Promise<Item[]> {
    return this.itemService.findAll();
  }

  /**
   * 특정 아이템 조회 (공개 API)
   */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Item | null> {
    return this.itemService.findOne(id);
  }

  /**
   * 아이템 재고 조회 (공개 API)
   */
  @Get(':id/stock')
  async getStock(@Param('id') id: string): Promise<{ stock: number }> {
    const stock = await this.itemService.getStock(id);
    return { stock };
  }

  /**
   * 아이템 재고 직접 업데이트 (관리자 전용)
   */
  @Post(':id/stock')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  @UseGuards(RolesGuard)
  async updateStock(
    @Param('id') itemId: string,
    @Body(ValidationPipe) updateStockDto: UpdateStockDto,
    @GetUser() user: any, // 실제 환경에서는 User 엔티티 타입 사용
  ): Promise<{ message: string }> {
    const { newStock, reason } = updateStockDto;

    // 사용자 정보 검증
    if (!user?.id || !user?.roles) {
      throw new Error('사용자 정보가 올바르지 않습니다');
    }

    await this.itemService.updateStock(
      itemId,
      newStock,
      user.id,
      reason,
      user.roles,
    );

    return {
      message: `아이템 ${itemId}의 재고가 ${newStock}개로 업데이트되었습니다.`,
    };
  }

  /**
   * 아이템 생성 (관리자 전용)
   */
  @Post()
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  @UseGuards(RolesGuard)
  async createItem(
    @Body() createItemDto: { name: string; price: number; stock?: number },
    @GetUser() user: any,
  ): Promise<Item> {
    const { name, price, stock = 100 } = createItemDto;

    return this.itemService.createItem(name, price, stock);
  }

  /**
   * 예약 현황 조회 (관리자 전용)
   */
  @Get('reservations/stats')
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  @UseGuards(RolesGuard)
  async getReservationStats(): Promise<{
    total: number;
    active: number;
    confirmed: number;
    cancelled: number;
    expired: number;
  }> {
    return this.reservationService.getReservationStats();
  }

  /**
   * 특정 주문의 예약 정보 조회 (관리자 전용)
   */
  @Get('reservations/order/:orderId')
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  @UseGuards(RolesGuard)
  async getReservationsByOrderId(
    @Param('orderId') orderId: string,
  ): Promise<ItemReservation[]> {
    return this.reservationService.findByOrderId(orderId);
  }

  /**
   * 특정 아이템의 활성 예약 조회 (관리자 전용)
   */
  @Get(':id/reservations')
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  @UseGuards(RolesGuard)
  async getActiveReservationsByItemId(
    @Param('id') itemId: string,
  ): Promise<ItemReservation[]> {
    return this.reservationService.findActiveByItemId(itemId);
  }

  /**
   * 예약 상태 수동 업데이트 (관리자 전용)
   */
  @Post('reservations/:id/status')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.INVENTORY_MANAGER)
  @UseGuards(RolesGuard)
  async updateReservationStatus(
    @Param('id') reservationId: string,
    @Body(ValidationPipe) updateStatusDto: UpdateReservationStatusDto,
    @GetUser() user: any,
  ): Promise<{ message: string }> {
    const { status, reason } = updateStatusDto;

    const updatedReservation =
      await this.reservationService.updateReservationStatus(
        reservationId,
        status as any, // 실제로는 enum 검증 필요
        reason,
      );

    if (!updatedReservation) {
      throw new Error('예약 정보를 찾을 수 없습니다');
    }

    return {
      message: `예약 ${reservationId}의 상태가 ${status}로 업데이트되었습니다.`,
    };
  }
}
