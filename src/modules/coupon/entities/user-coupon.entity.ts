import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { UserCouponStatus } from '../enums';
import { Coupon } from './coupon.entity';
import { User } from '../../user/entities/user.entity';
import { CouponUsageLog } from './coupon-usage-log.entity';

@Entity('user_coupons')
@Index(['userId', 'status'])
@Index(['expiresAt'])
export class UserCoupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', comment: '사용자 ID' })
  userId: string;

  @Column({ type: 'uuid', comment: '쿠폰 ID' })
  couponId: string;

  @Column({
    type: 'enum',
    enum: UserCouponStatus,
    enumName: 'user_coupon_status_enum',
    
    default: UserCouponStatus.ACTIVE,
    comment: '쿠폰 상태',
  })
  status: UserCouponStatus;

  @CreateDateColumn({ 
    type: 'timestamptz',
    comment: '쿠폰 발급일시' 
  })
  issuedAt: Date;

  @Column({ 
    type: 'timestamptz', 
    comment: '쿠폰 만료일시' 
  })
  expiresAt: Date;

  @Column({ 
    type: 'timestamptz', 
    nullable: true, 
    comment: '쿠폰 사용일시' 
  })
  usedAt: Date | null;

  @Column({ type: 'uuid', nullable: true, comment: '사용된 주문 ID' })
  usedInOrderId: string | null;

  @CreateDateColumn({ 
    type: 'timestamptz',
    comment: '생성일시' 
  })
  createdAt: Date;

  @UpdateDateColumn({ 
    type: 'timestamptz',
    comment: '수정일시' 
  })
  updatedAt: Date;

  // 관계 매핑
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Coupon, (coupon) => coupon.userCoupons, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;

  @OneToMany(() => CouponUsageLog, (log) => log.userCoupon)
  usageLogs: CouponUsageLog[];

  /**
   * 쿠폰이 현재 사용 가능한지 확인
   */
  isUsable(): boolean {
    if (this.status !== UserCouponStatus.ACTIVE) {
      return false;
    }

    // 만료일 확인
    const now = new Date();
    if (this.expiresAt && now > this.expiresAt) {
      return false;
    }

    return true;
  }

  /**
   * 쿠폰이 만료되었는지 확인
   */
  isExpired(): boolean {
    const now = new Date();
    return this.expiresAt && now > this.expiresAt;
  }

  /**
   * 쿠폰 만료까지 남은 일수 계산
   */
  getDaysUntilExpiry(): number {
    const now = new Date();
    const expiryDate = new Date(this.expiresAt);
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }

  /**
   * 쿠폰이 곧 만료되는지 확인 (기본: 3일 이내)
   */
  isExpiringSoon(warningDays: number = 3): boolean {
    return (
      this.getDaysUntilExpiry() <= warningDays && this.getDaysUntilExpiry() > 0
    );
  }

  /**
   * 쿠폰 사용 처리
   */
  markAsUsed(orderId: string): void {
    if (this.status !== UserCouponStatus.ACTIVE) {
      throw new Error('사용할 수 없는 쿠폰입니다.');
    }

    if (this.isExpired()) {
      throw new Error('만료된 쿠폰입니다.');
    }

    this.status = UserCouponStatus.USED;
    this.usedAt = new Date();
    this.usedInOrderId = orderId;
  }

  /**
   * 쿠폰 사용 취소 (주문 실패 시)
   */
  markAsActive(): void {
    if (this.status !== UserCouponStatus.USED) {
      throw new Error('사용된 쿠폰만 활성화할 수 있습니다.');
    }

    // 만료 확인
    if (this.isExpired()) {
      this.status = UserCouponStatus.EXPIRED;
    } else {
      this.status = UserCouponStatus.ACTIVE;
    }

    this.usedAt = null;
    this.usedInOrderId = null;
  }

  /**
   * 쿠폰 만료 처리
   */
  markAsExpired(): void {
    if (this.status === UserCouponStatus.USED) {
      // 이미 사용된 쿠폰은 만료 처리하지 않음
      return;
    }

    this.status = UserCouponStatus.EXPIRED;
  }

  /**
   * 쿠폰 상태를 문자열로 반환
   */
  getStatusText(): string {
    switch (this.status) {
      case UserCouponStatus.ACTIVE:
        if (this.isExpired()) {
          return '만료됨';
        }
        return '사용 가능';
      case UserCouponStatus.USED:
        return '사용 완료';
      case UserCouponStatus.EXPIRED:
        return '만료됨';
      default:
        return '알 수 없음';
    }
  }

  /**
   * 만료일 표시용 포맷
   */
  getFormattedExpiryDate(): string {
    if (!this.expiresAt) {
      return '';
    }

    return this.expiresAt.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}
