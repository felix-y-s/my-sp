/**
 * Saga Choreography 패턴 테스트 스크립트
 * 아이템 구매 프로세스 전체 플로우 테스트
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../modules/user/user.service';
import { ItemService } from '../modules/item/item.service';
import { OrderService } from '../modules/order/order.service';
import { InventoryService } from '../modules/inventory/inventory.service';

async function testSagaFlow() {
  console.log('🚀 Saga Choreography 패턴 테스트 시작\n');

  const app = await NestFactory.createApplicationContext(AppModule);

  const userService = app.get(UserService);
  const itemService = app.get(ItemService);
  const orderService = app.get(OrderService);
  const inventoryService = app.get(InventoryService);

  try {
    // 1. 테스트 데이터 생성
    console.log('📦 테스트 데이터 생성 중...');
    const user = await userService.createUser('테스트사용자', 20000);
    const item = await itemService.createItem('마법검', 10000, 50);

    console.log(`✅ 사용자 생성: ${user.username} (잔고: ${user.balance}원)`);
    console.log(
      `✅ 아이템 생성: ${item.name} (가격: ${item.price}원, 재고: ${item.stock}개)\n`,
    );

    // 2. Saga 테스트 - 성공 케이스
    console.log('🎯 Saga 테스트 1: 정상 구매 프로세스');
    const order1 = await orderService.createOrder({
      userId: user.id,
      itemId: item.id,
      quantity: 1,
    });
    console.log(`📝 주문 생성: ${order1.id}`);

    // 3초 후 결과 확인 (비동기 Saga 처리 대기)
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const finalOrder = await orderService.findOne(order1.id);
    const userBalance = await userService.getBalance(user.id);
    const userInventory = await inventoryService.getUserInventory(user.id);

    console.log(`📊 최종 주문 상태: ${finalOrder.status}`);
    console.log(`💰 사용자 잔고: ${userBalance}원`);
    console.log(`🎒 인벤토리 아이템 수: ${userInventory.length}개`);

    if (
      finalOrder.status === 'COMPLETED' &&
      userBalance === 10000 &&
      userInventory.length === 1
    ) {
      console.log(
        '✅ 테스트 1 성공: Saga 플로우가 정상적으로 완료되었습니다!\n',
      );
    } else {
      console.log('❌ 테스트 1 실패: 예상과 다른 결과입니다.\n');
    }

    // 4. Saga 테스트 - 실패 케이스 (잔고 부족)
    console.log('🎯 Saga 테스트 2: 잔고 부족으로 인한 실패');
    const expensiveItem = await itemService.createItem('전설무기', 50000, 10);

    const order2 = await orderService.createOrder({
      userId: user.id,
      itemId: expensiveItem.id,
      quantity: 1,
    });
    console.log(`📝 주문 생성: ${order2.id} (잔고 부족 예상)`);

    // 3초 후 결과 확인
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const failedOrder = await orderService.findOne(order2.id);
    const finalBalance = await userService.getBalance(user.id);

    console.log(`📊 최종 주문 상태: ${failedOrder.status}`);
    console.log(`💰 사용자 잔고: ${finalBalance}원 (변경 없어야 함)`);

    if (failedOrder.status === 'FAILED' && finalBalance === 10000) {
      console.log(
        '✅ 테스트 2 성공: 실패 시나리오가 정상적으로 처리되었습니다!\n',
      );
    } else {
      console.log(
        '❌ 테스트 2 실패: 보상 트랜잭션이 제대로 동작하지 않았습니다.\n',
      );
    }

    console.log('🎉 모든 Saga 테스트가 완료되었습니다!');
    console.log('\n📝 구현된 Saga Choreography 패턴의 특징:');
    console.log('- 중앙 오케스트레이터 없는 분산 이벤트 처리');
    console.log('- 각 서비스의 독립적인 이벤트 발행/구독');
    console.log('- 실패 시 자동 보상 트랜잭션 실행');
    console.log('- Redis를 통한 이벤트 버스 및 상태 관리');
    console.log('- 동시성 제어를 위한 분산 락 구현');
  } catch (error) {
    console.error('❌ 테스트 실행 중 오류 발생:', error);
  } finally {
    await app.close();
  }
}

// 스크립트 실행
testSagaFlow().catch(console.error);
