import { Injectable } from '@nestjs/common';
import { Repository, DataSource, LessThan, MoreThan } from 'typeorm';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { UserCoupon } from '../entities/user-coupon.entity';
import { UserCouponStatus } from '../enums';

@Injectable()
export class UserCouponRepository {
  constructor(
    @InjectRepository(UserCoupon)
    private readonly repository: Repository<UserCoupon>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 사용자 쿠폰 생성
   */
  async create(userCouponData: Partial<UserCoupon>): Promise<UserCoupon> {
    const userCoupon = this.repository.create(userCouponData);
    return this.repository.save(userCoupon);
  }

  /**
   * ID로 조회
   */
  async findById(id: string): Promise<UserCoupon | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * ID로 조회 (관계 포함)
   */
  async findByIdWithRelations(id: string): Promise<UserCoupon | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['coupon', 'usageLogs'],
    });
  }

  /**
   * 사용자의 특정 쿠폰 조회
   */
  async findUserCoupon(
    userId: string,
    couponId: string,
  ): Promise<UserCoupon | null> {
    return this.repository.findOne({
      where: { userId, couponId },
      relations: ['coupon'],
    });
  }

  /**
   * 사용자의 모든 쿠폰 조회
   */
  async findByUserId(userId: string): Promise<UserCoupon[]> {
    return this.repository.find({
      where: { userId },
      relations: ['coupon'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 사용자의 사용 가능한 쿠폰 조회
   */
  async findActiveByUserId(userId: string): Promise<UserCoupon[]> {
    const now = new Date();

    return this.repository.find({
      where: {
        userId,
        status: UserCouponStatus.ACTIVE,
        expiresAt: MoreThan(now),
      },
      relations: ['coupon'],
      order: { expiresAt: 'ASC' },
    });
  }

  /**
   * 특정 주문에 적용 가능한 사용자 쿠폰 조회
   */
  async findApplicableForOrder(
    userId: string,
    orderAmount: number,
    targetIds: string[] = [],
  ): Promise<UserCoupon[]> {
    const now = new Date();

    const queryBuilder = this.repository
      .createQueryBuilder('userCoupon')
      .leftJoinAndSelect('userCoupon.coupon', 'coupon')
      .where('userCoupon.userId = :userId', { userId })
      .andWhere('userCoupon.status = :status', {
        status: UserCouponStatus.ACTIVE,
      })
      .andWhere('userCoupon.expiresAt > :now', { now })
      .andWhere('coupon.isActive = :isActive', { isActive: true })
      .andWhere('coupon.minOrderAmount <= :orderAmount', { orderAmount })
      .andWhere('coupon.usedQuantity < coupon.totalQuantity');

    // 적용 대상 필터링 (SQLite에서는 JSON 문자열로 처리)
    if (targetIds.length > 0) {
      queryBuilder.andWhere(
        '(coupon.applicableType = :all OR ' +
          '(coupon.applicableType IN (:...types) AND (' +
          targetIds
            .map(
              (_, index) => `coupon.applicableTargetIds LIKE :targetId${index}`,
            )
            .join(' OR ') +
          ')))',
        {
          all: 'ALL',
          types: ['CATEGORY', 'ITEM'],
          ...targetIds.reduce(
            (acc, id, index) => {
              acc[`targetId${index}`] = `%"${id}"%`;
              return acc;
            },
            {} as Record<string, string>,
          ),
        },
      );
    }

    queryBuilder.orderBy('userCoupon.expiresAt', 'ASC');

    return queryBuilder.getMany();
  }

  /**
   * 만료된 쿠폰 조회
   */
  async findExpired(): Promise<UserCoupon[]> {
    const now = new Date();

    return this.repository.find({
      where: {
        status: UserCouponStatus.ACTIVE,
        expiresAt: LessThan(now),
      },
    });
  }

  /**
   * 만료 임박 쿠폰 조회
   */
  async findExpiringSoon(days: number = 3): Promise<UserCoupon[]> {
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + days);

    return this.repository.find({
      where: {
        status: UserCouponStatus.ACTIVE,
        expiresAt: LessThan(warningDate),
      },
      relations: ['coupon'],
      order: { expiresAt: 'ASC' },
    });
  }

  /**
   * 사용자별 쿠폰 통계
   */
  async getUserCouponStats(userId: string): Promise<{
    total: number;
    active: number;
    used: number;
    expired: number;
  }> {
    const [total, active, used, expired] = await Promise.all([
      this.repository.count({ where: { userId } }),
      this.repository.count({
        where: { userId, status: UserCouponStatus.ACTIVE },
      }),
      this.repository.count({
        where: { userId, status: UserCouponStatus.USED },
      }),
      this.repository.count({
        where: { userId, status: UserCouponStatus.EXPIRED },
      }),
    ]);

    return { total, active, used, expired };
  }

  /**
   * 쿠폰 사용 처리 (트랜잭션)
   */
  async markAsUsed(id: string, orderId: string): Promise<UserCoupon> {
    return this.dataSource.transaction(async (manager) => {
      const userCoupon = await manager.findOne(UserCoupon, { where: { id } });

      if (!userCoupon) {
        throw new Error('사용자 쿠폰을 찾을 수 없습니다.');
      }

      userCoupon.markAsUsed(orderId);
      return manager.save(userCoupon);
    });
  }

  /**
   * 쿠폰 사용 취소 (트랜잭션)
   */
  async markAsActive(id: string): Promise<UserCoupon> {
    return this.dataSource.transaction(async (manager) => {
      const userCoupon = await manager.findOne(UserCoupon, { where: { id } });

      if (!userCoupon) {
        throw new Error('사용자 쿠폰을 찾을 수 없습니다.');
      }

      userCoupon.markAsActive();
      return manager.save(userCoupon);
    });
  }

  /**
   * 만료 처리 (배치)
   */
  async markExpiredCoupons(): Promise<number> {
    const now = new Date();

    const result = await this.repository.update(
      {
        status: UserCouponStatus.ACTIVE,
        expiresAt: LessThan(now),
      },
      {
        status: UserCouponStatus.EXPIRED,
      },
    );

    return result.affected || 0;
  }

  /**
   * 특정 쿠폰의 사용자별 발급 여부 확인
   */
  async hasUserCoupon(userId: string, couponId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { userId, couponId },
    });

    return count > 0;
  }

  /**
   * 사용자 쿠폰 업데이트
   */
  async update(
    id: string,
    updateData: Partial<UserCoupon>,
  ): Promise<UserCoupon> {
    await this.repository.update(id, updateData);
    const updatedUserCoupon = await this.findById(id);
    if (!updatedUserCoupon) {
      throw new Error('사용자 쿠폰을 찾을 수 없습니다.');
    }
    return updatedUserCoupon;
  }

  /**
   * 사용자 쿠폰 삭제
   */
  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * 쿠폰 발급 (중복 체크 포함)
   */
  async issueCoupon(
    userId: string,
    couponId: string,
    expiresAt: Date,
  ): Promise<UserCoupon> {
    return this.dataSource.transaction(async (manager) => {
      // 중복 발급 체크
      const existing = await manager.findOne(UserCoupon, {
        where: { userId, couponId },
      });

      if (existing) {
        throw new Error('이미 발급된 쿠폰입니다.');
      }

      const userCoupon = manager.create(UserCoupon, {
        userId,
        couponId,
        expiresAt,
        status: UserCouponStatus.ACTIVE,
      });

      return manager.save(userCoupon);
    });
  }
}
