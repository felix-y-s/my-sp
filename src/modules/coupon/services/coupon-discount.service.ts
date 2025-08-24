import { Injectable } from '@nestjs/common';
import { CouponValidationService } from './coupon-validation.service';
import { UserCouponRepository } from '../repositories/user-coupon.repository';
import {
  OrderItem,
  DiscountResult,
  CouponApplicationResult,
} from '../interfaces/coupon-validation.interface';
import { ApplicableType } from '../enums';

/**
 * 할인 계산 전용 서비스
 * 복잡한 할인 로직과 다중 쿠폰 적용 시나리오를 처리
 */
@Injectable()
export class CouponDiscountService {
  constructor(
    private readonly couponValidationService: CouponValidationService,
    private readonly userCouponRepository: UserCouponRepository,
  ) {}

  /**
   * 단일 쿠폰 할인 계산
   */
  async calculateSingleCouponDiscount(
    userCouponId: string,
    orderItems: OrderItem[],
    userId: string,
  ): Promise<DiscountResult | null> {
    return this.couponValidationService.calculateDiscount(
      userCouponId,
      orderItems,
      userId,
    );
  }

  /**
   * 최적 쿠폰 추천 (가장 많이 할인되는 쿠폰)
   */
  async findBestCouponForOrder(
    userId: string,
    orderItems: OrderItem[],
  ): Promise<CouponApplicationResult | null> {
    try {
      // 사용 가능한 모든 쿠폰 조회
      const availableCoupons =
        await this.couponValidationService.getAvailableCouponsForOrder(
          userId,
          orderItems,
        );

      if (availableCoupons.length === 0) {
        return null;
      }

      // 할인 금액 기준으로 정렬하여 최고 할인 쿠폰 선택
      const bestCoupon = availableCoupons.reduce((best, current) => {
        if (!current.discount || !best.discount) {
          return current.discount ? current : best;
        }

        return current.discount.discountAmount > best.discount.discountAmount
          ? current
          : best;
      });

      return bestCoupon;
    } catch (error) {
      console.error('최적 쿠폰 찾기 중 오류 발생:', error);
      return null;
    }
  }

  /**
   * 쿠폰 할인율 비교 분석
   */
  async compareCouponDiscounts(
    userId: string,
    orderItems: OrderItem[],
  ): Promise<{
    coupons: CouponApplicationResult[];
    bestDiscount: CouponApplicationResult | null;
    totalSavings: number;
    recommendedCoupon: string;
  }> {
    try {
      const availableCoupons =
        await this.couponValidationService.getAvailableCouponsForOrder(
          userId,
          orderItems,
        );

      if (availableCoupons.length === 0) {
        return {
          coupons: [],
          bestDiscount: null,
          totalSavings: 0,
          recommendedCoupon: '사용 가능한 쿠폰이 없습니다.',
        };
      }

      // 할인 금액 기준 정렬
      const sortedCoupons = availableCoupons.sort((a, b) => {
        const discountA = a.discount?.discountAmount || 0;
        const discountB = b.discount?.discountAmount || 0;
        return discountB - discountA;
      });

      const bestDiscount = sortedCoupons[0];
      const totalSavings = bestDiscount.discount?.discountAmount || 0;

      let recommendedCoupon = '';
      if (bestDiscount.validation.couponInfo) {
        const couponInfo = bestDiscount.validation.couponInfo;
        recommendedCoupon = `${couponInfo.name} (${totalSavings.toLocaleString()}원 할인)`;
      }

      return {
        coupons: sortedCoupons,
        bestDiscount,
        totalSavings,
        recommendedCoupon,
      };
    } catch (error) {
      console.error('쿠폰 할인율 비교 중 오류 발생:', error);
      return {
        coupons: [],
        bestDiscount: null,
        totalSavings: 0,
        recommendedCoupon: '오류가 발생했습니다.',
      };
    }
  }

  /**
   * 카테고리별 최적 쿠폰 추천
   */
  async findBestCouponByCategory(
    userId: string,
    orderItems: OrderItem[],
  ): Promise<Map<string, CouponApplicationResult>> {
    const categoryBestCoupons = new Map<string, CouponApplicationResult>();

    try {
      // 카테고리별로 그룹화
      const itemsByCategory = new Map<string, OrderItem[]>();

      orderItems.forEach((item) => {
        if (item.categoryId) {
          const categoryItems = itemsByCategory.get(item.categoryId) || [];
          categoryItems.push(item);
          itemsByCategory.set(item.categoryId, categoryItems);
        }
      });

      // 각 카테고리별로 최적 쿠폰 찾기
      for (const [categoryId, items] of itemsByCategory) {
        const availableCoupons =
          await this.couponValidationService.getAvailableCouponsForOrder(
            userId,
            items,
          );

        // 해당 카테고리에 적용 가능한 쿠폰만 필터링
        const categorySpecificCoupons = availableCoupons.filter((coupon) => {
          const userCoupon = coupon.validation.couponInfo;
          if (!userCoupon) return false;

          // 전체 적용 쿠폰은 포함
          if (userCoupon.discountType === ApplicableType.ALL) return true;

          // 카테고리 적용 쿠폰인 경우 해당 카테고리 확인 필요
          return true; // 추가 로직은 CouponValidationService에서 처리됨
        });

        if (categorySpecificCoupons.length > 0) {
          const bestCoupon = categorySpecificCoupons.reduce((best, current) => {
            const bestDiscount = best.discount?.discountAmount || 0;
            const currentDiscount = current.discount?.discountAmount || 0;
            return currentDiscount > bestDiscount ? current : best;
          });

          categoryBestCoupons.set(categoryId, bestCoupon);
        }
      }

      return categoryBestCoupons;
    } catch (error) {
      console.error('카테고리별 최적 쿠폰 찾기 중 오류 발생:', error);
      return categoryBestCoupons;
    }
  }

  /**
   * 할인 시뮬레이션 (가상 주문으로 할인 테스트)
   */
  async simulateDiscount(
    userCouponId: string,
    orderItems: OrderItem[],
    userId: string,
  ): Promise<{
    simulation: DiscountResult | null;
    breakdown: {
      originalTotal: number;
      applicableAmount: number;
      discountAmount: number;
      finalAmount: number;
      savings: number;
      savingsPercentage: number;
    };
    recommendation: string;
  }> {
    try {
      const simulation = await this.calculateSingleCouponDiscount(
        userCouponId,
        orderItems,
        userId,
      );

      if (!simulation) {
        return {
          simulation: null,
          breakdown: {
            originalTotal: 0,
            applicableAmount: 0,
            discountAmount: 0,
            finalAmount: 0,
            savings: 0,
            savingsPercentage: 0,
          },
          recommendation: '쿠폰을 적용할 수 없습니다.',
        };
      }

      const originalTotal = simulation.originalAmount;
      const applicableAmount = simulation.applicableItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );
      const discountAmount = simulation.discountAmount;
      const finalAmount = simulation.finalAmount;
      const savings = originalTotal - finalAmount;
      const savingsPercentage =
        originalTotal > 0 ? (savings / originalTotal) * 100 : 0;

      let recommendation = '';
      if (discountAmount > 0) {
        recommendation = `${discountAmount.toLocaleString()}원 할인으로 ${savingsPercentage.toFixed(1)}% 절약됩니다.`;
      } else {
        recommendation = '이 쿠폰은 현재 주문에 할인 혜택이 없습니다.';
      }

      return {
        simulation,
        breakdown: {
          originalTotal,
          applicableAmount,
          discountAmount,
          finalAmount,
          savings,
          savingsPercentage,
        },
        recommendation,
      };
    } catch (error) {
      console.error('할인 시뮬레이션 중 오류 발생:', error);
      return {
        simulation: null,
        breakdown: {
          originalTotal: 0,
          applicableAmount: 0,
          discountAmount: 0,
          finalAmount: 0,
          savings: 0,
          savingsPercentage: 0,
        },
        recommendation: '시뮬레이션 중 오류가 발생했습니다.',
      };
    }
  }

  /**
   * 할인 적용 가능 여부 빠른 확인
   */
  async quickDiscountCheck(
    userCouponId: string,
    totalAmount: number,
    userId: string,
  ): Promise<{
    canApply: boolean;
    estimatedDiscount: number;
    reason: string;
  }> {
    try {
      const userCoupon =
        await this.userCouponRepository.findByIdWithRelations(userCouponId);

      if (!userCoupon || userCoupon.userId !== userId) {
        return {
          canApply: false,
          estimatedDiscount: 0,
          reason: '쿠폰을 찾을 수 없습니다.',
        };
      }

      if (!userCoupon.isUsable()) {
        return {
          canApply: false,
          estimatedDiscount: 0,
          reason: '사용할 수 없는 쿠폰입니다.',
        };
      }

      const coupon = userCoupon.coupon;
      if (!coupon || !coupon.isCurrentlyValid()) {
        return {
          canApply: false,
          estimatedDiscount: 0,
          reason: '유효하지 않은 쿠폰입니다.',
        };
      }

      if (!coupon.meetsMinOrderAmount(totalAmount)) {
        return {
          canApply: false,
          estimatedDiscount: 0,
          reason: `최소 주문 금액 ${coupon.minOrderAmount.toLocaleString()}원이 필요합니다.`,
        };
      }

      // 예상 할인 금액 계산
      const estimatedDiscount = coupon.calculateDiscount(totalAmount);

      return {
        canApply: true,
        estimatedDiscount,
        reason: `약 ${estimatedDiscount.toLocaleString()}원 할인 예상`,
      };
    } catch (error) {
      console.error('할인 적용 가능 여부 확인 중 오류 발생:', error);
      return {
        canApply: false,
        estimatedDiscount: 0,
        reason: '확인 중 오류가 발생했습니다.',
      };
    }
  }

  /**
   * 할인 통계 생성
   */
  async generateDiscountStatistics(
    userId: string,
    orderItems: OrderItem[],
  ): Promise<{
    totalCoupons: number;
    applicableCoupons: number;
    maxDiscount: number;
    minDiscount: number;
    averageDiscount: number;
    discountRange: {
      low: CouponApplicationResult[];
      medium: CouponApplicationResult[];
      high: CouponApplicationResult[];
    };
  }> {
    try {
      const availableCoupons =
        await this.couponValidationService.getAvailableCouponsForOrder(
          userId,
          orderItems,
        );

      const totalCoupons = availableCoupons.length;
      const applicableCoupons = availableCoupons.filter(
        (c) => c.success,
      ).length;

      if (applicableCoupons === 0) {
        return {
          totalCoupons,
          applicableCoupons: 0,
          maxDiscount: 0,
          minDiscount: 0,
          averageDiscount: 0,
          discountRange: { low: [], medium: [], high: [] },
        };
      }

      const discountAmounts = availableCoupons
        .filter((c) => c.discount)
        .map((c) => c.discount!.discountAmount);

      const maxDiscount = Math.max(...discountAmounts);
      const minDiscount = Math.min(...discountAmounts);
      const averageDiscount =
        discountAmounts.reduce((a, b) => a + b, 0) / discountAmounts.length;

      // 할인 범위별 분류 (임의의 기준)
      const threshold1 = averageDiscount * 0.5;
      const threshold2 = averageDiscount * 1.5;

      const discountRange = {
        low: availableCoupons.filter(
          (c) => c.discount && c.discount.discountAmount <= threshold1,
        ),
        medium: availableCoupons.filter(
          (c) =>
            c.discount &&
            c.discount.discountAmount > threshold1 &&
            c.discount.discountAmount <= threshold2,
        ),
        high: availableCoupons.filter(
          (c) => c.discount && c.discount.discountAmount > threshold2,
        ),
      };

      return {
        totalCoupons,
        applicableCoupons,
        maxDiscount,
        minDiscount,
        averageDiscount,
        discountRange,
      };
    } catch (error) {
      console.error('할인 통계 생성 중 오류 발생:', error);
      return {
        totalCoupons: 0,
        applicableCoupons: 0,
        maxDiscount: 0,
        minDiscount: 0,
        averageDiscount: 0,
        discountRange: { low: [], medium: [], high: [] },
      };
    }
  }
}
