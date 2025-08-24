import { DataSource } from 'typeorm';

/**
 * 쿠폰 테스트 데이터 시드
 */
export async function seedCoupons(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    // 관리자 사용자 ID (실제 환경에서는 존재하는 사용자 ID 사용)
    const adminUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'; // 예시 UUID

    // 테스트용 쿠폰 데이터
    const testCoupons = [
      {
        id: 'c1a1a1a1-1111-1111-1111-111111111111',
        name: '신규가입 축하 쿠폰',
        description: '신규가입 고객을 위한 10% 할인 쿠폰',
        discount_type: 'PERCENTAGE',
        discount_value: 10.0,
        min_order_amount: 10000.0,
        max_discount_amount: 5000.0,
        applicable_type: 'ALL',
        applicable_target_ids: null,
        total_quantity: 1000,
        used_quantity: 0,
        validity_type: 'RELATIVE',
        validity_days: 30,
        valid_from: null,
        valid_until: null,
        is_active: true,
        created_by: adminUserId,
      },
      {
        id: 'c2a2a2a2-2222-2222-2222-222222222222',
        name: '첫 구매 2000원 할인',
        description: '첫 구매 시 2000원 즉시 할인',
        discount_type: 'FIXED_AMOUNT',
        discount_value: 2000.0,
        min_order_amount: 5000.0,
        max_discount_amount: null,
        applicable_type: 'ALL',
        applicable_target_ids: null,
        total_quantity: 500,
        used_quantity: 0,
        validity_type: 'ABSOLUTE',
        validity_days: null,
        valid_from: '2024-01-01 00:00:00',
        valid_until: '2024-12-31 23:59:59',
        is_active: true,
        created_by: adminUserId,
      },
      {
        id: 'c3a3a3a3-3333-3333-3333-333333333333',
        name: '전자제품 15% 할인',
        description: '전자제품 카테고리 상품 15% 할인',
        discount_type: 'PERCENTAGE',
        discount_value: 15.0,
        min_order_amount: 50000.0,
        max_discount_amount: 10000.0,
        applicable_type: 'CATEGORY',
        applicable_target_ids: JSON.stringify(['electronics', 'gadgets']),
        total_quantity: 200,
        used_quantity: 0,
        validity_type: 'RELATIVE',
        validity_days: 14,
        valid_from: null,
        valid_until: null,
        is_active: true,
        created_by: adminUserId,
      },
      {
        id: 'c4a4a4a4-4444-4444-4444-444444444444',
        name: '특정 상품 5000원 할인',
        description: '특정 인기 상품에만 적용되는 5000원 할인',
        discount_type: 'FIXED_AMOUNT',
        discount_value: 5000.0,
        min_order_amount: 20000.0,
        max_discount_amount: null,
        applicable_type: 'ITEM',
        applicable_target_ids: JSON.stringify(['item_123', 'item_456']),
        total_quantity: 100,
        used_quantity: 0,
        validity_type: 'ABSOLUTE',
        validity_days: null,
        valid_from: '2024-03-01 00:00:00',
        valid_until: '2024-03-31 23:59:59',
        is_active: true,
        created_by: adminUserId,
      },
    ];

    // 쿠폰 데이터 삽입
    for (const coupon of testCoupons) {
      await queryRunner.query(
        `
        INSERT INTO coupons (
          id, name, description, discount_type, discount_value, min_order_amount,
          max_discount_amount, applicable_type, applicable_target_ids, total_quantity,
          used_quantity, validity_type, validity_days, valid_from, valid_until,
          is_active, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        )
        ON CONFLICT (id) DO NOTHING
      `,
        [
          coupon.id,
          coupon.name,
          coupon.description,
          coupon.discount_type,
          coupon.discount_value,
          coupon.min_order_amount,
          coupon.max_discount_amount,
          coupon.applicable_type,
          coupon.applicable_target_ids,
          coupon.total_quantity,
          coupon.used_quantity,
          coupon.validity_type,
          coupon.validity_days,
          coupon.valid_from,
          coupon.valid_until,
          coupon.is_active,
          coupon.created_by,
        ],
      );
    }

    console.log('✅ 쿠폰 시드 데이터 삽입 완료');
    console.log(`   - 총 ${testCoupons.length}개 쿠폰 생성`);
    console.log('   - 신규가입 축하 쿠폰 (10% 할인)');
    console.log('   - 첫 구매 2000원 할인');
    console.log('   - 전자제품 15% 할인');
    console.log('   - 특정 상품 5000원 할인');
  } catch (error) {
    console.error('❌ 쿠폰 시드 데이터 삽입 실패:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}

/**
 * 개발용 사용자 쿠폰 시드 데이터
 */
export async function seedUserCoupons(
  dataSource: DataSource,
  userId: string,
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    // 테스트 사용자에게 쿠폰 발급
    const userCoupons = [
      {
        user_id: userId,
        coupon_id: 'c1a1a1a1-1111-1111-1111-111111111111',
        status: 'ACTIVE',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30일 후
      },
      {
        user_id: userId,
        coupon_id: 'c2a2a2a2-2222-2222-2222-222222222222',
        status: 'ACTIVE',
        expires_at: new Date('2024-12-31'),
      },
    ];

    for (const userCoupon of userCoupons) {
      await queryRunner.query(
        `
        INSERT INTO user_coupons (user_id, coupon_id, status, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, coupon_id) DO NOTHING
      `,
        [
          userCoupon.user_id,
          userCoupon.coupon_id,
          userCoupon.status,
          userCoupon.expires_at,
        ],
      );
    }

    console.log(`✅ 사용자 쿠폰 시드 데이터 삽입 완료 (사용자: ${userId})`);
    console.log(`   - 발급된 쿠폰 ${userCoupons.length}개`);
  } catch (error) {
    console.error('❌ 사용자 쿠폰 시드 데이터 삽입 실패:', error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}
