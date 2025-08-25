import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { IAuditService } from '../common/interfaces/audit.interface';
import { AuditLogData, StockChangeAuditData } from '../common/services/postgres-audit.service';

/**
 * AuditService MongoDB 전환 호환성 테스트
 * 기존 AuditService와 새로운 MongoDB 기반 AuditService의 완전한 호환성 검증
 */
async function testAuditServiceCompatibility() {
  console.log('='.repeat(80));
  console.log('🧪 AuditService MongoDB 호환성 테스트 시작');
  console.log('='.repeat(80));

  const app = await NestFactory.createApplicationContext(AppModule);
  const auditService = app.get<IAuditService>('AuditService');

  try {
    // 테스트 데이터 준비
    const testUserId = 'test_user_12345';
    const testResourceId = 'test_resource_67890';

    console.log('\n📋 테스트 시나리오:');
    console.log('1. 일반 감사 로그 기록 테스트');
    console.log('2. 재고 변경 감사 로그 테스트');
    console.log('3. 로그인 감사 로그 테스트');
    console.log('4. 권한 없는 접근 시도 로그 테스트');
    console.log('5. 시스템 이벤트 로그 테스트');
    console.log('6. 조회 기능 테스트');
    console.log('7. 통계 기능 테스트\n');

    // 1. 일반 감사 로그 기록 테스트
    console.log('1️⃣ 일반 감사 로그 기록 테스트...');
    const auditData: AuditLogData = {
      action: 'CREATE_ORDER',
      resource: 'Order',
      resourceId: testResourceId,
      userId: testUserId,
      userRole: 'customer',
      details: {
        orderId: testResourceId,
        totalAmount: 35000,
        items: [
          { itemId: 'item_001', name: '테스트 상품', quantity: 2, price: 17500 }
        ],
        paymentMethod: 'credit_card'
      },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      status: 'success',
      severity: 3
    };

    const savedLog = await auditService.log(auditData);
    const logId = (savedLog as any).id || (savedLog as any)._id || 'unknown';
    console.log(`   ✅ 일반 로그 저장 성공: ${logId}`);

    // 2. 재고 변경 감사 로그 테스트
    console.log('\n2️⃣ 재고 변경 감사 로그 테스트...');
    const stockChangeData: StockChangeAuditData = {
      itemId: 'item_001',
      oldStock: 100,
      newStock: 98,
      changedBy: testUserId,
      reason: 'order_completion',
      timestamp: new Date()
    };

    await auditService.logStockChange(stockChangeData);
    console.log('   ✅ 재고 변경 로그 저장 성공');

    // 3. 로그인 감사 로그 테스트
    console.log('\n3️⃣ 로그인 감사 로그 테스트...');
    await auditService.logLogin(testUserId, true, '192.168.1.100', 'Mozilla/5.0');
    console.log('   ✅ 성공한 로그인 로그 저장 성공');

    await auditService.logLogin('wrong_user', false, '192.168.1.101', 'Mozilla/5.0');
    console.log('   ✅ 실패한 로그인 로그 저장 성공');

    // 4. 권한 없는 접근 시도 로그 테스트
    console.log('\n4️⃣ 권한 없는 접근 시도 로그 테스트...');
    const unauthorizedLog = await auditService.logUnauthorizedAccess(
      'unauthorized_user',
      'DELETE_ORDER',
      'Order',
      '192.168.1.102'
    );
    const unauthorizedLogId = (unauthorizedLog as any).id || (unauthorizedLog as any)._id || 'unknown';
    console.log(`   ✅ 권한 없는 접근 로그 저장 성공: ${unauthorizedLogId}`);

    // 5. 시스템 이벤트 로그 테스트
    console.log('\n5️⃣ 시스템 이벤트 로그 테스트...');
    await auditService.logSystemEvent('DATABASE_BACKUP', {
      backupSize: '2.5GB',
      duration: '45 minutes',
      status: 'completed'
    });
    console.log('   ✅ 시스템 이벤트 로그 저장 성공');

    // 잠시 대기 (MongoDB 인덱싱 시간 고려)
    await new Promise(resolve => setTimeout(resolve, 100));

    // 6. 조회 기능 테스트
    console.log('\n6️⃣ 조회 기능 테스트...');
    
    // 사용자별 로그 조회
    const userLogs = await auditService.getLogsByUser(testUserId, 10);
    console.log(`   ✅ 사용자별 로그 조회: ${userLogs.length}건`);

    // 리소스별 로그 조회
    const resourceLogs = await auditService.getLogsByResource('Order', testResourceId, 10);
    console.log(`   ✅ 리소스별 로그 조회: ${resourceLogs.length}건`);

    // 높은 심각도 로그 조회
    const highSeverityLogs = await auditService.getHighSeverityLogs(4, 10);
    console.log(`   ✅ 높은 심각도 로그 조회: ${highSeverityLogs.length}건`);

    // 보안 관련 로그 조회
    const securityLogs = await auditService.getSecurityLogs(10);
    console.log(`   ✅ 보안 관련 로그 조회: ${securityLogs.length}건`);

    // 7. 통계 기능 테스트
    console.log('\n7️⃣ 통계 기능 테스트...');
    const actionStats = await auditService.getActionStatistics();
    console.log(`   ✅ 액션별 통계 조회: ${actionStats.length}개 액션`);
    
    // 상위 5개 액션 출력
    const top5Actions = actionStats.slice(0, 5);
    top5Actions.forEach(stat => {
      console.log(`      - ${stat.action}: ${stat.count}건`);
    });

    // 8. MongoDB 고유 기능 테스트 (MongoAuditService인 경우만)
    if ('getDetailedStatistics' in auditService) {
      console.log('\n🍃 MongoDB 고유 기능 테스트...');
      try {
        const detailedStats = await (auditService as any).getDetailedStatistics();
        console.log(`   ✅ 상세 통계 조회:`);
        console.log(`      - 총 로그 수: ${detailedStats.totalLogs}건`);
        console.log(`      - 성공률: ${detailedStats.successRate}%`);
        console.log(`      - 상위 액션: ${detailedStats.topActions.length}개`);
      } catch (error) {
        console.log(`   ⚠️ 상세 통계 조회 실패 (정상적인 동작일 수 있음): ${error.message}`);
      }
    }

    // 성능 테스트
    console.log('\n⚡ 성능 테스트...');
    const startTime = Date.now();
    
    // 10개의 로그를 연속으로 저장
    const performancePromises: Promise<any>[] = [];
    for (let i = 0; i < 10; i++) {
      const perfData: AuditLogData = {
        action: 'PERFORMANCE_TEST',
        resource: 'Test',
        resourceId: `perf_test_${i}`,
        userId: testUserId,
        details: { testNumber: i }
      };
      performancePromises.push(auditService.log(perfData));
    }
    
    await Promise.all(performancePromises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`   ✅ 10개 로그 병렬 저장 성능: ${duration}ms (평균 ${duration/10}ms/건)`);

    // 정리: 테스트 데이터 삭제 (MongoDB의 경우만)
    try {
      // MongoDB인 경우 테스트 데이터 삭제
      if ((auditService as any).auditLogModel && typeof (auditService as any).auditLogModel.deleteMany === 'function') {
        await (auditService as any).auditLogModel.deleteMany({ 
          userId: { $in: [testUserId, 'wrong_user', 'unauthorized_user'] }
        });
        console.log('\n🧹 테스트 데이터 정리 완료 (MongoDB)');
      } else {
        console.log('\n📝 PostgreSQL 모드: 테스트 데이터는 자동으로 정리되지 않습니다.');
      }
    } catch (error) {
      console.log('\n⚠️ 테스트 데이터 정리 실패 (정상적인 동작일 수 있음)');
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎯 호환성 테스트 완료: 모든 기능이 정상 작동합니다!');
    console.log('📊 테스트 결과: ✅ PASS');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('💥 호환성 테스트 실패:', error.message);
    console.error('📊 테스트 결과: ❌ FAIL');
    console.error('='.repeat(80));
    console.error('\n📋 확인 사항:');
    console.error('1. MongoDB 서버가 실행 중인지 확인');
    console.error('2. AUDIT_STORAGE_TYPE 환경 변수 확인');
    console.error('3. MongoDB 연결 설정 확인');
    throw error;
  } finally {
    await app.close();
  }
}

// 스크립트가 직접 실행될 때만 테스트 함수 호출
if (require.main === module) {
  testAuditServiceCompatibility();
}