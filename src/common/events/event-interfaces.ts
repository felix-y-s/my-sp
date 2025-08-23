/**
 * Saga 이벤트에서 사용하는 공통 인터페이스 정의
 */

export interface BaseEventData {
  orderId: string;
  userId: string;
  timestamp?: Date;
}

// 주문 관련 이벤트 데이터
export interface OrderCreatedEvent extends BaseEventData {
  itemId: string;
  quantity: number;
  totalAmount: number;
}

export interface OrderCompletedEvent extends BaseEventData {
  itemName: string;
  totalAmount: number;
}

export interface OrderFailedEvent extends BaseEventData {
  reason: string;
  failedStep: string;
}

// 사용자/결제 관련 이벤트 데이터
export interface UserValidatedEvent extends BaseEventData {
  userBalance: number;
  requiredAmount: number;
}

export interface PaymentReservedEvent extends BaseEventData {
  reservedAmount: number;
  remainingBalance: number;
}

export interface PaymentRollbackEvent extends BaseEventData {
  rollbackAmount: number;
  reason: string;
}

// 인벤토리 관련 이벤트 데이터
export interface InventoryReservedEvent extends BaseEventData {
  itemId: string;
  reservedSlots: number;
  availableSlots: number;
}

export interface InventoryRollbackEvent extends BaseEventData {
  itemId: string;
  releasedSlots: number;
  reason: string;
}

// 아이템 관련 이벤트 데이터
export interface ItemReservedEvent extends BaseEventData {
  itemId: string;
  reservedQuantity: number;
  remainingStock: number;
}

export interface ItemRestoredEvent extends BaseEventData {
  itemId: string;
  restoredQuantity: number;
  reason: string;
}

// 결제 처리 관련 이벤트 데이터
export interface PaymentProcessedEvent extends BaseEventData {
  paymentAmount: number;
  paymentMethod: string; // 학습용으로 간단하게
}

export interface PaymentFailedEvent extends BaseEventData {
  reason: string;
  attemptedAmount: number;
}

// 알림 관련 이벤트 데이터
export interface NotificationEvent extends BaseEventData {
  message: string;
  type: 'success' | 'error' | 'warning';
}

/**
 * 이벤트 페이로드 타입 맵핑
 */
export type EventPayload = 
  | OrderCreatedEvent
  | OrderCompletedEvent 
  | OrderFailedEvent
  | UserValidatedEvent
  | PaymentReservedEvent
  | PaymentRollbackEvent
  | InventoryReservedEvent
  | InventoryRollbackEvent
  | ItemReservedEvent
  | ItemRestoredEvent
  | PaymentProcessedEvent
  | PaymentFailedEvent
  | NotificationEvent;