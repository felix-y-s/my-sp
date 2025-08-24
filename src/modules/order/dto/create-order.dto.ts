import { IsUUID, IsNumber, IsPositive, Min, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  itemId: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsUUID()
  userCouponId?: string;
}
