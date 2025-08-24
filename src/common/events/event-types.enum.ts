/**
 * Saga Choreography 패턴에서 사용하는 이벤트 타입 정의
 */
export enum EventType {
  // 주문 관련 이벤트
  ORDER_CREATED = 'order.created',
  ORDER_COMPLETED = 'order.completed',
  ORDER_FAILED = 'order.failed',
  ORDER_CANCELLED = 'order.cancelled',

  // 사용자/결제 관련 이벤트
  USER_VALIDATED = 'user.validated',
  USER_VALIDATION_FAILED = 'user.validation.failed',
  PAYMENT_RESERVED = 'payment.reserved',
  PAYMENT_RESERVATION_FAILED = 'payment.reservation.failed',
  PAYMENT_CONFIRMED = 'payment.confirmed',
  PAYMENT_ROLLBACK = 'payment.rollback',

  // 인벤토리 관련 이벤트
  INVENTORY_RESERVED = 'inventory.reserved',
  INVENTORY_RESERVATION_FAILED = 'inventory.reservation.failed',
  INVENTORY_CONFIRMED = 'inventory.confirmed',
  INVENTORY_ROLLBACK = 'inventory.rollback',

  // 아이템 관련 이벤트
  ITEM_RESERVED = 'item.reserved',
  ITEM_RESERVATION_FAILED = 'item.reservation.failed',
  ITEM_DEDUCTED = 'item.deducted',
  ITEM_RESTORED = 'item.restored',

  // 결제 처리 이벤트
  PAYMENT_PROCESSED = 'payment.processed',
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',

  // 알림 관련 이벤트
  NOTIFICATION_SENT = 'notification.sent',

  // 쿠폰 관련 이벤트 (Saga 플로우 통합)
  COUPON_VALIDATION_REQUESTED = 'coupon.validation.requested',
  COUPON_VALIDATED = 'coupon.validated',
  COUPON_VALIDATION_FAILED = 'coupon.validation.failed',
}
