import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { EventBusService } from '../../infrastructure/redis/event-bus.service';
import { EventType } from '../../common/events/event-types.enum';
import {
  UserValidatedEvent,
  PaymentReservedEvent,
  PaymentRollbackEvent,
} from '../../common/events/event-interfaces';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    private eventBus: EventBusService,
    private dataSource: DataSource,
  ) {
    this.initializeEventHandlers();
  }

  /**
   * Saga 이벤트 핸들러 초기화
   */
  private async initializeEventHandlers(): Promise<void> {
    // 주문 생성 시 사용자 검증 시작
    await this.eventBus.subscribe(
      EventType.ORDER_CREATED,
      this.handleOrderCreated.bind(this),
    );

    // 결제 실패 시 잔고 롤백
    await this.eventBus.subscribe(
      EventType.PAYMENT_FAILED,
      this.handlePaymentFailed.bind(this),
    );

    // 인벤토리 예약 실패 시 잔고 롤백
    await this.eventBus.subscribe(
      EventType.INVENTORY_RESERVATION_FAILED,
      this.handleInventoryReservationFailed.bind(this),
    );

    // 아이템 예약 실패 시 잔고 롤백
    await this.eventBus.subscribe(
      EventType.ITEM_RESERVATION_FAILED,
      this.handleItemReservationFailed.bind(this),
    );
  }

  /**
   * 주문 생성 시 사용자 검증 및 잔고 예약
   */
  private async handleOrderCreated(eventData: any): Promise<void> {
    const { orderId, userId, totalAmount } = eventData;

    // DB 트랜잭션으로 동시성 제어 (ACID 보장)
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 사용자 검증 (FOR UPDATE로 락 획득)
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' }, // SELECT ... FOR UPDATE
      });
      
      if (!user) {
        await queryRunner.rollbackTransaction();
        await this.publishValidationFailed(
          orderId,
          userId,
          '사용자를 찾을 수 없습니다',
        );
        return;
      }

      if (!user.isActiveUser()) {
        await queryRunner.rollbackTransaction();
        await this.publishValidationFailed(
          orderId,
          userId,
          '비활성화된 사용자입니다',
        );
        return;
      }

      if (!user.canAfford(totalAmount)) {
        await queryRunner.rollbackTransaction();
        await this.publishValidationFailed(
          orderId,
          userId,
          `잔고가 부족합니다. (필요: ${totalAmount}, 보유: ${user.balance})`,
        );
        return;
      }

      // 2. 인벤토리 공간 검증
      const currentItemCount = await queryRunner.manager.count(Inventory, {
        where: { userId },
      });

      if (!user.hasInventorySpace(currentItemCount)) {
        await queryRunner.rollbackTransaction();
        await this.publishValidationFailed(
          orderId,
          userId,
          '인벤토리 공간이 부족합니다',
        );
        return;
      }

      // 3. 잔고 예약 (Redis에 임시 저장)
      const reservationKey = `balance_reserve:${userId}:${orderId}`;
      await this.eventBus.setReservation(
        reservationKey,
        {
          userId,
          orderId,
          amount: totalAmount,
          originalBalance: user.balance,
        },
        300,
      ); // 5분 TTL

      // 4. 실제 잔고 차감 (트랜잭션 내에서 원자적 실행)
      user.balance = Number(user.balance) - totalAmount;
      await queryRunner.manager.save(user);

      // 트랜잭션 커밋
      await queryRunner.commitTransaction();

      // 5. 사용자 검증 완료 이벤트 발행 (트랜잭션 커밋 후)
      const userValidatedEvent: UserValidatedEvent = {
        orderId,
        userId,
        userBalance: Number(user.balance),
        requiredAmount: totalAmount,
      };

      await this.eventBus.publish(
        EventType.USER_VALIDATED,
        userValidatedEvent,
      );

      // 6. 결제 예약 완료 이벤트 발행
      const paymentReservedEvent: PaymentReservedEvent = {
        orderId,
        userId,
        reservedAmount: totalAmount,
        remainingBalance: Number(user.balance),
      };

      await this.eventBus.publish(
        EventType.PAYMENT_RESERVED,
        paymentReservedEvent,
      );
      
      this.logger.log(
        `사용자 검증 및 잔고 예약 완료: ${userId} | 주문: ${orderId} | 예약금액: ${totalAmount}`,
      );
    } catch (error) {
      // 트랜잭션 롤백
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `사용자 검증 실패: ${userId} | 주문: ${orderId}`,
        error,
      );
      await this.publishValidationFailed(
        orderId,
        userId,
        '시스템 오류가 발생했습니다',
      );
    } finally {
      // QueryRunner 리소스 해제
      await queryRunner.release();
    }
  }

  /**
   * 결제 실패 시 잔고 롤백
   */
  private async handlePaymentFailed(eventData: any): Promise<void> {
    await this.rollbackBalance(eventData, '결제 실패');
  }

  /**
   * 인벤토리 예약 실패 시 잔고 롤백
   */
  private async handleInventoryReservationFailed(
    eventData: any,
  ): Promise<void> {
    await this.rollbackBalance(eventData, '인벤토리 예약 실패');
  }

  /**
   * 아이템 예약 실패 시 잔고 롤백
   */
  private async handleItemReservationFailed(eventData: any): Promise<void> {
    await this.rollbackBalance(eventData, '아이템 예약 실패');
  }

  /**
   * 잔고 롤백 공통 로직
   */
  private async rollbackBalance(eventData: any, reason: string): Promise<void> {
    const { orderId, userId } = eventData;

    try {
      // 예약 정보 조회
      const reservationKey = `balance_reserve:${userId}:${orderId}`;
      const reservation = await this.eventBus.getReservation(reservationKey);

      if (!reservation) {
        this.logger.warn(`예약 정보를 찾을 수 없습니다: ${reservationKey}`);
        return;
      }

      // DB 트랜잭션으로 동시성 제어 (ACID 보장)
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 사용자 조회 및 잔고 복원 (FOR UPDATE로 락 획득)
        const user = await queryRunner.manager.findOne(User, {
          where: { id: userId },
          lock: { mode: 'pessimistic_write' }, // SELECT ... FOR UPDATE
        });
        
        if (user) {
          user.balance = reservation.originalBalance;
          await queryRunner.manager.save(user);

          // 트랜잭션 커밋
          await queryRunner.commitTransaction();

          // 예약 정보 삭제 (트랜잭션 커밋 후)
          await this.eventBus.deleteReservation(reservationKey);

          // 잔고 롤백 이벤트 발행
          const paymentRollbackEvent: PaymentRollbackEvent = {
            orderId,
            userId,
            rollbackAmount: reservation.amount,
            reason,
          };

          await this.eventBus.publish(
            EventType.PAYMENT_ROLLBACK,
            paymentRollbackEvent,
          );
          
          this.logger.log(
            `잔고 롤백 완료: ${userId} | 주문: ${orderId} | 복원금액: ${reservation.amount} | 사유: ${reason}`,
          );
        } else {
          await queryRunner.rollbackTransaction();
          this.logger.warn(`사용자를 찾을 수 없습니다: ${userId}`);
        }
      } catch (transactionError) {
        await queryRunner.rollbackTransaction();
        throw transactionError;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      this.logger.error(`잔고 롤백 실패: ${userId} | 주문: ${orderId}`, error);
    }
  }

  /**
   * 사용자 검증 실패 이벤트 발행
   */
  private async publishValidationFailed(
    orderId: string,
    userId: string,
    reason: string,
  ): Promise<void> {
    await this.eventBus.publish(EventType.USER_VALIDATION_FAILED, {
      orderId,
      userId,
      reason,
    });
    this.logger.warn(
      `사용자 검증 실패: ${userId} | 주문: ${orderId} | 사유: ${reason}`,
    );
  }

  /**
   * 사용자 생성 (테스트용)
   */
  async createUser(username: string, balance: number = 10000): Promise<User> {
    const user = this.userRepository.create({
      username,
      balance,
      isActive: true,
      maxInventorySlots: 20,
    });

    return this.userRepository.save(user);
  }

  /**
   * 사용자 조회
   */
  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * 사용자 잔고 조회
   */
  async getBalance(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user ? Number(user.balance) : 0;
  }
}