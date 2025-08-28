import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { IAuditService, ExtendedAuditLogData } from '../../../common/interfaces/audit.interface';
import { Inject } from '@nestjs/common';

/**
 * 감사 로그 배치 처리 서비스
 * 
 * 성능 최적화를 위해 감사 로그들을 배치로 모아서 처리합니다.
 * 메모리 기반 큐를 사용하여 실시간 로그 수집 후 주기적으로 데이터베이스에 일괄 저장합니다.
 */
@Injectable()
export class AuditBatchProcessorService {
  private readonly logger = new Logger(AuditBatchProcessorService.name);
  
  // 배치 처리용 큐
  private readonly auditQueue: ExtendedAuditLogData[] = [];
  private readonly maxBatchSize: number;
  private readonly batchIntervalMs: number;
  private isProcessing = false;

  constructor(
    @Inject(IAuditService)
    private readonly auditService: IAuditService,
    private readonly configService: ConfigService,
  ) {
    this.maxBatchSize = this.configService.get<number>('audit.batch.size', 100);
    this.batchIntervalMs = this.configService.get<number>('audit.batch.intervalMs', 5000);
    
    this.logger.log(`배치 처리 서비스 초기화: 배치크기=${this.maxBatchSize}, 간격=${this.batchIntervalMs}ms`);
  }

  /**
   * 감사 로그를 큐에 추가 (비동기, 논블로킹)
   * 
   * @param auditData 감사 로그 데이터
   */
  async enqueue(auditData: ExtendedAuditLogData): Promise<void> {
    try {
      // 필수 필드 검증
      if (!auditData.action || !auditData.resource) {
        this.logger.warn('필수 필드가 누락된 감사 로그 건너뛰기', { auditData });
        return;
      }

      // 타임스탬프 자동 설정
      if (!auditData.timestamp) {
        auditData.timestamp = new Date();
      }

      // 큐에 추가
      this.auditQueue.push(auditData);
      
      this.logger.debug(`큐에 감사 로그 추가: ${auditData.action} (큐 크기: ${this.auditQueue.length})`);

      // 배치 크기 도달 시 즉시 처리
      if (this.auditQueue.length >= this.maxBatchSize) {
        this.logger.log(`배치 크기 도달 (${this.maxBatchSize}), 즉시 처리 시작`);
        await this.processBatch();
      }
      
    } catch (error) {
      this.logger.error('큐 추가 중 오류 발생', {
        error: error.message,
        auditAction: auditData.action,
        auditResource: auditData.resource
      });
    }
  }

  /**
   * 주기적 배치 처리 (5초마다 실행)
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async scheduledBatchProcess(): Promise<void> {
    if (this.auditQueue.length > 0) {
      this.logger.debug(`주기적 배치 처리 시작 (큐 크기: ${this.auditQueue.length})`);
      await this.processBatch();
    }
  }

  /**
   * 실제 배치 처리 로직
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.auditQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();
    
    try {
      // 현재 큐의 모든 아이템을 복사하고 큐 초기화
      const itemsToProcess = this.auditQueue.splice(0, this.auditQueue.length);
      
      this.logger.log(`배치 처리 시작: ${itemsToProcess.length}개 아이템`);

      // 배치 처리 시도
      if (typeof this.auditService.logBatch === 'function') {
        // 새로운 배치 메서드 사용
        await this.auditService.logBatch(itemsToProcess);
        this.logger.log(`배치 처리 완료: ${itemsToProcess.length}개 아이템 (${Date.now() - startTime}ms)`);
      } else {
        // 폴백: 개별 처리
        this.logger.warn('배치 메서드를 사용할 수 없어 개별 처리로 폴백');
        
        const promises = itemsToProcess.map(item => 
          this.auditService.logExtended(item).catch(error => {
            this.logger.error('개별 로그 처리 실패', {
              error: error.message,
              action: item.action,
              resource: item.resource
            });
          })
        );
        
        await Promise.allSettled(promises);
        this.logger.log(`개별 처리 완료: ${itemsToProcess.length}개 아이템 (${Date.now() - startTime}ms)`);
      }

      // 성능 메트릭 로깅
      const processingRate = (itemsToProcess.length / (Date.now() - startTime)) * 1000;
      this.logger.log(`배치 처리 성능: ${processingRate.toFixed(1)} 로그/초`);
      
    } catch (error) {
      this.logger.error('배치 처리 중 오류 발생', {
        error: error.message,
        queueSize: this.auditQueue.length,
        processingTime: Date.now() - startTime
      });
      
      // 치명적 오류 시 큐 크기 제한 (메모리 보호)
      if (this.auditQueue.length > this.maxBatchSize * 10) {
        const droppedItems = this.auditQueue.splice(this.maxBatchSize * 5);
        this.logger.error(`큐 크기 제한으로 ${droppedItems.length}개 아이템 드롭`);
      }
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 애플리케이션 종료 시 남은 큐 처리
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`애플리케이션 종료 감지 (${signal}), 남은 큐 처리 중...`);
    
    if (this.auditQueue.length > 0) {
      await this.processBatch();
      this.logger.log('종료 전 큐 처리 완료');
    }
  }

  /**
   * 배치 처리 상태 조회
   */
  getStatus(): {
    queueSize: number;
    isProcessing: boolean;
    maxBatchSize: number;
    batchIntervalMs: number;
  } {
    return {
      queueSize: this.auditQueue.length,
      isProcessing: this.isProcessing,
      maxBatchSize: this.maxBatchSize,
      batchIntervalMs: this.batchIntervalMs,
    };
  }

  /**
   * 즉시 배치 처리 실행 (수동 트리거)
   */
  async flushQueue(): Promise<void> {
    this.logger.log('수동 큐 플러시 요청');
    await this.processBatch();
  }

  /**
   * 큐 통계 정보
   */
  getQueueStats(): {
    totalItems: number;
    oldestItem?: Date;
    newestItem?: Date;
    actionBreakdown: Record<string, number>;
  } {
    const actionBreakdown: Record<string, number> = {};
    let oldestItem: Date | undefined;
    let newestItem: Date | undefined;

    for (const item of this.auditQueue) {
      // 액션별 통계
      actionBreakdown[item.action] = (actionBreakdown[item.action] || 0) + 1;
      
      // 시간 통계
      if (!oldestItem || item.timestamp < oldestItem) {
        oldestItem = item.timestamp;
      }
      if (!newestItem || item.timestamp > newestItem) {
        newestItem = item.timestamp;
      }
    }

    return {
      totalItems: this.auditQueue.length,
      oldestItem,
      newestItem,
      actionBreakdown,
    };
  }
}