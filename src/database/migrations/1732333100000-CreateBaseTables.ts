import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBaseTables1732333100000 implements MigrationInterface {
    name = 'CreateBaseTables1732333100000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."audit_status_enum" AS ENUM('success', 'failed', 'blocked')`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying(100) NOT NULL, "resource" character varying(100) NOT NULL, "resourceId" character varying(255) NOT NULL, "userId" character varying(100), "userRole" character varying(50), "details" json, "ipAddress" character varying(45), "userAgent" text, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "status" "public"."audit_status_enum" NOT NULL DEFAULT 'success', "severity" smallint NOT NULL DEFAULT '3', CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id")); COMMENT ON COLUMN "audit_logs"."action" IS '수행된 액션'; COMMENT ON COLUMN "audit_logs"."resource" IS '대상 리소스 타입'; COMMENT ON COLUMN "audit_logs"."resourceId" IS '리소스 식별자'; COMMENT ON COLUMN "audit_logs"."userId" IS '사용자 ID'; COMMENT ON COLUMN "audit_logs"."userRole" IS '사용자 역할'; COMMENT ON COLUMN "audit_logs"."details" IS '상세 정보'; COMMENT ON COLUMN "audit_logs"."ipAddress" IS 'IP 주소'; COMMENT ON COLUMN "audit_logs"."userAgent" IS 'User Agent'; COMMENT ON COLUMN "audit_logs"."timestamp" IS '로그 생성 시각'; COMMENT ON COLUMN "audit_logs"."status" IS '결과 상태 (success, failed, blocked)'; COMMENT ON COLUMN "audit_logs"."severity" IS '중요도 (1-5)'`);
        await queryRunner.query(`CREATE INDEX "IDX_88dcc148d532384790ab874c3d" ON "audit_logs" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_cfa83f61e4d27a87fcae1e025a" ON "audit_logs" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_235341a5f629c56a9f6e0f61c1" ON "audit_logs" ("resource", "action") `);
        await queryRunner.query(`CREATE TABLE "items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "description" character varying(500), "price" numeric(10,2) NOT NULL, "stock" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ba5885359424c15ca6b9e79bcf6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "inventories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quantity" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "itemId" uuid NOT NULL, CONSTRAINT "UQ_59508729e2a5c15031ccc06fbe0" UNIQUE ("userId", "itemId"), CONSTRAINT "PK_7b1946392ffdcb50cfc6ac78c0e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(100) NOT NULL, "balance" numeric(10,2) NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "maxInventorySlots" integer NOT NULL DEFAULT '20', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."order_status_enum" AS ENUM('PENDING', 'PROCESSING', 'CONFIRMED', 'COMPLETED', 'FAILED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quantity" integer NOT NULL, "totalAmount" numeric(10,2) NOT NULL, "discountAmount" numeric(10,2) NOT NULL DEFAULT '0', "finalAmount" numeric(10,2) NOT NULL, "userCouponId" uuid, "status" "public"."order_status_enum" NOT NULL DEFAULT 'PENDING', "failureReason" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "itemId" uuid NOT NULL, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id")); COMMENT ON COLUMN "orders"."discountAmount" IS '할인 금액'; COMMENT ON COLUMN "orders"."finalAmount" IS '최종 결제 금액'; COMMENT ON COLUMN "orders"."userCouponId" IS '사용된 사용자 쿠폰 ID'`);
        await queryRunner.query(`CREATE TYPE "public"."reservation_status_enum" AS ENUM('RESERVED', 'CONFIRMED', 'CANCELLED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TABLE "item_reservations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" character varying NOT NULL, "itemId" character varying NOT NULL, "userId" character varying NOT NULL, "reservedQuantity" integer NOT NULL, "originalStock" integer NOT NULL, "status" "public"."reservation_status_enum" NOT NULL DEFAULT 'RESERVED', "reservedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "cancelReason" character varying, CONSTRAINT "PK_3d7f965f10c2ef4e911607f3572" PRIMARY KEY ("id")); COMMENT ON COLUMN "item_reservations"."orderId" IS '주문 ID'; COMMENT ON COLUMN "item_reservations"."itemId" IS '아이템 ID'; COMMENT ON COLUMN "item_reservations"."userId" IS '사용자 ID'; COMMENT ON COLUMN "item_reservations"."reservedQuantity" IS '예약 수량'; COMMENT ON COLUMN "item_reservations"."originalStock" IS '예약 당시 원본 재고'; COMMENT ON COLUMN "item_reservations"."status" IS '예약 상태 (RESERVED, CONFIRMED, CANCELLED, EXPIRED)'; COMMENT ON COLUMN "item_reservations"."reservedAt" IS '예약 생성 시간'; COMMENT ON COLUMN "item_reservations"."expiresAt" IS '만료 시간 (TTL)'; COMMENT ON COLUMN "item_reservations"."cancelReason" IS '취소/만료 사유'`);
        await queryRunner.query(`CREATE INDEX "IDX_1dab57341cf680e438dcb599c1" ON "item_reservations" ("status", "expiresAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_3b09dba4a8c25fe949998462e5" ON "item_reservations" ("itemId", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_c8d4fa8243b74ee169a8d1f4bf" ON "item_reservations" ("orderId") `);
        await queryRunner.query(`CREATE TYPE "public"."discount_type_enum" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT')`);
        await queryRunner.query(`CREATE TYPE "public"."applicable_type_enum" AS ENUM('ALL', 'CATEGORY', 'ITEM')`);
        await queryRunner.query(`CREATE TYPE "public"."validity_type_enum" AS ENUM('RELATIVE', 'ABSOLUTE')`);
        await queryRunner.query(`CREATE TABLE "coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "description" text, "discountType" "public"."discount_type_enum" NOT NULL, "discountValue" numeric(10,2) NOT NULL, "minOrderAmount" numeric(10,2) NOT NULL DEFAULT '0', "maxDiscountAmount" numeric(10,2), "applicableType" "public"."applicable_type_enum" NOT NULL, "applicableTargetIds" text, "totalQuantity" integer NOT NULL DEFAULT '0', "usedQuantity" integer NOT NULL DEFAULT '0', "validityType" "public"."validity_type_enum" NOT NULL, "validityDays" integer, "validFrom" TIMESTAMP WITH TIME ZONE, "validUntil" TIMESTAMP WITH TIME ZONE, "isActive" boolean NOT NULL DEFAULT true, "createdBy" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id")); COMMENT ON COLUMN "coupons"."name" IS '쿠폰명'; COMMENT ON COLUMN "coupons"."description" IS '쿠폰 설명'; COMMENT ON COLUMN "coupons"."discountType" IS '할인 타입 (정률/정액)'; COMMENT ON COLUMN "coupons"."discountValue" IS '할인값 (퍼센트 또는 금액)'; COMMENT ON COLUMN "coupons"."minOrderAmount" IS '최소 주문 금액'; COMMENT ON COLUMN "coupons"."maxDiscountAmount" IS '최대 할인 금액 (정률 할인 시)'; COMMENT ON COLUMN "coupons"."applicableType" IS '적용 범위 (전체/카테고리/상품)'; COMMENT ON COLUMN "coupons"."applicableTargetIds" IS '적용 대상 ID 목록 (카테고리/상품 ID, JSON 형태)'; COMMENT ON COLUMN "coupons"."totalQuantity" IS '총 발급 수량'; COMMENT ON COLUMN "coupons"."usedQuantity" IS '사용된 수량'; COMMENT ON COLUMN "coupons"."validityType" IS '유효기간 타입 (상대적/절대적)'; COMMENT ON COLUMN "coupons"."validityDays" IS '상대적 유효기간 (일수)'; COMMENT ON COLUMN "coupons"."validFrom" IS '절대적 유효기간 시작'; COMMENT ON COLUMN "coupons"."validUntil" IS '절대적 유효기간 종료'; COMMENT ON COLUMN "coupons"."isActive" IS '활성화 여부'; COMMENT ON COLUMN "coupons"."createdBy" IS '생성자 ID'; COMMENT ON COLUMN "coupons"."createdAt" IS '생성일시'; COMMENT ON COLUMN "coupons"."updatedAt" IS '수정일시'`);
        await queryRunner.query(`CREATE TABLE "coupon_usage_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userCouponId" uuid NOT NULL, "usedInOrderId" uuid NOT NULL, "discountAmount" numeric(10,2) NOT NULL, "originalAmount" numeric(10,2) NOT NULL, "finalAmount" numeric(10,2) NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isConfirmed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_e2abb22bac9ed39ba0c3d4268ab" PRIMARY KEY ("id")); COMMENT ON COLUMN "coupon_usage_logs"."userCouponId" IS '사용자 쿠폰 ID'; COMMENT ON COLUMN "coupon_usage_logs"."usedInOrderId" IS '주문 ID'; COMMENT ON COLUMN "coupon_usage_logs"."discountAmount" IS '실제 적용된 할인 금액'; COMMENT ON COLUMN "coupon_usage_logs"."originalAmount" IS '할인 적용 전 원래 주문 금액'; COMMENT ON COLUMN "coupon_usage_logs"."finalAmount" IS '할인 적용 후 최종 결제 금액'; COMMENT ON COLUMN "coupon_usage_logs"."usedAt" IS '쿠폰 사용일시'; COMMENT ON COLUMN "coupon_usage_logs"."isConfirmed" IS '사용 확정 여부'`);
        await queryRunner.query(`CREATE INDEX "IDX_ecb4d45da842031c126a5828a7" ON "coupon_usage_logs" ("usedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a64018bbd4ace27a6345cc2aab" ON "coupon_usage_logs" ("usedInOrderId") `);
        await queryRunner.query(`CREATE TYPE "public"."user_coupon_status_enum" AS ENUM('ACTIVE', 'USED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TABLE "user_coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "couponId" uuid NOT NULL, "status" "public"."user_coupon_status_enum" NOT NULL DEFAULT 'ACTIVE', "issuedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "usedInOrderId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b9e7272f1f73463f57827b601ca" PRIMARY KEY ("id")); COMMENT ON COLUMN "user_coupons"."userId" IS '사용자 ID'; COMMENT ON COLUMN "user_coupons"."couponId" IS '쿠폰 ID'; COMMENT ON COLUMN "user_coupons"."status" IS '쿠폰 상태'; COMMENT ON COLUMN "user_coupons"."issuedAt" IS '쿠폰 발급일시'; COMMENT ON COLUMN "user_coupons"."expiresAt" IS '쿠폰 만료일시'; COMMENT ON COLUMN "user_coupons"."usedAt" IS '쿠폰 사용일시'; COMMENT ON COLUMN "user_coupons"."usedInOrderId" IS '사용된 주문 ID'; COMMENT ON COLUMN "user_coupons"."createdAt" IS '생성일시'; COMMENT ON COLUMN "user_coupons"."updatedAt" IS '수정일시'`);
        await queryRunner.query(`CREATE INDEX "IDX_3211ae98e3308a2670560bc74a" ON "user_coupons" ("expiresAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_3181c0012fecdd5b0672489542" ON "user_coupons" ("userId", "status") `);
        await queryRunner.query(`ALTER TABLE "inventories" ADD CONSTRAINT "FK_c539850d38648884689da06c123" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inventories" ADD CONSTRAINT "FK_dba77c53cc779a4c890647f6c74" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_151b79a83ba240b0cb31b2302d1" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_4fba2ea9e06c0fd14579ab97ed2" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coupon_usage_logs" ADD CONSTRAINT "FK_0972e932c0863ed80133c77067f" FOREIGN KEY ("userCouponId") REFERENCES "user_coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_coupons" ADD CONSTRAINT "FK_8c358ab3b82c503b6c1c30350bf" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_coupons" ADD CONSTRAINT "FK_136f241e87d0465785012ad3617" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_coupons" DROP CONSTRAINT "FK_136f241e87d0465785012ad3617"`);
        await queryRunner.query(`ALTER TABLE "user_coupons" DROP CONSTRAINT "FK_8c358ab3b82c503b6c1c30350bf"`);
        await queryRunner.query(`ALTER TABLE "coupon_usage_logs" DROP CONSTRAINT "FK_0972e932c0863ed80133c77067f"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_4fba2ea9e06c0fd14579ab97ed2"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_151b79a83ba240b0cb31b2302d1"`);
        await queryRunner.query(`ALTER TABLE "inventories" DROP CONSTRAINT "FK_dba77c53cc779a4c890647f6c74"`);
        await queryRunner.query(`ALTER TABLE "inventories" DROP CONSTRAINT "FK_c539850d38648884689da06c123"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3181c0012fecdd5b0672489542"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3211ae98e3308a2670560bc74a"`);
        await queryRunner.query(`DROP TABLE "user_coupons"`);
        await queryRunner.query(`DROP TYPE "public"."user_coupon_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a64018bbd4ace27a6345cc2aab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ecb4d45da842031c126a5828a7"`);
        await queryRunner.query(`DROP TABLE "coupon_usage_logs"`);
        await queryRunner.query(`DROP TABLE "coupons"`);
        await queryRunner.query(`DROP TYPE "public"."validity_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."applicable_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."discount_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c8d4fa8243b74ee169a8d1f4bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3b09dba4a8c25fe949998462e5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1dab57341cf680e438dcb599c1"`);
        await queryRunner.query(`DROP TABLE "item_reservations"`);
        await queryRunner.query(`DROP TYPE "public"."reservation_status_enum"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."order_status_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "inventories"`);
        await queryRunner.query(`DROP TABLE "items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_235341a5f629c56a9f6e0f61c1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cfa83f61e4d27a87fcae1e025a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_88dcc148d532384790ab874c3d"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."audit_status_enum"`);
    }

}
