import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Item } from './entities/item.entity';
import {
  ItemReservation,
  ReservationStatus,
} from './entities/item-reservation.entity';
import { ItemReservationService } from './services/item-reservation.service';
import { EventBusService } from '../../infrastructure/redis/event-bus.service';
import { EventType } from '../../common/events/event-types.enum';
import {
  ItemReservedEvent,
  ItemRestoredEvent,
} from '../../common/events/event-interfaces';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class ItemService {
  private readonly logger = new Logger(ItemService.name);

  constructor(
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
    @InjectDataSource()
    private dataSource: DataSource,
    private reservationService: ItemReservationService,
    private eventBus: EventBusService,
    private auditService: AuditService,
  ) {
    this.initializeEventHandlers();
  }

  /**
   * Saga 이벤트 핸들러 초기화
   */
  private async initializeEventHandlers(): Promise<void> {
    // 인벤토리 예약 성공 시 아이템 재고 예약
    await this.eventBus.subscribe(
      EventType.INVENTORY_RESERVED,
      this.handleInventoryReserved.bind(this),
    );

    // 결제 실패 시 아이템 재고 복원
    await this.eventBus.subscribe(
      EventType.PAYMENT_FAILED,
      this.handlePaymentFailed.bind(this),
    );

    // 결제 성공 시 예약 확정
    await this.eventBus.subscribe(
      EventType.PAYMENT_SUCCESS,
      this.handlePaymentSuccess.bind(this),
    );
  }

  /**
   * 인벤토리 예약 성공 시 아이템 재고 예약
   */
  private async handleInventoryReserved(eventData: any): Promise<void> {
    const { orderId, userId, itemId } = eventData;
    const quantity = eventData.quantity || 1; // Order에서 전달되지 않은 경우를 위한 기본값

    try {
      // DB 트랜잭션으로 동시성 제어 (ACID 보장)
      // 1. 아이템 조회 및 검증
      const item = await this.itemRepository.findOne({
        where: { id: itemId },
      });
      if (!item) {
        await this.publishReservationFailed(
          orderId,
          userId,
          itemId,
          '아이템을 찾을 수 없습니다',
        );
        return;
      }

      if (!item.isAvailableForSale()) {
        await this.publishReservationFailed(
          orderId,
          userId,
          itemId,
          '판매 중단된 아이템입니다',
        );
        return;
      }

      if (!item.hasStock(quantity)) {
        await this.publishReservationFailed(
          orderId,
          userId,
          itemId,
          `재고가 부족합니다. (필요: ${quantity}, 재고: ${item.stock})`,
        );
        return;
      }

      // 2. DB 트랜잭션으로 예약 정보 생성 + 재고 차감
      await this.dataSource.transaction(async (manager) => {
        // 재고 차감
        await manager.decrement(Item, { id: itemId }, 'stock', quantity);

        // 예약 정보 생성
        const reservation = manager.create(ItemReservation, {
          orderId,
          userId,
          itemId,
          reservedQuantity: quantity,
          originalStock: item.stock,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5분 TTL
        });

        await manager.save(reservation);
      });

      // 3. 업데이트된 재고 정보 다시 조회
      const updatedItem = await this.itemRepository.findOne({
        where: { id: itemId },
      });
      const remainingStock = updatedItem
        ? updatedItem.stock
        : item.stock - quantity;

      // 4. 아이템 예약 완료 이벤트 발행
      const itemReservedEvent: ItemReservedEvent = {
        orderId,
        userId,
        itemId,
        reservedQuantity: quantity,
        remainingStock: remainingStock,
      };

      await this.eventBus.publish(EventType.ITEM_RESERVED, itemReservedEvent);
      this.logger.log(
        `아이템 재고 예약 완료: ${itemId} | 주문: ${orderId} | 예약수량: ${quantity} | 남은재고: ${remainingStock}`,
      );
    } catch (error) {
      this.logger.error(
        `아이템 재고 예약 실패: ${itemId} | 주문: ${orderId}`,
        error,
      );
      await this.publishReservationFailed(
        orderId,
        userId,
        itemId,
        '시스템 오류가 발생했습니다',
      );
    }
  }

  /**
   * 결제 성공 시 예약 확정
   */
  private async handlePaymentSuccess(eventData: any): Promise<void> {
    const { orderId, userId } = eventData;

    try {
      this.logger.log(`결제 성공으로 인한 아이템 예약 확정: 주문 ${orderId}`);

      // 예약 확정 처리
      const confirmedReservations =
        await this.reservationService.confirmReservation(orderId);

      if (confirmedReservations.length > 0) {
        this.logger.log(
          `예약 확정 완료: 주문 ${orderId} | 확정된 예약 ${confirmedReservations.length}건`,
        );
      }
    } catch (error) {
      this.logger.error(`아이템 예약 확정 실패: 주문 ${orderId}`, error);
    }
  }

  /**
   * 결제 실패 시 아이템 재고 복원
   */
  private async handlePaymentFailed(eventData: any): Promise<void> {
    const { orderId, userId } = eventData;

    try {
      this.logger.log(
        `결제 실패로 인한 아이템 재고 복원 시도: 주문 ${orderId}`,
      );

      // 완전한 보상 트랜잭션 실행
      await this.restoreItemStock(orderId, userId, '결제 실패');
    } catch (error) {
      this.logger.error(`아이템 재고 복원 실패: 주문 ${orderId}`, error);
    }
  }

  /**
   * 아이템 재고 복원 (완전한 보상 트랜잭션 구현)
   */
  private async restoreItemStock(
    orderId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    try {
      // 1. 해당 주문의 모든 활성 예약 정보 조회
      const reservations =
        await this.reservationService.findActiveByOrderId(orderId);

      if (reservations.length === 0) {
        this.logger.warn(`복원할 예약 정보가 없습니다: 주문 ${orderId}`);
        return;
      }

      // 2. 각 예약에 대해 재고 복원 처리
      const restoredItems: { itemId: string; restoredQuantity: number }[] = [];

      for (const reservation of reservations) {
        if (reservation.status !== ReservationStatus.RESERVED) {
          this.logger.warn(
            `이미 처리된 예약 건너뛰기: ${reservation.id} | 상태: ${reservation.status}`,
          );
          continue;
        }

        try {
          // 3. 트랜잭션으로 재고 복원 + 예약 상태 업데이트
          await this.dataSource.transaction(async (manager) => {
            // 실제 재고 복원
            await manager.increment(
              Item,
              { id: reservation.itemId },
              'stock',
              reservation.reservedQuantity,
            );

            // 예약 상태 업데이트
            reservation.cancel(reason);
            await manager.save(reservation);
          });

          restoredItems.push({
            itemId: reservation.itemId,
            restoredQuantity: reservation.reservedQuantity,
          });

          this.logger.log(
            `재고 복원 완료: 아이템 ${reservation.itemId} | 복원수량 ${reservation.reservedQuantity} | 주문 ${orderId}`,
          );
        } catch (error) {
          this.logger.error(
            `재고 복원 처리 실패: 예약 ${reservation.id}`,
            error,
          );
        }
      }

      // 4. 재고 복원 완료 이벤트 발행 (복원된 아이템이 있는 경우만)
      if (restoredItems.length > 0) {
        const itemRestoredEvent: ItemRestoredEvent = {
          orderId,
          userId,
          restoredItems,
          reason,
        };

        await this.eventBus.publish(EventType.ITEM_RESTORED, itemRestoredEvent);

        this.logger.log(
          `재고 복원 완료 이벤트 발행: 주문 ${orderId} | 복원 아이템 ${restoredItems.length}개 | 사유: ${reason}`,
        );
      }
    } catch (error) {
      this.logger.error(`재고 복원 처리 실패: 주문 ${orderId}`, error);
      throw error;
    }
  }

  /**
   * 아이템 예약 실패 이벤트 발행
   */
  private async publishReservationFailed(
    orderId: string,
    userId: string,
    itemId: string,
    reason: string,
  ): Promise<void> {
    await this.eventBus.publish(EventType.ITEM_RESERVATION_FAILED, {
      orderId,
      userId,
      itemId,
      reason,
    });
    this.logger.warn(
      `아이템 예약 실패: ${itemId} | 주문: ${orderId} | 사유: ${reason}`,
    );
  }

  /**
   * 아이템 생성 (테스트용)
   */
  async createItem(
    name: string,
    price: number,
    stock: number = 100,
  ): Promise<Item> {
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
      order: { createdAt: 'DESC' },
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
   * 재고 직접 업데이트 (관리자 전용) - 보안 강화 버전
   *
   * @param itemId 아이템 ID
   * @param newStock 새로운 재고 수량
   * @param adminUserId 관리자 사용자 ID
   * @param reason 변경 사유
   * @param userRoles 사용자 역할 배열
   */
  async updateStock(
    itemId: string,
    newStock: number,
    adminUserId: string,
    reason: string,
    userRoles: string[],
  ): Promise<void> {
    // 1. 권한 검증
    const hasPermission =
      userRoles.includes('admin') || userRoles.includes('inventory_manager');
    if (!hasPermission) {
      // 권한 없는 접근 시도 감사 로그 기록
      await this.auditService.logUnauthorizedAccess(
        adminUserId,
        'UPDATE_STOCK',
        'Item',
      );
      throw new Error('재고 관리 권한이 없습니다');
    }

    // 2. 현재 재고 조회 (변경 이력 기록용)
    const currentItem = await this.itemRepository.findOne({
      where: { id: itemId },
    });
    if (!currentItem) {
      throw new Error('아이템을 찾을 수 없습니다');
    }

    const oldStock = currentItem.stock;

    // 3. 재고 업데이트
    await this.itemRepository.update(itemId, { stock: newStock });

    // 4. 변경 이력 기록 (감사 로그)
    await this.auditService.logStockChange({
      itemId,
      oldStock,
      newStock,
      changedBy: adminUserId,
      reason,
      timestamp: new Date(),
    });

    this.logger.log(
      `관리자 재고 업데이트: ${itemId} | ${oldStock} -> ${newStock} | 관리자: ${adminUserId} | 사유: ${reason}`,
    );
  }
}
