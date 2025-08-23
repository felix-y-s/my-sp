import { IsUUID, IsNumber, IsPositive, Min } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  itemId: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity: number;
}
