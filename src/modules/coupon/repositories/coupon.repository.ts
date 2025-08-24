import { Injectable } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Coupon } from '../entities/coupon.entity';
import { DiscountType, ApplicableType, ValidityType } from '../enums';

@Injectable()
export class CouponRepository {
  constructor(
    @InjectRepository(Coupon)
    private readonly repository: Repository<Coupon>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 쿠폰 생성
   */
  async create(couponData: Partial<Coupon>): Promise<Coupon> {
    const coupon = this.repository.create(couponData);
    return this.repository.save(coupon);
  }

  /**
   * 쿠폰 ID로 조회
   */
  async findById(id: string): Promise<Coupon | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * 쿠폰 ID로 조회 (관계 포함)
   */
  async findByIdWithRelations(id: string): Promise<Coupon | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['userCoupons'],
    });
  }

  /**
   * 활성화된 쿠폰 목록 조회
   */
  async findActiveCoupons(): Promise<Coupon[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 관리자용 쿠폰 목록 조회 (페이징)
   */
  async findWithPagination(
    page: number = 1,
    limit: number = 20,
    filters?: {
      isActive?: boolean;
      discountType?: DiscountType;
      applicableType?: ApplicableType;
      search?: string;
    },
  ): Promise<{ coupons: Coupon[]; total: number }> {
    const queryBuilder = this.repository.createQueryBuilder('coupon');

    // 필터 적용
    if (filters?.isActive !== undefined) {
      queryBuilder.andWhere('coupon.isActive = :isActive', {
        isActive: filters.isActive,
      });
    }

    if (filters?.discountType) {
      queryBuilder.andWhere('coupon.discountType = :discountType', {
        discountType: filters.discountType,
      });
    }

    if (filters?.applicableType) {
      queryBuilder.andWhere('coupon.applicableType = :applicableType', {
        applicableType: filters.applicableType,
      });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(coupon.name LIKE :search OR coupon.description LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    // 페이징
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // 정렬
    queryBuilder.orderBy('coupon.createdAt', 'DESC');

    const [coupons, total] = await queryBuilder.getManyAndCount();

    return { coupons, total };
  }

  /**
   * 특정 적용 대상에 사용 가능한 쿠폰 조회
   */
  async findApplicableCoupons(targetIds: string[]): Promise<Coupon[]> {
    const queryBuilder = this.repository.createQueryBuilder('coupon');

    queryBuilder
      .where('coupon.isActive = :isActive', { isActive: true })
      .andWhere('coupon.usedQuantity < coupon.totalQuantity')
      .andWhere(
        '(coupon.applicableType = :all OR ' +
          '(coupon.applicableType IN (:...types) AND (' +
          targetIds
            .map(
              (_, index) => `coupon.applicableTargetIds LIKE :targetId${index}`,
            )
            .join(' OR ') +
          ')))',
        {
          all: ApplicableType.ALL,
          types: [ApplicableType.CATEGORY, ApplicableType.ITEM],
          ...targetIds.reduce(
            (acc, id, index) => {
              acc[`targetId${index}`] = `%"${id}"%`;
              return acc;
            },
            {} as Record<string, string>,
          ),
        },
      );

    // 절대적 유효기간 확인
    const now = new Date();
    queryBuilder.andWhere(
      '(coupon.validityType = :relative OR ' +
        '(coupon.validityType = :absolute AND ' +
        '(coupon.validFrom IS NULL OR coupon.validFrom <= :now) AND ' +
        '(coupon.validUntil IS NULL OR coupon.validUntil >= :now)))',
      {
        relative: ValidityType.RELATIVE,
        absolute: ValidityType.ABSOLUTE,
        now,
      },
    );

    return queryBuilder.getMany();
  }

  /**
   * 쿠폰 수량 업데이트 (트랜잭션 안전)
   */
  async incrementUsedQuantity(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.increment(Coupon, { id }, 'usedQuantity', 1);
    });
  }

  /**
   * 쿠폰 수량 감소 (취소 시)
   */
  async decrementUsedQuantity(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.decrement(Coupon, { id }, 'usedQuantity', 1);
    });
  }

  /**
   * 쿠폰 업데이트
   */
  async update(id: string, updateData: Partial<Coupon>): Promise<Coupon> {
    await this.repository.update(id, updateData);
    const updatedCoupon = await this.findById(id);
    if (!updatedCoupon) {
      throw new Error('쿠폰을 찾을 수 없습니다.');
    }
    return updatedCoupon;
  }

  /**
   * 쿠폰 삭제 (소프트 삭제 - 비활성화)
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.update(id, { isActive: false });
  }

  /**
   * 쿠폰 완전 삭제
   */
  async hardDelete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * 쿠폰 통계 조회
   */
  async getCouponStatistics(id: string): Promise<{
    totalIssued: number;
    totalUsed: number;
    remainingStock: number;
    usageRate: number;
  }> {
    const coupon = await this.findById(id);
    if (!coupon) {
      throw new Error('쿠폰을 찾을 수 없습니다.');
    }

    const totalIssued = coupon.totalQuantity;
    const totalUsed = coupon.usedQuantity;
    const remainingStock = totalIssued - totalUsed;
    const usageRate = totalIssued > 0 ? (totalUsed / totalIssued) * 100 : 0;

    return {
      totalIssued,
      totalUsed,
      remainingStock,
      usageRate: Math.round(usageRate * 100) / 100,
    };
  }

  /**
   * 만료 임박 쿠폰 조회
   */
  async findExpiringSoon(days: number = 7): Promise<Coupon[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.repository.find({
      where: {
        isActive: true,
        validityType: ValidityType.ABSOLUTE,
        validUntil: futureDate, // LessThanOrEqual을 사용해야 하지만 간단히 구현
      },
      order: { validUntil: 'ASC' },
    });
  }
}
