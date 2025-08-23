import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './entities/item.entity';
import { EventBusService } from '../../infrastructure/redis/event-bus.service';
import { EventType } from '../../common/events/event-types.enum';
import { 
  ItemReservedEvent, 
  ItemRestoredEvent 
} from '../../common/events/event-interfaces';

@Injectable()
export class ItemService {
  private readonly logger = new Logger(ItemService.name);

  constructor(
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    private eventBus: EventBusService,
  ) {
    this.initializeEventHandlers();
  }

  /**
   * Saga 이벤트 핸들러 초기화
   */
  private async initializeEventHandlers(): Promise<void> {
    // 인벤토리 예약 성공 시 아이템 재고 예약
    await this.eventBus.subscribe(EventType.INVENTORY_RESERVED, 
      this.handleInventoryReserved.bind(this));
    
    // 결제 실패 시 아이템 재고 복원
    await this.eventBus.subscribe(EventType.PAYMENT_FAILED, 
      this.handlePaymentFailed.bind(this));
  }

  /**
   * 인벤토리 예약 성공 시 아이템 재고 예약
   */
  private async handleInventoryReserved(eventData: any): Promise<void> {
    const { orderId, userId, itemId } = eventData;
    const quantity = eventData.quantity || 1; // Order에서 전달되지 않은 경우를 위한 기본값
    
    try {
      // 분산 락 획득 (동시성 제어)
      const lockKey = `item_stock:${itemId}`;
      const lockAcquired = await this.eventBus.acquireLock(lockKey, 5000);
      
      if (!lockAcquired) {
        await this.publishReservationFailed(orderId, userId, itemId, '동시 처리 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      try {
        // 1. 아이템 조회 및 검증
        const item = await this.itemRepository.findOne({ where: { id: itemId } });
        if (!item) {
          await this.publishReservationFailed(orderId, userId, itemId, '아이템을 찾을 수 없습니다');
          return;
        }

        if (!item.isAvailableForSale()) {
          await this.publishReservationFailed(orderId, userId, itemId, '판매 중단된 아이템입니다');
          return;
        }

        if (!item.hasStock(quantity)) {
          await this.publishReservationFailed(orderId, userId, itemId, `재고가 부족합니다. (필요: ${quantity}, 재고: ${item.stock})`);
          return;
        }

        // 2. 재고 예약 (Redis에 임시 저장)
        const reservationKey = `item_reserve:${itemId}:${orderId}`;
        await this.eventBus.setReservation(reservationKey, {
          itemId,
          orderId,
          userId,
          quantity,
          originalStock: item.stock,
        }, 300); // 5분 TTL

        // 3. 실제 재고 차감 (예약 처리)
        item.stock -= quantity;
        await this.itemRepository.save(item);

        // 4. 아이템 예약 완료 이벤트 발행
        const itemReservedEvent: ItemReservedEvent = {
          orderId,
          userId,
          itemId,
          reservedQuantity: quantity,
          remainingStock: item.stock,
        };

        await this.eventBus.publish(EventType.ITEM_RESERVED, itemReservedEvent);
        this.logger.log(`아이템 재고 예약 완료: ${itemId} | 주문: ${orderId} | 예약수량: ${quantity} | 남은재고: ${item.stock}`);

      } finally {
        // 분산 락 해제
        await this.eventBus.releaseLock(lockKey);
      }

    } catch (error) {
      this.logger.error(`아이템 재고 예약 실패: ${itemId} | 주문: ${orderId}`, error);
      await this.publishReservationFailed(orderId, userId, itemId, '시스템 오류가 발생했습니다');
    }
  }

  /**
   * 결제 실패 시 아이템 재고 복원
   */
  private async handlePaymentFailed(eventData: any): Promise<void> {
    const { orderId, userId } = eventData;
    
    try {
      // 모든 예약 키 패턴으로 검색 (실제로는 orderId로 매핑 테이블을 관리하는 것이 좋음)
      // TODO: 실제 환경에서는 예약 정보를 별도 테이블로 관리 필요
      this.logger.log(`결제 실패로 인한 아이템 재고 복원 시도: 주문 ${orderId}`);
      
      // 여기서는 간단하게 구현. 실제로는 예약 정보를 추적할 별도 로직이 필요
      await this.restoreItemStock(orderId, userId, '결제 실패');

    } catch (error) {
      this.logger.error(`아이템 재고 복원 실패: 주문 ${orderId}`, error);
    }
  }

  /**
   * 아이템 재고 복원 (보상 트랜잭션)
   */
  private async restoreItemStock(orderId: string, userId: string, reason: string): Promise<void> {
    try {
      // 예약 정보 검색을 위한 패턴 매칭 (Redis scan 사용)
      // TODO: 실제 환경에서는 예약 정보 매핑 테이블 사용 권장
      const reservationPattern = `item_reserve:*:${orderId}`;
      
      // 간단한 구현을 위해 직접 키 구성 (실제로는 매핑 테이블 필요)
      // 여기서는 임시로 orderId 기반으로 복원 로직 구현
      this.logger.log(`아이템 재고 복원 처리: 주문 ${orderId} | 사유: ${reason}`);

    } catch (error) {
      this.logger.error(`아이템 재고 복원 중 오류: 주문 ${orderId}`, error);
    }
  }

  /**
   * 아이템 예약 실패 이벤트 발행
   */
  private async publishReservationFailed(orderId: string, userId: string, itemId: string, reason: string): Promise<void> {
    await this.eventBus.publish(EventType.ITEM_RESERVATION_FAILED, {
      orderId,
      userId,
      itemId,
      reason,
    });
    this.logger.warn(`아이템 예약 실패: ${itemId} | 주문: ${orderId} | 사유: ${reason}`);
  }

  /**
   * 아이템 생성 (테스트용)
   */
  async createItem(name: string, price: number, stock: number = 100): Promise<Item> {
    const item = this.itemRepository.create({
      name,
      description: `${name} 상품 설명`,
      price,
      stock,
      isActive: true,
    });
    
    return this.itemRepository.save(item);
  }

  /**
   * 아이템 조회
   */
  async findOne(id: string): Promise<Item | null> {
    return this.itemRepository.findOne({ where: { id } });
  }

  /**
   * 모든 아이템 조회
   */
  async findAll(): Promise<Item[]> {
    return this.itemRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * 아이템 재고 조회
   */
  async getStock(itemId: string): Promise<number> {
    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    return item ? item.stock : 0;
  }

  /**
   * 재고 직접 업데이트 (관리자용)
   * TODO: 실제 환경에서는 권한 검증 필요
   */
  async updateStock(itemId: string, newStock: number): Promise<void> {
    await this.itemRepository.update(itemId, { stock: newStock });
    this.logger.log(`아이템 재고 업데이트: ${itemId} -> ${newStock}`);
  }
}