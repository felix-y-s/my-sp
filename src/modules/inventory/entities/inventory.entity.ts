import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Item } from '../../item/entities/item.entity';

@Entity('inventories')
@Unique(['userId', 'itemId']) // 사용자별 아이템은 하나의 레코드로 관리 (수량으로 구분)
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', default: 1 })
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 관계 설정
  @ManyToOne(() => User, user => user.inventories)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne(() => Item, item => item.inventories)
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @Column({ type: 'varchar' })
  itemId: string;

  /**
   * 비즈니스 로직: 수량 증가
   */
  increaseQuantity(amount: number): void {
    this.quantity += amount;
    this.updatedAt = new Date();
  }

  /**
   * 비즈니스 로직: 수량 감소
   */
  decreaseQuantity(amount: number): boolean {
    if (this.quantity >= amount) {
      this.quantity -= amount;
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * 비즈니스 로직: 수량 확인
   */
  hasQuantity(requiredQuantity: number): boolean {
    return this.quantity >= requiredQuantity;
  }
}