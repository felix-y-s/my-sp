import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ReservationStatus {
  RESERVED = 'RESERVED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Entity('item_reservations')
@Index(['orderId'])
@Index(['itemId', 'status'])
@Index(['status', 'expiresAt'])
export class ItemReservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ comment: '주문 ID' })
  orderId: string;

  @Column({ comment: '아이템 ID' })
  itemId: string;

  @Column({ comment: '사용자 ID' })
  userId: string;

  @Column('int', { comment: '예약 수량' })
  reservedQuantity: number;

  @Column('int', { comment: '예약 당시 원본 재고' })
  originalStock: number;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.RESERVED,
    comment: '예약 상태',
  })
  status: ReservationStatus;

  @CreateDateColumn({ comment: '예약 생성 시간' })
  reservedAt: Date;

  @Column({ type: 'timestamp', comment: '만료 시간 (TTL)' })
  expiresAt: Date;

  @Column({ nullable: true, comment: '취소/만료 사유' })
  cancelReason?: string;

  /**
   * 예약이 활성 상태인지 확인
   */
  isActive(): boolean {
    return (
      this.status === ReservationStatus.RESERVED && this.expiresAt > new Date()
    );
  }

  /**
   * 예약이 만료되었는지 확인
   */
  isExpired(): boolean {
    return this.expiresAt <= new Date();
  }

  /**
   * 예약 만료 처리
   */
  expire(reason: string = '시간 만료'): void {
    this.status = ReservationStatus.EXPIRED;
    this.cancelReason = reason;
  }

  /**
   * 예약 취소 처리
   */
  cancel(reason: string): void {
    this.status = ReservationStatus.CANCELLED;
    this.cancelReason = reason;
  }

  /**
   * 예약 확정 처리
   */
  confirm(): void {
    this.status = ReservationStatus.CONFIRMED;
  }
}
