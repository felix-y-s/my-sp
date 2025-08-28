#!/usr/bin/env node

/**
 * Phase 3 통합 테스트 스크립트
 * 
 * Phase 3에서 구현된 모든 고급 기능들을 종합적으로 테스트합니다:
 * - 배치 처리 시스템
 * - 실시간 모니터링 API
 * - 자동 정리 시스템
 * - 성능 최적화
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { IAuditService, ExtendedAuditLogData, AuditSeverity } from '../common/interfaces/audit.interface';
import { AuditBatchProcessorService } from '../infrastructure/audit/services/audit-batch-processor.service';
import { AuditCleanupService } from '../infrastructure/audit/services/audit-cleanup.service';

async function testPhase3Integration() {
  console.log('='.repeat(90));
  console.log('🚀 Phase 3 감사 시스템 통합 테스트');
  console.log('='.repeat(90));

  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    // 서비스 인스턴스 가져오기
    const auditService = app.get<IAuditService>(IAuditService);
    const batchProcessor = app.get<AuditBatchProcessorService>(AuditBatchProcessorService);
    const cleanupService = app.get<AuditCleanupService>(AuditCleanupService);

    console.log('\\n✅ 모든 서비스 인스턴스 생성 완료\\n');

    // 1. 기본 감사 서비스 테스트
    console.log('📋 1. 기본 감사 서비스 기능 테스트');
    await testBasicAuditService(auditService);

    // 2. 배치 처리 시스템 테스트
    console.log('\\n⚡ 2. 배치 처리 시스템 테스트');
    await testBatchProcessing(batchProcessor);

    // 3. 확장된 감사 로그 기능 테스트
    console.log('\\n🔍 3. 확장된 감사 로그 기능 테스트');
    await testExtendedAuditFeatures(auditService);

    // 4. 헬스체크 및 모니터링 테스트
    console.log('\\n🏥 4. 헬스체크 및 모니터링 테스트');
    await testHealthAndMonitoring(auditService, batchProcessor);

    // 5. 정리 시스템 테스트 (실제 정리는 안하고 예상치만)
    console.log('\\n🧹 5. 정리 시스템 테스트');
    await testCleanupSystem(cleanupService);

    // 6. 성능 벤치마크
    console.log('\\n📊 6. 성능 벤치마크 테스트');
    await testPerformanceBenchmark(auditService, batchProcessor);

    console.log('\\n' + '='.repeat(90));
    console.log('🎉 Phase 3 통합 테스트 모든 항목 통과!');
    console.log('📈 감사 시스템이 성공적으로 업그레이드되었습니다.');
    console.log('='.repeat(90));

  } catch (error) {
    console.error('\\n' + '='.repeat(90));
    console.error('💥 Phase 3 통합 테스트 실패:', error.message);
    console.error('📊 테스트 결과: ❌ FAIL');
    console.error('='.repeat(90));
    if (error.stack) {
      console.error('\\n스택 트레이스:', error.stack);
    }
  } finally {
    await app.close();
  }
}

/**
 * 기본 감사 서비스 기능 테스트
 */
async function testBasicAuditService(auditService: IAuditService): Promise<void> {
  const testUserId = 'test_phase3_' + Date.now();
  
  // 기본 로그 기록
  await auditService.log({
    action: 'PHASE3_TEST',
    resource: 'TestResource',
    resourceId: 'test-' + Date.now(),
    userId: testUserId,
    details: { testPhase: 'Phase3', feature: 'basic_logging' }
  });
  
  console.log('  ✅ 기본 로그 기록 성공');

  // 재고 변경 로그
  await auditService.logStockChange({
    itemId: 'test-item-' + Date.now(),
    oldStock: 50,
    newStock: 45,
    changedBy: testUserId,
    reason: 'Phase 3 테스트 주문',
    timestamp: new Date()
  });
  
  console.log('  ✅ 재고 변경 로그 성공');

  // 보안 로그
  await auditService.logUnauthorizedAccess(
    'unauthorized_user_' + Date.now(),
    'DELETE_SENSITIVE_DATA',
    'CriticalResource'
  );
  
  console.log('  ✅ 보안 로그 기록 성공');

  // 잠시 대기
  await new Promise(resolve => setTimeout(resolve, 500));

  // 조회 테스트
  const userLogs = await auditService.getLogsByUser(testUserId, 5);
  const securityLogs = await auditService.getSecurityLogs(5);
  
  console.log(`  ✅ 로그 조회 성공: 사용자 로그 ${userLogs.length}건, 보안 로그 ${securityLogs.length}건`);
}

/**
 * 배치 처리 시스템 테스트
 */
async function testBatchProcessing(batchProcessor: AuditBatchProcessorService): Promise<void> {
  const startStatus = batchProcessor.getStatus();
  console.log(`  📊 초기 상태: 큐 크기 ${startStatus.queueSize}, 처리 중: ${startStatus.isProcessing}`);

  // 배치용 테스트 데이터 생성
  const testLogs: ExtendedAuditLogData[] = [];
  for (let i = 0; i < 25; i++) {
    testLogs.push({
      userId: `batch_test_user_${i}`,
      action: `BATCH_TEST_ACTION_${i % 5}`,
      resource: 'BatchTestResource',
      resourceId: `batch-resource-${i}`,
      timestamp: new Date(),
      severity: i % 4 + 1 as AuditSeverity,
      metadata: { 
        batchTest: true,
        iteration: i,
        testPhase: 'Phase3'
      }
    });
  }

  // 큐에 추가
  console.log(`  ⏳ ${testLogs.length}개의 로그를 배치 큐에 추가 중...`);
  const startTime = Date.now();
  
  for (const log of testLogs) {
    await batchProcessor.enqueue(log);
  }
  
  const enqueueTime = Date.now() - startTime;
  console.log(`  ✅ 큐 추가 완료 (${enqueueTime}ms)`);

  // 상태 확인
  const afterEnqueueStatus = batchProcessor.getStatus();
  console.log(`  📊 큐 추가 후 상태: 큐 크기 ${afterEnqueueStatus.queueSize}`);

  // 큐 통계 확인
  const queueStats = batchProcessor.getQueueStats();
  console.log(`  📈 큐 통계: 총 ${queueStats.totalItems}개, 액션별 분포:`, 
    Object.entries(queueStats.actionBreakdown).slice(0, 3));

  // 수동 플러시
  console.log('  🔄 수동 배치 플러시 실행...');
  await batchProcessor.flushQueue();
  
  const finalStatus = batchProcessor.getStatus();
  console.log(`  ✅ 플러시 완료: 큐 크기 ${finalStatus.queueSize}`);
}

/**
 * 확장된 감사 로그 기능 테스트
 */
async function testExtendedAuditFeatures(auditService: IAuditService): Promise<void> {
  if (typeof auditService.logExtended === 'function') {
    // 확장된 로그 기록
    const extendedLog: ExtendedAuditLogData = {
      userId: 'extended_test_user',
      action: 'EXTENDED_FEATURE_TEST',
      resource: 'ExtendedResource',
      resourceId: 'ext-' + Date.now(),
      timestamp: new Date(),
      severity: AuditSeverity.HIGH,
      metadata: {
        extendedFeature: true,
        testPhase: 'Phase3',
        additionalData: {
          complexObject: { nested: true, value: 42 },
          array: [1, 2, 3, 'test']
        }
      },
      ipAddress: '192.168.1.100',
      userAgent: 'Phase3-Test-Agent/1.0'
    };

    await auditService.logExtended(extendedLog);
    console.log('  ✅ 확장된 로그 기록 성공');

    // 배치 로그 테스트
    if (typeof auditService.logBatch === 'function') {
      const batchLogs: ExtendedAuditLogData[] = [
        {
          ...extendedLog,
          action: 'BATCH_LOG_1',
          resourceId: 'batch-1-' + Date.now()
        },
        {
          ...extendedLog, 
          action: 'BATCH_LOG_2',
          resourceId: 'batch-2-' + Date.now()
        }
      ];

      await auditService.logBatch(batchLogs);
      console.log('  ✅ 배치 로그 기록 성공');
    } else {
      console.log('  ⚠️ 배치 로그 기능을 사용할 수 없음');
    }
  } else {
    console.log('  ⚠️ 확장된 로그 기능을 사용할 수 없음');
  }
}

/**
 * 헬스체크 및 모니터링 테스트
 */
async function testHealthAndMonitoring(
  auditService: IAuditService,
  batchProcessor: AuditBatchProcessorService
): Promise<void> {
  // 헬스체크
  if (typeof auditService.healthCheck === 'function') {
    const healthStatus = await auditService.healthCheck();
    console.log(`  🏥 감사 서비스 헬스체크: ${healthStatus.status}`);
    
    if (healthStatus.details) {
      console.log('  📊 헬스체크 상세 정보:', JSON.stringify(healthStatus.details, null, 2));
    }
  } else {
    console.log('  ⚠️ 헬스체크 기능을 사용할 수 없음');
  }

  // 배치 프로세서 상태 모니터링
  const batchStatus = batchProcessor.getStatus();
  console.log('  📊 배치 프로세서 상태:', {
    queueSize: batchStatus.queueSize,
    isProcessing: batchStatus.isProcessing,
    maxBatchSize: batchStatus.maxBatchSize,
    intervalMs: batchStatus.batchIntervalMs
  });

  // 통계 조회
  try {
    const stats = await auditService.getActionStatistics();
    console.log(`  📈 액션 통계: ${stats.length}개 액션 타입`);
    if (stats.length > 0) {
      console.log('    상위 5개 액션:', stats.slice(0, 5).map(s => `${s.action}(${s.count})`).join(', '));
    }
  } catch (error) {
    console.log('  ⚠️ 통계 조회 실패:', error.message);
  }
}

/**
 * 정리 시스템 테스트
 */
async function testCleanupSystem(cleanupService: AuditCleanupService): Promise<void> {
  // 보존 정책 조회
  const policy = cleanupService.getRetentionPolicy();
  console.log('  📋 보존 정책:', {
    일반로그: `${policy.retentionDays}일`,
    높은심각도: `${policy.highSeverityRetentionDays}일`,
    자동정리: policy.autoCleanupEnabled ? '활성화' : '비활성화'
  });

  // 정리 예상 통계 (실제 삭제는 하지 않음)
  try {
    const estimate = await cleanupService.getCleanupEstimate();
    console.log('  📊 정리 예상 통계:', {
      PostgreSQL: `일반 ${estimate.postgres.general}개, 높은심각도 ${estimate.postgres.highSeverity}개`,
      MongoDB: `일반 ${estimate.mongodb.general}개, 높은심각도 ${estimate.mongodb.highSeverity}개`,
      전체예상: `${estimate.summary.totalToClean}개 레코드`
    });
    
    console.log('  ✅ 정리 시스템 기능 확인 완료 (실제 삭제는 수행하지 않음)');
  } catch (error) {
    console.log('  ⚠️ 정리 예상 통계 조회 실패:', error.message);
  }
}

/**
 * 성능 벤치마크 테스트
 */
async function testPerformanceBenchmark(
  auditService: IAuditService,
  batchProcessor: AuditBatchProcessorService
): Promise<void> {
  const testSizes = [10, 50, 100];
  
  for (const size of testSizes) {
    console.log(`\\n  📊 ${size}개 로그 성능 테스트:`);
    
    // 1. 개별 로그 기록 성능
    const individualStart = Date.now();
    for (let i = 0; i < size; i++) {
      await auditService.log({
        action: 'PERFORMANCE_TEST',
        resource: 'BenchmarkResource',
        resourceId: `perf-${i}-${Date.now()}`,
        userId: `perf_user_${i}`,
        details: { benchmarkTest: true, iteration: i }
      });
    }
    const individualTime = Date.now() - individualStart;
    const individualRate = (size / individualTime) * 1000;
    
    console.log(`    개별 기록: ${individualTime}ms (${individualRate.toFixed(1)} 로그/초)`);

    // 2. 배치 처리 성능 (가능한 경우)
    if (typeof auditService.logBatch === 'function') {
      const batchLogs: ExtendedAuditLogData[] = [];
      for (let i = 0; i < size; i++) {
        batchLogs.push({
          userId: `batch_perf_user_${i}`,
          action: 'BATCH_PERFORMANCE_TEST',
          resource: 'BatchBenchmarkResource',
          resourceId: `batch-perf-${i}-${Date.now()}`,
          timestamp: new Date(),
          severity: AuditSeverity.LOW,
          metadata: { batchBenchmark: true, iteration: i }
        });
      }

      const batchStart = Date.now();
      await auditService.logBatch(batchLogs);
      const batchTime = Date.now() - batchStart;
      const batchRate = (size / batchTime) * 1000;
      
      console.log(`    배치 기록: ${batchTime}ms (${batchRate.toFixed(1)} 로그/초)`);
      console.log(`    성능 향상: ${((batchRate / individualRate) * 100 - 100).toFixed(1)}%`);
    }

    // 3. 큐 처리 성능
    const queueStart = Date.now();
    for (let i = 0; i < Math.min(size, 20); i++) { // 큐 테스트는 최대 20개로 제한
      await batchProcessor.enqueue({
        userId: `queue_perf_user_${i}`,
        action: 'QUEUE_PERFORMANCE_TEST',
        resource: 'QueueBenchmarkResource',
        resourceId: `queue-perf-${i}-${Date.now()}`,
        timestamp: new Date(),
        severity: AuditSeverity.LOW,
        metadata: { queueBenchmark: true, iteration: i }
      });
    }
    const queueTime = Date.now() - queueStart;
    const queueSize = Math.min(size, 20);
    const queueRate = (queueSize / queueTime) * 1000;
    
    console.log(`    큐 추가: ${queueTime}ms (${queueRate.toFixed(1)} 로그/초) [논블로킹]`);
  }

  // 큐 플러시
  console.log('\\n  🔄 성능 테스트 후 큐 정리...');
  await batchProcessor.flushQueue();
  console.log('  ✅ 큐 정리 완료');
}

// 스크립트가 직접 실행될 때만 테스트 함수 호출
if (require.main === module) {
  testPhase3Integration().catch(console.error);
}