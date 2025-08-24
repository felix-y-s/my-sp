/**
 * 쿠폰 검증 관련 인터페이스 정의
 */

/**
 * 주문 아이템 인터페이스
 */
export interface OrderItem {
  itemId: string;
  categoryId?: string;
  name: string;
  price: number;
  quantity: number;
  totalPrice: number;
}

/**
 * 쿠폰 검증 결과
 */
export interface CouponValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  couponInfo?: {
    id: string;
    name: string;
    discountType: string;
    discountValue: number;
    minOrderAmount: number;
    maxDiscountAmount?: number;
  };
}

/**
 * 할인 계산 결과
 */
export interface DiscountResult {
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  applicableItems: OrderItem[];
  discountDetails: {
    discountType: string;
    discountValue: number;
    calculatedDiscount: number;
    maxDiscountApplied: boolean;
  };
}

/**
 * 쿠폰 적용 결과
 */
export interface CouponApplicationResult {
  success: boolean;
  validation: CouponValidationResult;
  discount?: DiscountResult;
  userCouponId?: string;
  usageLogId?: string;
}

/**
 * 검증 오류 타입
 */
export enum ValidationError {
  COUPON_NOT_FOUND = 'COUPON_NOT_FOUND',
  COUPON_EXPIRED = 'COUPON_EXPIRED',
  COUPON_INACTIVE = 'COUPON_INACTIVE',
  COUPON_OUT_OF_STOCK = 'COUPON_OUT_OF_STOCK',
  USER_COUPON_NOT_FOUND = 'USER_COUPON_NOT_FOUND',
  USER_COUPON_ALREADY_USED = 'USER_COUPON_ALREADY_USED',
  MIN_ORDER_AMOUNT_NOT_MET = 'MIN_ORDER_AMOUNT_NOT_MET',
  NO_APPLICABLE_ITEMS = 'NO_APPLICABLE_ITEMS',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}
