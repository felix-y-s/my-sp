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

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  username: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 20 })
  maxInventorySlots: number;

  @CreateDateColumn({ 
    type: 'timestamptz'
  })
  createdAt: Date;

  @UpdateDateColumn({ 
    type: 'timestamptz'
  })
  updatedAt: Date;

  // 관계 설정
  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Inventory, (inventory) => inventory.user)
  inventories: Inventory[];

  /**
   * 비즈니스 로직: 잔고 확인
   */
  canAfford(amount: number): boolean {
    return this.balance >= amount;
  }

  /**
   * 비즈니스 로직: 활성 사용자 확인
   */
  isActiveUser(): boolean {
    return this.isActive;
  }

  /**
   * 비즈니스 로직: 인벤토리 공간 확인
   */
  hasInventorySpace(currentItemCount: number): boolean {
    return currentItemCount < this.maxInventorySlots;
  }
}
