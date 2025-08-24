import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Check,
} from 'typeorm';
import { DiscountType, ApplicableType, ValidityType } from '../enums';

@Entity('coupons')
@Check('CHK_discount_value_positive', '"discountValue" > 0')
@Check('CHK_min_order_amount_non_negative', '"minOrderAmount" >= 0')
@Check(
  'CHK_max_discount_amount_positive',
  '"maxDiscountAmount" IS NULL OR "maxDiscountAmount" > 0',
)
@Check(
  'CHK_quantity_non_negative',
  '"totalQuantity" >= 0 AND "usedQuantity" >= 0',
)
@Check('CHK_used_quantity_not_exceed', '"usedQuantity" <= "totalQuantity"')
@Check(
  'CHK_validity_days_positive',
  '"validityDays" IS NULL OR "validityDays" > 0',
)
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, comment: '쿠폰명' })
  name: string;

  @Column({ type: 'text', nullable: true, comment: '쿠폰 설명' })
  description: string;

  @Column({
    type: 'enum',
    enum: DiscountType,
    enumName: 'discount_type_enum',
    
    comment: '할인 타입 (정률/정액)',
  })
  discountType: DiscountType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    comment: '할인값 (퍼센트 또는 금액)',
  })
  discountValue: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    comment: '최소 주문 금액',
  })
  minOrderAmount: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: '최대 할인 금액 (정률 할인 시)',
  })
  maxDiscountAmount: number;

  @Column({
    type: 'enum',
    enum: ApplicableType,
    enumName: 'applicable_type_enum',
    
    comment: '적용 범위 (전체/카테고리/상품)',
  })
  applicableType: ApplicableType;

  @Column({
    type: 'text',
    nullable: true,
    comment: '적용 대상 ID 목록 (카테고리/상품 ID, JSON 형태)',
  })
  applicableTargetIds: string;

  @Column({ default: 0, comment: '총 발급 수량' })
  totalQuantity: number;

  @Column({ default: 0, comment: '사용된 수량' })
  usedQuantity: number;

  @Column({
    type: 'enum',
    enum: ValidityType,
    enumName: 'validity_type_enum',
    
    comment: '유효기간 타입 (상대적/절대적)',
  })
  validityType: ValidityType;

  @Column({ nullable: true, comment: '상대적 유효기간 (일수)' })
  validityDays: number;

  @Column({ 
    type: 'timestamptz', 
    nullable: true, 
    comment: '절대적 유효기간 시작' 
  })
  validFrom: Date;

  @Column({ 
    type: 'timestamptz', 
    nullable: true, 
    comment: '절대적 유효기간 종료' 
  })
  validUntil: Date;

  @Column({ default: true, comment: '활성화 여부' })
  isActive: boolean;

  @Column({ type: 'uuid', comment: '생성자 ID' })
  createdBy: string;

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
  @OneToMany('UserCoupon', 'coupon')
  userCoupons: any[];

  /**
   * 쿠폰이 현재 사용 가능한지 확인
   */
  isCurrentlyValid(): boolean {
    if (!this.isActive) {
      return false;
    }

    const now = new Date();

    // 절대적 유효기간 확인
    if (this.validityType === ValidityType.ABSOLUTE) {
      if (this.validFrom && now < this.validFrom) {
        return false;
      }
      if (this.validUntil && now > this.validUntil) {
        return false;
      }
    }

    // 재고 확인
    return this.hasStock();
  }

  /**
   * 쿠폰 재고가 있는지 확인
   */
  hasStock(): boolean {
    return this.usedQuantity < this.totalQuantity;
  }

  /**
   * 주문 금액이 최소 주문 금액을 만족하는지 확인
   */
  meetsMinOrderAmount(orderAmount: number): boolean {
    return orderAmount >= this.minOrderAmount;
  }

  /**
   * 적용 대상 ID 목록을 배열로 반환
   */
  getApplicableTargetIds(): string[] {
    if (!this.applicableTargetIds) {
      return [];
    }
    try {
      return JSON.parse(this.applicableTargetIds);
    } catch {
      return [];
    }
  }

  /**
   * 적용 대상 ID 목록을 JSON 문자열로 설정
   */
  setApplicableTargetIds(targetIds: string[]): void {
    this.applicableTargetIds = JSON.stringify(targetIds);
  }

  /**
   * 특정 카테고리/상품에 적용 가능한지 확인
   */
  isApplicableTo(targetIds: string[]): boolean {
    if (this.applicableType === ApplicableType.ALL) {
      return true;
    }

    const applicableIds = this.getApplicableTargetIds();
    if (applicableIds.length === 0) {
      return false;
    }

    // 대상 ID 중 하나라도 쿠폰 적용 대상에 포함되면 적용 가능
    return targetIds.some((targetId) => applicableIds.includes(targetId));
  }

  /**
   * 할인 금액 계산
   */
  calculateDiscount(orderAmount: number): number {
    if (this.discountType === DiscountType.PERCENTAGE) {
      const discountAmount = (orderAmount * this.discountValue) / 100;

      // 최대 할인 금액 제한 적용
      if (this.maxDiscountAmount && discountAmount > this.maxDiscountAmount) {
        return this.maxDiscountAmount;
      }

      return Math.round(discountAmount);
    } else {
      // 정액 할인
      return Math.min(this.discountValue, orderAmount);
    }
  }

  /**
   * 특정 사용자의 쿠폰 만료일 계산 (상대적 유효기간인 경우)
   */
  calculateExpiryDate(issuedAt: Date = new Date()): Date {
    if (this.validityType === ValidityType.RELATIVE && this.validityDays) {
      const expiryDate = new Date(issuedAt);
      expiryDate.setDate(expiryDate.getDate() + this.validityDays);
      return expiryDate;
    } else if (this.validityType === ValidityType.ABSOLUTE && this.validUntil) {
      return new Date(this.validUntil);
    }

    // 기본값: 30일 후
    const defaultExpiry = new Date(issuedAt);
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    return defaultExpiry;
  }

  /**
   * 쿠폰 사용량 증가
   */
  increaseUsedQuantity(): void {
    if (this.usedQuantity >= this.totalQuantity) {
      throw new Error('쿠폰 재고가 부족합니다.');
    }
    this.usedQuantity += 1;
  }

  /**
   * 쿠폰 사용량 감소 (취소 시)
   */
  decreaseUsedQuantity(): void {
    if (this.usedQuantity <= 0) {
      throw new Error('사용량을 더 이상 감소시킬 수 없습니다.');
    }
    this.usedQuantity -= 1;
  }

  /**
   * 쿠폰 비활성화
   */
  deactivate(): void {
    this.isActive = false;
  }

  /**
   * 쿠폰 활성화
   */
  activate(): void {
    this.isActive = true;
  }
}
