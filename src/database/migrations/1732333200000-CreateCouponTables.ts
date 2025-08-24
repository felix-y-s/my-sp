import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCouponTables1732333200000 implements MigrationInterface {
  name = 'CreateCouponTables1732333200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 할인 타입 ENUM 생성
    await queryRunner.query(`
      CREATE TYPE "discount_type_enum" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT')
    `);

    // 적용 타입 ENUM 생성
    await queryRunner.query(`
      CREATE TYPE "applicable_type_enum" AS ENUM('ALL', 'CATEGORY', 'ITEM')
    `);

    // 유효기간 타입 ENUM 생성
    await queryRunner.query(`
      CREATE TYPE "validity_type_enum" AS ENUM('RELATIVE', 'ABSOLUTE')
    `);

    // 쿠폰 마스터 테이블 생성
    await queryRunner.query(`
      CREATE TABLE "coupons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "description" text,
        "discount_type" "discount_type_enum" NOT NULL,
        "discount_value" decimal(10,2) NOT NULL,
        "min_order_amount" decimal(10,2) NOT NULL DEFAULT 0,
        "max_discount_amount" decimal(10,2),
        "applicable_type" "applicable_type_enum" NOT NULL,
        "applicable_target_ids" text array,
        "total_quantity" integer NOT NULL DEFAULT 0,
        "used_quantity" integer NOT NULL DEFAULT 0,
        "validity_type" "validity_type_enum" NOT NULL,
        "validity_days" integer,
        "valid_from" TIMESTAMP,
        "valid_until" TIMESTAMP,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupons" PRIMARY KEY ("id")
      )
    `);

    // 쿠폰 상태 ENUM 생성
    await queryRunner.query(`
      CREATE TYPE "user_coupon_status_enum" AS ENUM('ACTIVE', 'USED', 'EXPIRED')
    `);

    // 사용자 쿠폰 테이블 생성
    await queryRunner.query(`
      CREATE TABLE "user_coupons" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "coupon_id" uuid NOT NULL,
        "status" "user_coupon_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "issued_at" TIMESTAMP NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP NOT NULL,
        "used_at" TIMESTAMP,
        "used_in_order_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_coupons" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_coupons_user_coupon" UNIQUE ("user_id", "coupon_id")
      )
    `);

    // 쿠폰 사용 이력 테이블 생성
    await queryRunner.query(`
      CREATE TABLE "coupon_usage_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_coupon_id" uuid NOT NULL,
        "order_id" uuid NOT NULL,
        "discount_amount" decimal(10,2) NOT NULL,
        "original_amount" decimal(10,2) NOT NULL,
        "final_amount" decimal(10,2) NOT NULL,
        "used_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupon_usage_logs" PRIMARY KEY ("id")
      )
    `);

    // 외래키 제약조건 추가
    await queryRunner.query(`
      ALTER TABLE "user_coupons" 
      ADD CONSTRAINT "FK_user_coupons_coupon" 
      FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_coupons" 
      ADD CONSTRAINT "FK_user_coupons_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "coupon_usage_logs" 
      ADD CONSTRAINT "FK_coupon_usage_logs_user_coupon" 
      FOREIGN KEY ("user_coupon_id") REFERENCES "user_coupons"("id") ON DELETE CASCADE
    `);

    // 성능 최적화를 위한 인덱스 생성
    await queryRunner.query(`
      CREATE INDEX "IDX_coupons_is_active" ON "coupons" ("is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_coupons_valid_period" ON "coupons" ("valid_from", "valid_until")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_coupons_user_status" ON "user_coupons" ("user_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_coupons_expires_at" ON "user_coupons" ("expires_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_coupons_status" ON "user_coupons" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_coupon_usage_logs_order" ON "coupon_usage_logs" ("order_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_coupon_usage_logs_used_at" ON "coupon_usage_logs" ("used_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스 삭제
    await queryRunner.query(`DROP INDEX "IDX_coupon_usage_logs_used_at"`);
    await queryRunner.query(`DROP INDEX "IDX_coupon_usage_logs_order"`);
    await queryRunner.query(`DROP INDEX "IDX_user_coupons_status"`);
    await queryRunner.query(`DROP INDEX "IDX_user_coupons_expires_at"`);
    await queryRunner.query(`DROP INDEX "IDX_user_coupons_user_status"`);
    await queryRunner.query(`DROP INDEX "IDX_coupons_valid_period"`);
    await queryRunner.query(`DROP INDEX "IDX_coupons_is_active"`);

    // 외래키 제약조건 삭제
    await queryRunner.query(
      `ALTER TABLE "coupon_usage_logs" DROP CONSTRAINT "FK_coupon_usage_logs_user_coupon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_coupons" DROP CONSTRAINT "FK_user_coupons_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_coupons" DROP CONSTRAINT "FK_user_coupons_coupon"`,
    );

    // 테이블 삭제
    await queryRunner.query(`DROP TABLE "coupon_usage_logs"`);
    await queryRunner.query(`DROP TABLE "user_coupons"`);
    await queryRunner.query(`DROP TABLE "coupons"`);

    // ENUM 타입 삭제
    await queryRunner.query(`DROP TYPE "user_coupon_status_enum"`);
    await queryRunner.query(`DROP TYPE "validity_type_enum"`);
    await queryRunner.query(`DROP TYPE "applicable_type_enum"`);
    await queryRunner.query(`DROP TYPE "discount_type_enum"`);
  }
}
