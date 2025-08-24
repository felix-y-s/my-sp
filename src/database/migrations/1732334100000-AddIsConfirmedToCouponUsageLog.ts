import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsConfirmedToCouponUsageLog1732334100000
  implements MigrationInterface
{
  name = 'AddIsConfirmedToCouponUsageLog1732334100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "coupon_usage_logs" 
      ADD COLUMN "isConfirmed" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "coupon_usage_logs" DROP COLUMN "isConfirmed"`,
    );
  }
}
