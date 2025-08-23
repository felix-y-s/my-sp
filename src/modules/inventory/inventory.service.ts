import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from './entities/inventory.entity';
import { User } from '../user/entities/user.entity';
import { EventBusService } from '../../infrastructure/redis/event-bus.service';
import { EventType } from '../../common/events/event-types.enum';
import { 
  InventoryReservedEvent, 
  InventoryRollbackEvent 
} from '../../common/events/event-interfaces';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private eventBus: EventBusService,
  ) {
    this.initializeEventHandlers();
  }

  /**
   * Saga 이벤트 핸들러 초기화
   */
  private async initializeEventHandlers(): Promise<void> {
    // 결제 예약 성공 시 인벤토리 공간 예약
    await this.eventBus.subscribe(EventType.PAYMENT_RESERVED, 
      this.handlePaymentReserved.bind(this));
    
    // 아이템 예약 실패 시 인벤토리 예약 롤백
    await this.eventBus.subscribe(EventType.ITEM_RESERVATION_FAILED, 
      this.handleItemReservationFailed.bind(this));
    
    // 결제 실패 시 인벤토리 예약 롤백
    await this.eventBus.subscribe(EventType.PAYMENT_FAILED, 
      this.handlePaymentFailed.bind(this));

    // 결제 성공 시 인벤토리에 아이템 추가
    await this.eventBus.subscribe(EventType.PAYMENT_PROCESSED, 
      this.handlePaymentProcessed.bind(this));
  }

  /**
   * 결제 예약 성공 시 인벤토리 공간 예약
   */
  private async handlePaymentReserved(eventData: any): Promise<void> {
    const { orderId, userId } = eventData;
    // Order 정보에서 itemId와 quantity를 가져와야 함
    // 간단한 구현을 위해 Order 조회 로직 생략하고 eventData에서 직접 사용
    const itemId = eventData.itemId || 'temp-item-id';
    const quantity = eventData.quantity || 1;
    
    try {
      // 분산 락 획득 (동시성 제어)
      const lockKey = `inventory:${userId}`;
      const lockAcquired = await this.eventBus.acquireLock(lockKey, 5000);
      
      if (!lockAcquired) {
        await this.publishReservationFailed(orderId, userId, itemId, '동시 처리 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      try {
        // 1. 사용자 조회
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
          await this.publishReservationFailed(orderId, userId, itemId, '사용자를 찾을 수 없습니다');
          return;
        }

        // 2. 현재 인벤토리 아이템 수 확인
        const currentItemCount = await this.inventoryRepository.count({
          where: { userId }
        });

        if (!user.hasInventorySpace(currentItemCount)) {
          await this.publishReservationFailed(orderId, userId, itemId, '인벤토리 공간이 부족합니다');
          return;
        }

        // 3. 인벤토리 공간 예약 (Redis에 임시 저장)
        const reservationKey = `inventory_reserve:${userId}:${orderId}`;
        await this.eventBus.setReservation(reservationKey, {
          userId,
          orderId,
          itemId,
          quantity,
          reservedAt: new Date(),
        }, 300); // 5분 TTL

        // 4. 인벤토리 예약 완료 이벤트 발행
        const inventoryReservedEvent: InventoryReservedEvent = {
          orderId,
          userId,
          itemId,
          reservedSlots: 1, // 간단한 구현: 1개 아이템 = 1개 슬롯
          availableSlots: user.maxInventorySlots - currentItemCount - 1,
        };

        await this.eventBus.publish(EventType.INVENTORY_RESERVED, inventoryReservedEvent);
        this.logger.log(`인벤토리 공간 예약 완료: ${userId} | 주문: ${orderId} | 아이템: ${itemId}`);

      } finally {
        // 분산 락 해제
        await this.eventBus.releaseLock(lockKey);
      }

    } catch (error) {
      this.logger.error(`인벤토리 공간 예약 실패: ${userId} | 주문: ${orderId}`, error);
      await this.publishReservationFailed(orderId, userId, itemId, '시스템 오류가 발생했습니다');
    }
  }

  /**
   * 아이템 예약 실패 시 인벤토리 예약 롤백
   */
  private async handleItemReservationFailed(eventData: any): Promise<void> {
    await this.rollbackInventoryReservation(eventData, '아이템 예약 실패');
  }

  /**
   * 결제 실패 시 인벤토리 예약 롤백
   */
  private async handlePaymentFailed(eventData: any): Promise<void> {
    await this.rollbackInventoryReservation(eventData, '결제 실패');
  }

  /**
   * 결제 성공 시 인벤토리에 아이템 실제 추가
   */
  private async handlePaymentProcessed(eventData: any): Promise<void> {
    const { orderId, userId } = eventData;
    
    try {
      // 예약 정보 조회
      const reservationKey = `inventory_reserve:${userId}:${orderId}`;
      const reservation = await this.eventBus.getReservation(reservationKey);
      
      if (!reservation) {
        this.logger.warn(`인벤토리 예약 정보를 찾을 수 없습니다: ${reservationKey}`);
        return;
      }

      // 분산 락 획득
      const lockKey = `inventory:${userId}`;
      const lockAcquired = await this.eventBus.acquireLock(lockKey, 5000);
      
      if (!lockAcquired) {
        this.logger.error(`인벤토리 확정 시 락 획득 실패: ${userId}`);
        return;
      }

      try {
        const { itemId, quantity } = reservation;

        // 기존 인벤토리 확인 (같은 아이템이 있는지)
        let inventory = await this.inventoryRepository.findOne({
          where: { userId, itemId }
        });

        if (inventory) {
          // 기존 아이템 수량 증가
          inventory.increaseQuantity(quantity);
        } else {
          // 새 아이템 추가
          inventory = this.inventoryRepository.create({
            userId,
            itemId,
            quantity,
          });
        }

        await this.inventoryRepository.save(inventory);

        // 인벤토리 확정 이벤트 발행
        await this.eventBus.publish(EventType.INVENTORY_CONFIRMED, {
          orderId,
          userId,
          itemId,
          quantity,
        });

        // 예약 정보 삭제
        await this.eventBus.deleteReservation(reservationKey);
        
        this.logger.log(`인벤토리 아이템 추가 완료: ${userId} | 주문: ${orderId} | 아이템: ${itemId} | 수량: ${quantity}`);

      } finally {
        await this.eventBus.releaseLock(lockKey);
      }

    } catch (error) {
      this.logger.error(`인벤토리 아이템 추가 실패: ${userId} | 주문: ${orderId}`, error);
    }
  }

  /**
   * 인벤토리 예약 롤백 (보상 트랜잭션)
   */
  private async rollbackInventoryReservation(eventData: any, reason: string): Promise<void> {
    const { orderId, userId } = eventData;
    
    try {
      // 예약 정보 조회
      const reservationKey = `inventory_reserve:${userId}:${orderId}`;
      const reservation = await this.eventBus.getReservation(reservationKey);
      
      if (!reservation) {
        this.logger.warn(`인벤토리 예약 정보를 찾을 수 없습니다: ${reservationKey}`);
        return;
      }

      // 예약 정보 삭제 (롤백)
      await this.eventBus.deleteReservation(reservationKey);

      // 인벤토리 롤백 이벤트 발행
      const inventoryRollbackEvent: InventoryRollbackEvent = {
        orderId,
        userId,
        itemId: reservation.itemId,
        releasedSlots: 1,
        reason,
      };

      await this.eventBus.publish(EventType.INVENTORY_ROLLBACK, inventoryRollbackEvent);
      this.logger.log(`인벤토리 예약 롤백 완료: ${userId} | 주문: ${orderId} | 사유: ${reason}`);

    } catch (error) {
      this.logger.error(`인벤토리 예약 롤백 실패: ${userId} | 주문: ${orderId}`, error);
    }
  }

  /**
   * 인벤토리 예약 실패 이벤트 발행
   */
  private async publishReservationFailed(orderId: string, userId: string, itemId: string, reason: string): Promise<void> {
    await this.eventBus.publish(EventType.INVENTORY_RESERVATION_FAILED, {
      orderId,
      userId,
      itemId,
      reason,
    });
    this.logger.warn(`인벤토리 예약 실패: ${userId} | 주문: ${orderId} | 사유: ${reason}`);
  }

  /**
   * 사용자 인벤토리 조회
   */
  async getUserInventory(userId: string): Promise<Inventory[]> {
    return this.inventoryRepository.find({
      where: { userId },
      relations: ['item'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * 인벤토리 아이템 수 조회
   */
  async getInventoryCount(userId: string): Promise<number> {
    return this.inventoryRepository.count({ where: { userId } });
  }

  /**
   * 인벤토리 아이템 사용/삭제 (게임에서 아이템 사용 시)
   * TODO: 실제 환경에서는 아이템 사용 로직과 연계 필요
   */
  async useItem(userId: string, itemId: string, quantity: number = 1): Promise<boolean> {
    const inventory = await this.inventoryRepository.findOne({
      where: { userId, itemId }
    });

    if (!inventory || !inventory.hasQuantity(quantity)) {
      return false;
    }

    const success = inventory.decreaseQuantity(quantity);
    if (success) {
      if (inventory.quantity === 0) {
        // 수량이 0이 되면 인벤토리에서 제거
        await this.inventoryRepository.remove(inventory);
      } else {
        await this.inventoryRepository.save(inventory);
      }
      
      this.logger.log(`아이템 사용: ${userId} | 아이템: ${itemId} | 사용수량: ${quantity}`);
    }

    return success;
  }
}