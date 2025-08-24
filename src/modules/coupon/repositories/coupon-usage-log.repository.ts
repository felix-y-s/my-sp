import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CouponUsageLog } from '../entities/coupon-usage-log.entity';

@Injectable()
export class CouponUsageLogRepository {
  constructor(
    @InjectRepository(CouponUsageLog)
    private readonly repository: Repository<CouponUsageLog>,
  ) {}

  /**
   * 쿠폰 사용 로그 생성
   */
  async create(logData: Partial<CouponUsageLog>): Promise<CouponUsageLog> {
    const log = this.repository.create(logData);
    return this.repository.save(log);
  }

  /**
   * ID로 조회
   */
  async findById(id: string): Promise<CouponUsageLog | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * 주문 ID로 쿠폰 사용 로그 조회
   */
  async findByOrderId(usedInOrderId: string): Promise<CouponUsageLog[]> {
    return this.repository.find({
      where: { usedInOrderId },
      relations: ['userCoupon', 'userCoupon.coupon'],
      order: { usedAt: 'DESC' },
    });
  }

  /**
   * 사용자 쿠폰 ID로 조회
   */
  async findByUserCouponId(userCouponId: string): Promise<CouponUsageLog[]> {
    return this.repository.find({
      where: { userCouponId },
      order: { usedAt: 'DESC' },
    });
  }

  /**
   * 특정 사용자 쿠폰과 주문으로 로그 조회
   */
  async findByUserCouponAndOrder(
    userCouponId: string,
    usedInOrderId: string,
  ): Promise<CouponUsageLog | null> {
    return this.repository.findOne({
      where: {
        userCouponId,
        usedInOrderId,
      },
      relations: ['userCoupon', 'userCoupon.coupon'],
    });
  }

  /**
   * 사용자의 쿠폰 사용 이력 조회
   */
  async findByUserId(userId: string): Promise<CouponUsageLog[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.userCoupon', 'userCoupon')
      .leftJoinAndSelect('userCoupon.coupon', 'coupon')
      .where('userCoupon.userId = :userId', { userId })
      .orderBy('log.usedAt', 'DESC');

    return queryBuilder.getMany();
  }

  /**
   * 기간별 쿠폰 사용 통계
   */
  async getUsageStatsByPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalUsage: number;
    totalDiscount: number;
    totalOriginalAmount: number;
    averageDiscountRate: number;
  }> {
    const result = await this.repository
      .createQueryBuilder('log')
      .select([
        'COUNT(*) as totalUsage',
        'SUM(log.discountAmount) as totalDiscount',
        'SUM(log.originalAmount) as totalOriginalAmount',
      ])
      .where('log.usedAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();

    const totalUsage = parseInt(result.totalUsage) || 0;
    const totalDiscount = parseFloat(result.totalDiscount) || 0;
    const totalOriginalAmount = parseFloat(result.totalOriginalAmount) || 0;
    const averageDiscountRate =
      totalOriginalAmount > 0 ? (totalDiscount / totalOriginalAmount) * 100 : 0;

    return {
      totalUsage,
      totalDiscount,
      totalOriginalAmount,
      averageDiscountRate: Math.round(averageDiscountRate * 100) / 100,
    };
  }

  /**
   * 특정 쿠폰의 사용 통계
   */
  async getCouponUsageStats(couponId: string): Promise<{
    usageCount: number;
    totalDiscountAmount: number;
    totalOriginalAmount: number;
    averageOrderAmount: number;
    averageDiscountAmount: number;
  }> {
    const result = await this.repository
      .createQueryBuilder('log')
      .leftJoin('log.userCoupon', 'userCoupon')
      .select([
        'COUNT(*) as usageCount',
        'SUM(log.discountAmount) as totalDiscountAmount',
        'SUM(log.originalAmount) as totalOriginalAmount',
        'AVG(log.originalAmount) as averageOrderAmount',
        'AVG(log.discountAmount) as averageDiscountAmount',
      ])
      .where('userCoupon.couponId = :couponId', { couponId })
      .getRawOne();

    return {
      usageCount: parseInt(result.usageCount) || 0,
      totalDiscountAmount: parseFloat(result.totalDiscountAmount) || 0,
      totalOriginalAmount: parseFloat(result.totalOriginalAmount) || 0,
      averageOrderAmount: parseFloat(result.averageOrderAmount) || 0,
      averageDiscountAmount: parseFloat(result.averageDiscountAmount) || 0,
    };
  }

  /**
   * 일별 쿠폰 사용 현황
   */
  async getDailyUsageStats(
    startDate: Date,
    endDate: Date,
  ): Promise<
    Array<{
      date: string;
      usageCount: number;
      totalDiscount: number;
    }>
  > {
    const result = await this.repository
      .createQueryBuilder('log')
      .select([
        'DATE(log.usedAt) as date',
        'COUNT(*) as usageCount',
        'SUM(log.discountAmount) as totalDiscount',
      ])
      .where('log.usedAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('DATE(log.usedAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return result.map((row) => ({
      date: row.date,
      usageCount: parseInt(row.usageCount) || 0,
      totalDiscount: parseFloat(row.totalDiscount) || 0,
    }));
  }

  /**
   * 인기 쿠폰 순위
   */
  async getPopularCoupons(limit: number = 10): Promise<
    Array<{
      couponId: string;
      couponName: string;
      usageCount: number;
      totalDiscount: number;
    }>
  > {
    const result = await this.repository
      .createQueryBuilder('log')
      .leftJoin('log.userCoupon', 'userCoupon')
      .leftJoin('userCoupon.coupon', 'coupon')
      .select([
        'coupon.id as couponId',
        'coupon.name as couponName',
        'COUNT(*) as usageCount',
        'SUM(log.discountAmount) as totalDiscount',
      ])
      .groupBy('coupon.id, coupon.name')
      .orderBy('usageCount', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map((row) => ({
      couponId: row.couponId,
      couponName: row.couponName,
      usageCount: parseInt(row.usageCount) || 0,
      totalDiscount: parseFloat(row.totalDiscount) || 0,
    }));
  }

  /**
   * 쿠폰 사용 로그 생성 (편의 메서드)
   */
  async createUsageLog(
    userCouponId: string,
    usedInOrderId: string,
    discountAmount: number,
    originalAmount: number,
  ): Promise<CouponUsageLog> {
    const log = CouponUsageLog.create(
      userCouponId,
      usedInOrderId,
      discountAmount,
      originalAmount,
    );

    return this.repository.save(log);
  }

  /**
   * 쿠폰 사용 로그 저장
   */
  async save(log: CouponUsageLog): Promise<CouponUsageLog> {
    return this.repository.save(log);
  }

  /**
   * 월별 쿠폰 사용 트렌드
   */
  async getMonthlyUsageTrend(year: number): Promise<
    Array<{
      month: number;
      usageCount: number;
      totalDiscount: number;
      averageDiscount: number;
    }>
  > {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const result = await this.repository
      .createQueryBuilder('log')
      .select([
        'EXTRACT(MONTH FROM log.usedAt) as month',
        'COUNT(*) as usageCount',
        'SUM(log.discountAmount) as totalDiscount',
        'AVG(log.discountAmount) as averageDiscount',
      ])
      .where('log.usedAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('EXTRACT(MONTH FROM log.usedAt)')
      .orderBy('month', 'ASC')
      .getRawMany();

    // 12개월 모두 포함하도록 처리
    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      usageCount: 0,
      totalDiscount: 0,
      averageDiscount: 0,
    }));

    result.forEach((row) => {
      const monthIndex = parseInt(row.month) - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        monthlyStats[monthIndex] = {
          month: parseInt(row.month),
          usageCount: parseInt(row.usageCount) || 0,
          totalDiscount: parseFloat(row.totalDiscount) || 0,
          averageDiscount: parseFloat(row.averageDiscount) || 0,
        };
      }
    });

    return monthlyStats;
  }
}
