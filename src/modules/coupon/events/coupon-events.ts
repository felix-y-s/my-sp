/**
 * 쿠폰 도메인 이벤트 타입 정의
 */

/**
 * 쿠폰 발급 이벤트
 */
export interface CouponIssuedEvent {
  couponId: string;
  userId: string;
  userCouponId: string;
  issuedAt: Date;
  expiresAt: Date;
}

/**
 * 쿠폰 사용 이벤트
 */
export interface CouponUsedEvent {
  userCouponId: string;
  couponId: string;
  userId: string;
  orderId: string;
  discountAmount: number;
  originalAmount: number;
  usedAt: Date;
}

/**
 * 쿠폰 사용 취소 이벤트
 */
export interface CouponUsageCancelledEvent {
  userCouponId: string;
  couponId: string;
  userId: string;
  orderId: string;
  cancelledAt: Date;
  reason: string;
}

/**
 * 쿠폰 만료 이벤트
 */
export interface CouponExpiredEvent {
  userCouponId: string;
  couponId: string;
  userId: string;
  expiredAt: Date;
}

/**
 * 쿠폰 재고 부족 경고 이벤트
 */
export interface CouponLowStockEvent {
  couponId: string;
  couponName: string;
  remainingQuantity: number;
  totalQuantity: number;
  threshold: number;
}

/**
 * 쿠폰 재고 소진 이벤트
 */
export interface CouponOutOfStockEvent {
  couponId: string;
  couponName: string;
  soldOutAt: Date;
}

/**
 * 쿠폰 생성 이벤트 (관리자)
 */
export interface CouponCreatedEvent {
  couponId: string;
  couponName: string;
  discountType: string;
  discountValue: number;
  totalQuantity: number;
  createdBy: string;
  createdAt: Date;
}

/**
 * 쿠폰 활성화/비활성화 이벤트
 */
export interface CouponStatusChangedEvent {
  couponId: string;
  couponName: string;
  previousStatus: boolean;
  currentStatus: boolean;
  changedBy: string;
  changedAt: Date;
}

/**
 * 쿠폰 만료 예정 알림 이벤트
 */
export interface CouponExpiringWarningEvent {
  userCouponId: string;
  couponId: string;
  userId: string;
  couponName: string;
  expiresAt: Date;
  daysLeft: number;
}

/**
 * 쿠폰 이벤트 타입 상수
 */
export const COUPON_EVENTS = {
  COUPON_ISSUED: 'coupon.issued',
  COUPON_USED: 'coupon.used',
  COUPON_USAGE_CANCELLED: 'coupon.usage.cancelled',
  COUPON_EXPIRED: 'coupon.expired',
  COUPON_LOW_STOCK: 'coupon.low.stock',
  COUPON_OUT_OF_STOCK: 'coupon.out.of.stock',
  COUPON_CREATED: 'coupon.created',
  COUPON_STATUS_CHANGED: 'coupon.status.changed',
  COUPON_EXPIRING_WARNING: 'coupon.expiring.warning',
} as const;

/**
 * 쿠폰 이벤트 타입 유니온
 */
export type CouponEventType =
  (typeof COUPON_EVENTS)[keyof typeof COUPON_EVENTS];

/**
 * 모든 쿠폰 이벤트 데이터 유니온
 */
export type CouponEventData =
  | CouponIssuedEvent
  | CouponUsedEvent
  | CouponUsageCancelledEvent
  | CouponExpiredEvent
  | CouponLowStockEvent
  | CouponOutOfStockEvent
  | CouponCreatedEvent
  | CouponStatusChangedEvent
  | CouponExpiringWarningEvent;

/**
 * 이벤트 핸들러 인터페이스
 */
export interface CouponEventHandler<T extends CouponEventData> {
  handle(eventData: T): Promise<void>;
}
