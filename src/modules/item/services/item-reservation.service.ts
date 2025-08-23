import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ItemReservation,
  ReservationStatus,
} from '../entities/item-reservation.entity';
import { CreateReservationDto } from '../dto/create-reservation.dto';

@Injectable()
export class ItemReservationService {
  private readonly logger = new Logger(ItemReservationService.name);

  constructor(
    @InjectRepository(ItemReservation)
    private reservationRepository: Repository<ItemReservation>,
  ) {}

  /**
   * 예약 생성
   */
  async createReservation(dto: CreateReservationDto): Promise<ItemReservation> {
    const reservation = this.reservationRepository.create({
      ...dto,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5분 TTL
    });

    const savedReservation = await this.reservationRepository.save(reservation);

    this.logger.log(
      `예약 생성: ${savedReservation.id} | 주문: ${dto.orderId} | 아이템: ${dto.itemId} | 수량: ${dto.reservedQuantity}`,
    );

    return savedReservation;
  }

  /**
   * 주문 ID로 예약 조회
   */
  async findByOrderId(orderId: string): Promise<ItemReservation[]> {
    return this.reservationRepository.find({
      where: { orderId },
      order: { reservedAt: 'DESC' },
    });
  }

  /**
   * 활성 예약 조회 (주문 ID 기준)
   */
  async findActiveByOrderId(orderId: string): Promise<ItemReservation[]> {
    return this.reservationRepository.find({
      where: {
        orderId,
        status: ReservationStatus.RESERVED,
      },
      order: { reservedAt: 'DESC' },
    });
  }

  /**
   * 아이템 ID로 활성 예약 조회
   */
  async findActiveByItemId(itemId: string): Promise<ItemReservation[]> {
    return this.reservationRepository.find({
      where: {
        itemId,
        status: ReservationStatus.RESERVED,
      },
      order: { reservedAt: 'DESC' },
    });
  }

  /**
   * 예약 상태 업데이트
   */
  async updateReservationStatus(
    id: string,
    status: ReservationStatus,
    reason?: string,
  ): Promise<ItemReservation | null> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
    });

    if (!reservation) {
      this.logger.warn(`예약 정보를 찾을 수 없습니다: ${id}`);
      return null;
    }

    reservation.status = status;
    if (reason) {
      reservation.cancelReason = reason;
    }

    const updatedReservation =
      await this.reservationRepository.save(reservation);

    this.logger.log(
      `예약 상태 업데이트: ${id} | ${status} | 사유: ${reason || 'N/A'}`,
    );

    return updatedReservation;
  }

  /**
   * 예약 확정 (결제 성공 시)
   */
  async confirmReservation(orderId: string): Promise<ItemReservation[]> {
    const reservations = await this.findActiveByOrderId(orderId);

    if (reservations.length === 0) {
      this.logger.warn(`확정할 예약 정보가 없습니다: 주문 ${orderId}`);
      return [];
    }

    const confirmedReservations: ItemReservation[] = [];

    for (const reservation of reservations) {
      reservation.confirm();
      const confirmed = await this.reservationRepository.save(reservation);
      confirmedReservations.push(confirmed);
    }

    this.logger.log(
      `예약 확정 완료: 주문 ${orderId} | ${confirmedReservations.length}건`,
    );

    return confirmedReservations;
  }

  /**
   * 예약 취소 (결제 실패 시)
   */
  async cancelReservation(
    orderId: string,
    reason: string,
  ): Promise<ItemReservation[]> {
    const reservations = await this.findActiveByOrderId(orderId);

    if (reservations.length === 0) {
      this.logger.warn(`취소할 예약 정보가 없습니다: 주문 ${orderId}`);
      return [];
    }

    const cancelledReservations: ItemReservation[] = [];

    for (const reservation of reservations) {
      reservation.cancel(reason);
      const cancelled = await this.reservationRepository.save(reservation);
      cancelledReservations.push(cancelled);
    }

    this.logger.log(
      `예약 취소 완료: 주문 ${orderId} | ${cancelledReservations.length}건 | 사유: ${reason}`,
    );

    return cancelledReservations;
  }

  /**
   * 만료된 예약 정리 (배치 작업 - 1분마다 실행)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredReservations(): Promise<void> {
    try {
      const expiredReservations = await this.reservationRepository.find({
        where: {
          status: ReservationStatus.RESERVED,
          expiresAt: LessThanOrEqual(new Date()),
        },
      });

      if (expiredReservations.length === 0) {
        return;
      }

      // 만료된 예약들을 EXPIRED 상태로 업데이트
      for (const reservation of expiredReservations) {
        reservation.expire();
        await this.reservationRepository.save(reservation);
      }

      this.logger.log(`만료된 예약 정리 완료: ${expiredReservations.length}건`);
    } catch (error) {
      this.logger.error('만료된 예약 정리 중 오류 발생', error);
    }
  }

  /**
   * 예약 통계 조회 (모니터링용)
   */
  async getReservationStats(): Promise<{
    total: number;
    active: number;
    confirmed: number;
    cancelled: number;
    expired: number;
  }> {
    const [total, active, confirmed, cancelled, expired] = await Promise.all([
      this.reservationRepository.count(),
      this.reservationRepository.count({
        where: { status: ReservationStatus.RESERVED },
      }),
      this.reservationRepository.count({
        where: { status: ReservationStatus.CONFIRMED },
      }),
      this.reservationRepository.count({
        where: { status: ReservationStatus.CANCELLED },
      }),
      this.reservationRepository.count({
        where: { status: ReservationStatus.EXPIRED },
      }),
    ]);

    return { total, active, confirmed, cancelled, expired };
  }

  /**
   * 특정 기간의 오래된 예약 데이터 아카이브 (월 1회 실행)
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async archiveOldReservations(): Promise<void> {
    try {
      // 30일 이전의 완료/취소/만료된 예약들을 삭제 (실제로는 별도 테이블로 이동)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await this.reservationRepository.delete({
        status: ReservationStatus.EXPIRED,
        reservedAt: LessThanOrEqual(thirtyDaysAgo),
      });

      this.logger.log(
        `오래된 예약 데이터 정리 완료: ${result.affected || 0}건 삭제`,
      );
    } catch (error) {
      this.logger.error('오래된 예약 데이터 정리 중 오류 발생', error);
    }
  }
}
