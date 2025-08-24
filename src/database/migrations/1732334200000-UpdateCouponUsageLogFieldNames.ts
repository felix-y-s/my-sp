import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCouponUsageLogFieldNames1732334200000
  implements MigrationInterface
{
  name = 'UpdateCouponUsageLogFieldNames1732334200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // SQLite에서는 컬럼명 변경이 복잡하므로 새로운 테이블을 만들고 데이터를 이전
    await queryRunner.query(`
      CREATE TABLE "coupon_usage_logs_new" (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "user_coupon_id" varchar(36) NOT NULL,
        "used_in_order_id" varchar(36) NOT NULL,
        "discount_amount" decimal(10,2) NOT NULL,
        "original_amount" decimal(10,2) NOT NULL,
        "final_amount" decimal(10,2) NOT NULL,
        "is_confirmed" boolean NOT NULL DEFAULT (false),
        "used_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);

    // 기존 데이터 이전 (order_id -> used_in_order_id)
    await queryRunner.query(`
      INSERT INTO "coupon_usage_logs_new" 
      ("id", "user_coupon_id", "used_in_order_id", "discount_amount", "original_amount", "final_amount", "used_at")
      SELECT "id", "user_coupon_id", "order_id", "discount_amount", "original_amount", "final_amount", "used_at"
      FROM "coupon_usage_logs"
    `);

    // 기존 테이블 삭제
    await queryRunner.query(`DROP TABLE "coupon_usage_logs"`);

    // 새 테이블을 원래 이름으로 변경
    await queryRunner.query(
      `ALTER TABLE "coupon_usage_logs_new" RENAME TO "coupon_usage_logs"`,
    );

    // 외래키 제약조건 추가
    await queryRunner.query(`
      CREATE INDEX "IDX_coupon_usage_logs_user_coupon" ON "coupon_usage_logs" ("user_coupon_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_coupon_usage_logs_order" ON "coupon_usage_logs" ("used_in_order_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_coupon_usage_logs_used_at" ON "coupon_usage_logs" ("used_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite에서는 복잡한 rollback이므로 단순히 테이블 재생성
    await queryRunner.query(`DROP TABLE "coupon_usage_logs"`);

    // 원래 테이블 구조로 복원
    await queryRunner.query(`
      CREATE TABLE "coupon_usage_logs" (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "user_coupon_id" varchar(36) NOT NULL,
        "order_id" varchar(36) NOT NULL,
        "discount_amount" decimal(10,2) NOT NULL,
        "original_amount" decimal(10,2) NOT NULL,
        "final_amount" decimal(10,2) NOT NULL,
        "used_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);

    // 인덱스 재생성
    await queryRunner.query(`
      CREATE INDEX "IDX_coupon_usage_logs_order" ON "coupon_usage_logs" ("order_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_coupon_usage_logs_used_at" ON "coupon_usage_logs" ("used_at")
    `);
  }
}
