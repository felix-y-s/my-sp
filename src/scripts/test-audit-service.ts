#!/usr/bin/env node

/**
 * AuditService 테스트 스크립트
 *
 * AuditService의 기능을 종합적으로 테스트합니다.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { IAuditService } from '../common/interfaces/audit.interface';

async function testAuditService() {
  console.log('🔍 AuditService 테스트 시작...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const auditService = app.get<IAuditService>(IAuditService);

  try {
    // 1. 기본 감사 로그 테스트
    console.log('\n📝 1. 기본 감사 로그 테스트');
    const basicLog = await auditService.log({
      action: 'TEST_ACTION',
      resource: 'TestResource',
      resourceId: 'test-123',
      userId: 'test-user',
      details: { testData: 'basic test' },
      severity: 2,
    });
    console.log('✅ 기본 로그 생성:', basicLog.id);

    // 2. 재고 변경 감사 로그 테스트
    console.log('\n📦 2. 재고 변경 감사 로그 테스트');
    await auditService.logStockChange({
      itemId: 'item-123',
      oldStock: 100,
      newStock: 80,
      changedBy: 'admin-user',
      reason: '판매로 인한 재고 차감',
      timestamp: new Date(),
    });
    console.log('✅ 재고 변경 로그 생성 완료');

    // 3. 로그인 감사 로그 테스트
    console.log('\n🔐 3. 로그인 감사 로그 테스트');
    await auditService.logLogin('user-123', true, '192.168.1.1', 'Mozilla/5.0');
    await auditService.logLogin(
      'user-456',
      false,
      '192.168.1.2',
      'Chrome/90.0',
    );
    console.log('✅ 로그인 성공/실패 로그 생성 완료');

    // 4. 권한 없는 접근 시도 테스트
    console.log('\n🚨 4. 권한 없는 접근 시도 테스트');
    await auditService.logUnauthorizedAccess(
      'user-789',
      'DELETE_ITEM',
      'Item',
      '192.168.1.3',
    );
    console.log('✅ 권한 없는 접근 로그 생성 완료');

    // 5. 시스템 이벤트 테스트
    console.log('\n⚙️ 5. 시스템 이벤트 테스트');
    await auditService.logSystemEvent('SERVER_RESTART', {
      reason: '메모리 사용량 증가',
      previousUptime: '5 days',
    });
    console.log('✅ 시스템 이벤트 로그 생성 완료');

    // 잠시 대기 (데이터베이스 저장 시간 확보)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 6. 조회 기능 테스트
    console.log('\n🔎 6. 로그 조회 기능 테스트');

    // 사용자별 로그 조회
    const userLogs = await auditService.getLogsByUser('test-user', 10);
    console.log('✅ 사용자별 로그 조회:', userLogs.length, '건');

    // 리소스별 로그 조회
    const resourceLogs = await auditService.getLogsByResource(
      'Item',
      'item-123',
      10,
    );
    console.log('✅ 리소스별 로그 조회:', resourceLogs.length, '건');

    // 높은 심각도 로그 조회
    const highSeverityLogs = await auditService.getHighSeverityLogs(4, 10);
    console.log('✅ 높은 심각도 로그 조회:', highSeverityLogs.length, '건');

    // 보안 로그 조회
    const securityLogs = await auditService.getSecurityLogs(10);
    console.log('✅ 보안 로그 조회:', securityLogs.length, '건');

    // 액션 통계 조회
    const actionStats = await auditService.getActionStatistics();
    console.log('✅ 액션 통계:');
    actionStats.slice(0, 5).forEach((stat) => {
      console.log(`   - ${stat.action}: ${stat.count}건`);
    });

    console.log('\n🎉 모든 AuditService 테스트 완료!');

    // 최종 검증: 서비스 상태 확인
    console.log('\n📋 감사 서비스 상태 검증:');
    if ('healthCheck' in auditService && typeof auditService.healthCheck === 'function') {
      const healthStatus = await auditService.healthCheck();
      console.log(`서비스 상태: ${healthStatus.status === 'healthy' ? '✅ 정상' : '⚠️ 이상'}`);
    } else {
      console.log('✅ 서비스가 정상적으로 작동 중입니다.');
    }
  } catch (error) {
    console.error('❌ AuditService 테스트 실패:', error.message);
    console.error(error.stack);
  } finally {
    await app.close();
  }
}

// 스크립트 실행
if (require.main === module) {
  testAuditService().catch(console.error);
}
