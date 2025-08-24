import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserCoupon } from './user-coupon.entity';

@Entity('coupon_usage_logs')
@Index(['usedInOrderId'])
@Index(['usedAt'])
export class CouponUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', comment: '사용자 쿠폰 ID' })
  userCouponId: string;

  @Column({ type: 'uuid', comment: '주문 ID' })
  usedInOrderId: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '실제 적용된 할인 금액',
  })
  discountAmount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '할인 적용 전 원래 주문 금액',
  })
  originalAmount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '할인 적용 후 최종 결제 금액',
  })
  finalAmount: number;

  @CreateDateColumn({ comment: '쿠폰 사용일시' })
  usedAt: Date;

  @Column({ type: 'boolean', default: false, comment: '사용 확정 여부' })
  isConfirmed: boolean;

  // 관계 매핑
  @ManyToOne(() => UserCoupon, (userCoupon) => userCoupon.usageLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userCouponId' })
  userCoupon: UserCoupon;

  /**
   * 할인율 계산 (백분율)
   */
  getDiscountPercentage(): number {
    if (this.originalAmount === 0) {
      return 0;
    }
    return Math.round(
      (Number(this.discountAmount) / Number(this.originalAmount)) * 100,
    );
  }

  /**
   * 할인 금액이 유효한지 확인
   */
  isValidDiscount(): boolean {
    const discount = Number(this.discountAmount);
    const original = Number(this.originalAmount);
    const final = Number(this.finalAmount);

    return (
      discount >= 0 &&
      original > 0 &&
      final >= 0 &&
      Math.abs(original - discount - final) < 0.01 // 부동소수점 오차 고려
    );
  }

  /**
   * 쿠폰 사용 확정 처리
   */
  confirmUsage(): void {
    this.isConfirmed = true;
  }

  /**
   * 사용 로그 생성을 위한 팩토리 메서드
   */
  static create(
    userCouponId: string,
    usedInOrderId: string,
    discountAmount: number,
    originalAmount: number,
  ): CouponUsageLog {
    const log = new CouponUsageLog();
    log.userCouponId = userCouponId;
    log.usedInOrderId = usedInOrderId;
    log.discountAmount = discountAmount;
    log.originalAmount = originalAmount;
    log.finalAmount = originalAmount - discountAmount;
    log.isConfirmed = false;

    return log;
  }
}
