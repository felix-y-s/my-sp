import { IsString, IsNumber, IsPositive, Min } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  orderId: string;

  @IsString()
  itemId: string;

  @IsString()
  userId: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  reservedQuantity: number;

  @IsNumber()
  @Min(0)
  originalStock: number;
}

export class UpdateReservationStatusDto {
  @IsString()
  status: string;

  @IsString()
  reason?: string;
}
