import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { User } from '../user/entities/user.entity';
import { Item } from '../item/entities/item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { EventBusService } from '../../infrastructure/redis/event-bus.service';
import { EventType } from '../../common/events/event-types.enum';
import {
  OrderCreatedEvent,
  OrderCompletedEvent,
  OrderFailedEvent,
} from '../../common/events/event-interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
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
    // 결제 완료 시 주문 완료 처리
    await this.eventBus.subscribe(
      EventType.PAYMENT_PROCESSED,
      this.handlePaymentProcessed.bind(this),
    );

    // 각 단계별 실패 이벤트 처리
    await this.eventBus.subscribe(
      EventType.USER_VALIDATION_FAILED,
      this.handleOrderFailed.bind(this),
    );
    await this.eventBus.subscribe(
      EventType.INVENTORY_RESERVATION_FAILED,
      this.handleOrderFailed.bind(this),
    );
    await this.eventBus.subscribe(
      EventType.ITEM_RESERVATION_FAILED,
      this.handleOrderFailed.bind(this),
    );
    await this.eventBus.subscribe(
      EventType.PAYMENT_FAILED,
      this.handleOrderFailed.bind(this),
    );
  }

  /**
   * 주문 생성 - Saga 시작점
   */
  async createOrder(createOrderDto: CreateOrderDto): Promise<Order> {
    const { userId, itemId, quantity } = createOrderDto;

    // 사용자 및 아이템 기본 검증
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    const item = await this.itemRepository.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('아이템을 찾을 수 없습니다');
    }

    // 총 금액 계산
    const totalAmount = item.calculateTotalPrice(quantity);

    // 주문 생성
    const order = this.orderRepository.create({
      id: uuidv4(),
      userId,
      itemId,
      quantity,
      totalAmount,
      status: OrderStatus.PENDING,
    });

    const savedOrder = await this.orderRepository.save(order);

    // Saga 시작 - OrderCreated 이벤트 발행
    const orderCreatedEvent: OrderCreatedEvent = {
      orderId: savedOrder.id,
      userId,
      itemId,
      quantity,
      totalAmount,
    };

    await this.eventBus.publish(EventType.ORDER_CREATED, orderCreatedEvent);
    this.logger.log(`주문 생성 및 Saga 시작: ${savedOrder.id}`);

    return savedOrder;
  }

  /**
   * 결제 완료 처리
   */
  private async handlePaymentProcessed(eventData: any): Promise<void> {
    const { orderId, userId } = eventData;

    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['item'],
      });

      if (!order) {
        this.logger.error(`주문을 찾을 수 없습니다: ${orderId}`);
        return;
      }

      // 주문 완료 처리
      order.updateStatus(OrderStatus.COMPLETED);
      await this.orderRepository.save(order);

      // 주문 완료 이벤트 발행
      const orderCompletedEvent: OrderCompletedEvent = {
        orderId,
        userId,
        itemName: order.item.name,
        totalAmount: order.totalAmount,
      };

      await this.eventBus.publish(
        EventType.ORDER_COMPLETED,
        orderCompletedEvent,
      );
      this.logger.log(`주문 완료 처리: ${orderId}`);
    } catch (error) {
      this.logger.error(`주문 완료 처리 실패: ${orderId}`, error);
    }
  }

  /**
   * 주문 실패 처리
   */
  private async handleOrderFailed(eventData: any): Promise<void> {
    const { orderId, reason } = eventData;

    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId },
      });
      if (!order) {
        this.logger.error(`주문을 찾을 수 없습니다: ${orderId}`);
        return;
      }

      // 주문 실패 처리
      order.markAsFailed(reason);
      await this.orderRepository.save(order);

      // 주문 실패 이벤트 발행
      const orderFailedEvent: OrderFailedEvent = {
        orderId,
        userId: order.userId,
        reason,
        failedStep: this.getFailedStepFromReason(reason),
      };

      await this.eventBus.publish(EventType.ORDER_FAILED, orderFailedEvent);
      this.logger.warn(`주문 실패 처리: ${orderId} - ${reason}`);
    } catch (error) {
      this.logger.error(`주문 실패 처리 오류: ${orderId}`, error);
    }
  }

  /**
   * 실패 이유로부터 실패 단계 추출
   * TODO: 더 정교한 실패 단계 분류 로직 구현 필요
   */
  private getFailedStepFromReason(reason: string): string {
    if (reason.includes('사용자')) return 'USER_VALIDATION';
    if (reason.includes('인벤토리')) return 'INVENTORY_RESERVATION';
    if (reason.includes('아이템')) return 'ITEM_RESERVATION';
    if (reason.includes('결제')) return 'PAYMENT_PROCESSING';
    return 'UNKNOWN';
  }

  /**
   * 주문 조회
   */
  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'item'],
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    return order;
  }

  /**
   * 사용자별 주문 목록 조회
   */
  async findByUserId(userId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId },
      relations: ['item'],
      order: { createdAt: 'DESC' },
    });
  }
}
