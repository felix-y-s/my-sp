import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Item } from '../../item/entities/item.entity';

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({
    type: 'varchar',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ type: 'varchar', nullable: true })
  failureReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 관계 설정
  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne(() => Item, (item) => item.orders)
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @Column({ type: 'varchar' })
  itemId: string;

  /**
   * 비즈니스 로직: 주문 상태 변경
   */
  updateStatus(status: OrderStatus, reason?: string): void {
    this.status = status;
    if (reason && status === OrderStatus.FAILED) {
      this.failureReason = reason;
    }
    this.updatedAt = new Date();
  }

  /**
   * 비즈니스 로직: 주문 완료 가능 여부 확인
   */
  canComplete(): boolean {
    return this.status === OrderStatus.CONFIRMED;
  }

  /**
   * 비즈니스 로직: 주문 실패 처리
   */
  markAsFailed(reason: string): void {
    this.status = OrderStatus.FAILED;
    this.failureReason = reason;
    this.updatedAt = new Date();
  }
}
