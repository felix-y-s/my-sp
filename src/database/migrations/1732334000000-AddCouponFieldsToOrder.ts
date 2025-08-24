import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCouponFieldsToOrder1732334000000 implements MigrationInterface {
  name = 'AddCouponFieldsToOrder1732334000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders" 
      ADD COLUMN "discountAmount" decimal(10,2) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "orders" 
      ADD COLUMN "finalAmount" decimal(10,2) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "orders" 
      ADD COLUMN "userCouponId" varchar(36) NULL
    `);

    // 기존 주문들의 finalAmount를 totalAmount로 설정
    await queryRunner.query(`
      UPDATE "orders" 
      SET "finalAmount" = "totalAmount" 
      WHERE "finalAmount" = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "userCouponId"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "finalAmount"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "discountAmount"`,
    );
  }
}
