import { Injectable } from '@nestjs/common';
import { CouponRepository } from '../repositories/coupon.repository';
import { UserCouponRepository } from '../repositories/user-coupon.repository';
import {
  CouponValidationResult,
  DiscountResult,
  CouponApplicationResult,
  OrderItem,
  ValidationError,
} from '../interfaces/coupon-validation.interface';
import { UserCouponStatus, DiscountType, ApplicableType } from '../enums';

@Injectable()
export class CouponValidationService {
  constructor(
    private readonly couponRepository: CouponRepository,
    private readonly userCouponRepository: UserCouponRepository,
  ) {}

  /**
   * 쿠폰 사용 가능성 검증
   */
  async validateCouponUsage(
    userCouponId: string,
    orderItems: OrderItem[],
    userId: string,
  ): Promise<CouponValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 사용자 쿠폰 조회
      const userCoupon =
        await this.userCouponRepository.findByIdWithRelations(userCouponId);

      if (!userCoupon) {
        errors.push(ValidationError.USER_COUPON_NOT_FOUND);
        return { isValid: false, errors, warnings };
      }

      // 소유권 확인
      if (userCoupon.userId !== userId) {
        errors.push(ValidationError.USER_COUPON_NOT_FOUND);
        return { isValid: false, errors, warnings };
      }

      // 쿠폰 정보 조회
      const coupon = userCoupon.coupon;
      if (!coupon) {
        errors.push(ValidationError.COUPON_NOT_FOUND);
        return { isValid: false, errors, warnings };
      }

      // 기본 쿠폰 검증
      const basicValidation = this.validateBasicCouponRules(userCoupon, coupon);
      errors.push(...basicValidation.errors);
      warnings.push(...basicValidation.warnings);

      // 주문 조건 검증
      const orderValidation = await this.validateOrderConditions(
        coupon,
        orderItems,
      );
      errors.push(...orderValidation.errors);
      warnings.push(...orderValidation.warnings);

      const isValid = errors.length === 0;

      return {
        isValid,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined,
        couponInfo: isValid
          ? {
              id: coupon.id,
              name: coupon.name,
              discountType: coupon.discountType,
              discountValue: coupon.discountValue,
              minOrderAmount: coupon.minOrderAmount,
              maxDiscountAmount: coupon.maxDiscountAmount,
            }
          : undefined,
      };
    } catch (error) {
      console.error('쿠폰 검증 중 오류 발생:', error);
      return {
        isValid: false,
        errors: [ValidationError.SYSTEM_ERROR],
        warnings,
      };
    }
  }

  /**
   * 기본 쿠폰 규칙 검증
   */
  private validateBasicCouponRules(
    userCoupon: any,
    coupon: any,
  ): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 쿠폰 활성 상태 확인
    if (!coupon.isActive) {
      errors.push(ValidationError.COUPON_INACTIVE);
    }

    // 사용자 쿠폰 상태 확인
    if (userCoupon.status !== UserCouponStatus.ACTIVE) {
      if (userCoupon.status === UserCouponStatus.USED) {
        errors.push(ValidationError.USER_COUPON_ALREADY_USED);
      } else if (userCoupon.status === UserCouponStatus.EXPIRED) {
        errors.push(ValidationError.COUPON_EXPIRED);
      }
    }

    // 만료일 확인
    if (userCoupon.isExpired()) {
      errors.push(ValidationError.COUPON_EXPIRED);
    } else if (userCoupon.isExpiringSoon()) {
      warnings.push('쿠폰이 곧 만료됩니다.');
    }

    // 쿠폰 재고 확인
    if (!coupon.hasStock()) {
      errors.push(ValidationError.COUPON_OUT_OF_STOCK);
    }

    return { errors, warnings };
  }

  /**
   * 주문 조건 검증
   */
  private async validateOrderConditions(
    coupon: any,
    orderItems: OrderItem[],
  ): Promise<{
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 주문 총액 계산
    const totalOrderAmount = orderItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );

    // 최소 주문 금액 확인
    if (!coupon.meetsMinOrderAmount(totalOrderAmount)) {
      errors.push(ValidationError.MIN_ORDER_AMOUNT_NOT_MET);
    }

    // 적용 가능한 상품 확인
    const applicableItems = this.getApplicableItems(coupon, orderItems);
    if (applicableItems.length === 0) {
      errors.push(ValidationError.NO_APPLICABLE_ITEMS);
    }

    return { errors, warnings };
  }

  /**
   * 적용 가능한 상품 목록 조회
   */
  private getApplicableItems(
    coupon: any,
    orderItems: OrderItem[],
  ): OrderItem[] {
    if (coupon.applicableType === ApplicableType.ALL) {
      return orderItems;
    }

    const targetIds = coupon.getApplicableTargetIds();
    if (targetIds.length === 0) {
      return [];
    }

    return orderItems.filter((item) => {
      if (coupon.applicableType === ApplicableType.CATEGORY) {
        return item.categoryId && targetIds.includes(item.categoryId);
      } else if (coupon.applicableType === ApplicableType.ITEM) {
        return targetIds.includes(item.itemId);
      }
      return false;
    });
  }

  /**
   * 할인 금액 계산
   */
  async calculateDiscount(
    userCouponId: string,
    orderItems: OrderItem[],
    userId: string,
  ): Promise<DiscountResult | null> {
    const validation = await this.validateCouponUsage(
      userCouponId,
      orderItems,
      userId,
    );

    if (!validation.isValid || !validation.couponInfo) {
      return null;
    }

    const userCoupon =
      await this.userCouponRepository.findByIdWithRelations(userCouponId);
    
    if (!userCoupon) {
      return null;
    }
    
    const coupon = userCoupon.coupon;

    // 적용 가능한 상품 목록
    const applicableItems = this.getApplicableItems(coupon, orderItems);

    // 적용 가능한 상품의 총액
    const applicableAmount = applicableItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );

    // 할인 금액 계산
    let discountAmount = coupon.calculateDiscount(applicableAmount);

    // 최대 할인 금액 적용 여부
    const maxDiscountApplied: boolean =
      coupon.discountType === DiscountType.PERCENTAGE &&
      coupon.maxDiscountAmount &&
      discountAmount >= coupon.maxDiscountAmount ? true : false;

    // 할인 금액이 적용 가능 금액을 초과하지 않도록 제한
    discountAmount = Math.min(discountAmount, applicableAmount);

    const originalAmount = orderItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const finalAmount = originalAmount - discountAmount;

    return {
      discountAmount,
      originalAmount,
      finalAmount,
      applicableItems,
      discountDetails: {
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        calculatedDiscount: discountAmount,
        maxDiscountApplied,
      },
    };
  }

  /**
   * 쿠폰 적용 (검증 + 할인 계산 통합)
   */
  async applyCoupon(
    userCouponId: string,
    orderItems: OrderItem[],
    userId: string,
  ): Promise<CouponApplicationResult> {
    try {
      // 검증 수행
      const validation = await this.validateCouponUsage(
        userCouponId,
        orderItems,
        userId,
      );

      if (!validation.isValid) {
        return {
          success: false,
          validation,
        };
      }

      // 할인 계산
      const discount = await this.calculateDiscount(
        userCouponId,
        orderItems,
        userId,
      );

      if (!discount) {
        return {
          success: false,
          validation: {
            isValid: false,
            errors: [ValidationError.SYSTEM_ERROR],
          },
        };
      }

      return {
        success: true,
        validation,
        discount,
        userCouponId,
      };
    } catch (error) {
      console.error('쿠폰 적용 중 오류 발생:', error);
      return {
        success: false,
        validation: {
          isValid: false,
          errors: [ValidationError.SYSTEM_ERROR],
        },
      };
    }
  }

  /**
   * 사용자의 사용 가능한 쿠폰 목록 조회 (주문 조건 포함)
   */
  async getAvailableCouponsForOrder(
    userId: string,
    orderItems: OrderItem[],
  ): Promise<CouponApplicationResult[]> {
    try {
      const totalOrderAmount = orderItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );
      const targetIds: string[] = [
        ...orderItems.map((item) => item.itemId),
        ...orderItems.map((item) => item.categoryId).filter((id): id is string => id !== undefined),
      ];

      // 적용 가능한 사용자 쿠폰 조회
      const userCoupons =
        await this.userCouponRepository.findApplicableForOrder(
          userId,
          totalOrderAmount,
          targetIds,
        );

      // 각 쿠폰에 대해 적용 결과 계산
      const results = await Promise.all(
        userCoupons.map((userCoupon) =>
          this.applyCoupon(userCoupon.id, orderItems, userId),
        ),
      );

      // 성공적으로 적용 가능한 쿠폰만 반환
      return results.filter((result) => result.success);
    } catch (error) {
      console.error('사용 가능한 쿠폰 조회 중 오류 발생:', error);
      return [];
    }
  }
}
