import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Order } from '../../order/entities/order.entity';
import { Inventory } from '../../inventory/entities/inventory.entity';

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'integer', default: 0 })
  stock: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 관계 설정
  @OneToMany(() => Order, (order) => order.item)
  orders: Order[];

  @OneToMany(() => Inventory, (inventory) => inventory.item)
  inventories: Inventory[];

  /**
   * 비즈니스 로직: 재고 확인
   */
  hasStock(requiredQuantity: number): boolean {
    return this.stock >= requiredQuantity;
  }

  /**
   * 비즈니스 로직: 판매 가능 여부 확인
   */
  isAvailableForSale(): boolean {
    return this.isActive && this.stock > 0;
  }

  /**
   * 비즈니스 로직: 총 가격 계산
   */
  calculateTotalPrice(quantity: number): number {
    return Number(this.price) * quantity;
  }
}
