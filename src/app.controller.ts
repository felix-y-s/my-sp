import { Controller, Get, Post, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { UserService } from './modules/user/user.service';
import { ItemService } from './modules/item/item.service';
import { OrderService } from './modules/order/order.service';
import { InventoryService } from './modules/inventory/inventory.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly userService: UserService,
    private readonly itemService: ItemService,
    private readonly orderService: OrderService,
    private readonly inventoryService: InventoryService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * 테스트 데이터 초기화
   */
  @Post('setup-test-data')
  async setupTestData() {
    try {
      // 테스트 사용자 생성
      const user = await this.userService.createUser('testuser', 50000);
      
      // 테스트 아이템 생성
      const sword = await this.itemService.createItem('마법검', 10000, 50);
      const shield = await this.itemService.createItem('방패', 5000, 30);
      const potion = await this.itemService.createItem('회복물약', 1000, 100);

      return {
        success: true,
        message: '테스트 데이터가 성공적으로 생성되었습니다.',
        data: {
          user: { id: user.id, username: user.username, balance: user.balance },
          items: [
            { id: sword.id, name: sword.name, price: sword.price, stock: sword.stock },
            { id: shield.id, name: shield.name, price: shield.price, stock: shield.stock },
            { id: potion.id, name: potion.name, price: potion.price, stock: potion.stock },
          ]
        }
      };

    } catch (error) {
      return {
        success: false,
        message: '테스트 데이터 생성 중 오류가 발생했습니다.',
        error: error.message,
      };
    }
  }

  /**
   * 사용자 잔고 조회
   */
  @Get('user/:id/balance')
  async getUserBalance(@Param('id') userId: string) {
    const balance = await this.userService.getBalance(userId);
    return { userId, balance };
  }

  /**
   * 사용자 인벤토리 조회
   */
  @Get('user/:id/inventory')
  async getUserInventory(@Param('id') userId: string) {
    const inventory = await this.inventoryService.getUserInventory(userId);
    return { userId, inventory };
  }

  /**
   * 아이템 목록 조회
   */
  @Get('items')
  async getItems() {
    const items = await this.itemService.findAll();
    return { items };
  }

  /**
   * 주문 목록 조회 (사용자별)
   */
  @Get('user/:id/orders')
  async getUserOrders(@Param('id') userId: string) {
    const orders = await this.orderService.findByUserId(userId);
    return { userId, orders };
  }
}
