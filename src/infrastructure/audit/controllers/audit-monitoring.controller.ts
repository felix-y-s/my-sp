import { Controller, Get, Query, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { IAuditService } from '../../../common/interfaces/audit.interface';
import { AuditBatchProcessorService } from '../services/audit-batch-processor.service';
import { Inject } from '@nestjs/common';

/**
 * 감사 로그 모니터링 API 컨트롤러
 * 
 * 실시간 감사 로그 모니터링 및 관리를 위한 REST API를 제공합니다.
 * 운영팀과 보안팀이 시스템 상태를 모니터링할 수 있는 대시보드 데이터를 제공합니다.
 */
@ApiTags('감사 로그 모니터링')
@Controller('api/audit/monitoring')
export class AuditMonitoringController {

  constructor(
    @Inject(IAuditService)
    private readonly auditService: IAuditService,
    private readonly batchProcessor: AuditBatchProcessorService,
  ) {}

  /**
   * 실시간 감사 시스템 상태 조회
   */
  @Get('status')
  @ApiOperation({ 
    summary: '감사 시스템 상태 조회',
    description: '감사 시스템의 전반적인 상태와 성능 지표를 실시간으로 조회합니다.'
  })
  @ApiResponse({ 
    status: 200,
    description: '시스템 상태 정보',
    schema: {
      type: 'object',
      properties: {
        systemHealth: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy'] },
            timestamp: { type: 'string', format: 'date-time' },
            details: { type: 'object' }
          }
        },
        batchProcessor: {
          type: 'object',
          properties: {
            queueSize: { type: 'number' },
            isProcessing: { type: 'boolean' },
            maxBatchSize: { type: 'number' },
            batchIntervalMs: { type: 'number' }
          }
        }
      }
    }
  })
  async getSystemStatus() {
    const [healthStatus, batchStatus] = await Promise.all([
      this.getHealthStatus(),
      this.batchProcessor.getStatus(),
    ]);

    return {
      systemHealth: healthStatus,
      batchProcessor: batchStatus,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 최근 감사 로그 통계 조회
   */
  @Get('statistics')
  @ApiOperation({ 
    summary: '감사 로그 통계 조회',
    description: '지정된 기간 동안의 감사 로그 통계를 조회합니다.'
  })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: '조회 기간 (시간), 기본값: 24' })
  @ApiResponse({ 
    status: 200,
    description: '통계 데이터',
  })
  async getStatistics(@Query('hours') hours: number = 24) {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (hours * 60 * 60 * 1000));

    try {
      const actionStats = await this.auditService.getActionStatistics(startDate, endDate);
      const securityLogs = await this.auditService.getSecurityLogs(100);
      const highSeverityLogs = await this.auditService.getHighSeverityLogs(4, 50);
      
      return {
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          hours
        },
        actionStatistics: actionStats,
        securityIssues: {
          total: securityLogs.length,
          recent: securityLogs.slice(0, 10)
        },
        highSeverityEvents: {
          total: highSeverityLogs.length,
          recent: highSeverityLogs.slice(0, 10)
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        period: { startDate, endDate, hours },
        error: '통계 조회 중 오류 발생',
        details: error.message,
        generatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * 보안 이벤트 조회 (권한 없는 접근, 로그인 실패 등)
   */
  @Get('security-events')
  @ApiOperation({ 
    summary: '보안 이벤트 조회',
    description: '보안 관련 감사 로그들을 조회합니다.'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '조회 개수, 기본값: 50' })
  @ApiResponse({ 
    status: 200,
    description: '보안 이벤트 목록',
  })
  async getSecurityEvents(@Query('limit') limit: number = 50) {
    try {
      const securityLogs = await this.auditService.getSecurityLogs(limit);
      
      return {
        events: securityLogs,
        count: securityLogs.length,
        generatedAt: new Date().toISOString(),
        analysisScope: 'security-related events (unauthorized access, login failures, blocked actions)'
      };
    } catch (error) {
      return {
        error: '보안 이벤트 조회 중 오류 발생',
        details: error.message,
        generatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * 배치 처리 큐 상태 조회
   */
  @Get('queue-status')
  @ApiOperation({ 
    summary: '배치 처리 큐 상태 조회',
    description: '배치 처리 큐의 현재 상태와 통계를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200,
    description: '큐 상태 정보',
  })
  async getQueueStatus() {
    const status = this.batchProcessor.getStatus();
    const stats = this.batchProcessor.getQueueStats();

    return {
      status,
      statistics: stats,
      recommendations: this.generateQueueRecommendations(status, stats),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 배치 처리 수동 트리거
   */
  @Post('flush-queue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '배치 처리 수동 실행',
    description: '대기 중인 감사 로그들을 즉시 배치 처리합니다.'
  })
  @ApiResponse({ 
    status: 200,
    description: '배치 처리 완료',
  })
  async flushQueue() {
    const beforeStatus = this.batchProcessor.getStatus();
    const startTime = Date.now();

    try {
      await this.batchProcessor.flushQueue();
      const afterStatus = this.batchProcessor.getStatus();
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        processedItems: beforeStatus.queueSize - afterStatus.queueSize,
        processingTimeMs: processingTime,
        beforeQueue: beforeStatus.queueSize,
        afterQueue: afterStatus.queueSize,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: '배치 처리 실행 중 오류 발생',
        details: error.message,
        processingTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 시스템 성능 메트릭스 조회
   */
  @Get('metrics')
  @ApiOperation({ 
    summary: '성능 메트릭스 조회',
    description: '감사 시스템의 성능 관련 메트릭스를 조회합니다.'
  })
  @ApiResponse({ 
    status: 200,
    description: '성능 메트릭스',
  })
  async getMetrics() {
    const queueStats = this.batchProcessor.getQueueStats();
    const systemHealth = await this.getHealthStatus();

    return {
      performance: {
        queueLength: queueStats.totalItems,
        queueAge: queueStats.oldestItem ? 
          Date.now() - queueStats.oldestItem.getTime() : 0,
        topActions: Object.entries(queueStats.actionBreakdown)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([action, count]) => ({ action, count }))
      },
      health: systemHealth,
      recommendations: this.generatePerformanceRecommendations(queueStats),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 감사 서비스 헬스체크
   */
  private async getHealthStatus(): Promise<any> {
    try {
      if (typeof this.auditService.healthCheck === 'function') {
        return await this.auditService.healthCheck();
      } else {
        return {
          status: 'healthy',
          details: { 
            message: 'Health check method not available, assuming healthy',
            timestamp: new Date().toISOString()
          }
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * 큐 상태 기반 권장사항 생성
   */
  private generateQueueRecommendations(status: any, stats: any): string[] {
    const recommendations: string[] = [];

    if (stats.totalItems > status.maxBatchSize * 2) {
      recommendations.push('큐 크기가 큽니다. 배치 처리 주기를 단축하거나 배치 크기를 늘리는 것을 고려해보세요.');
    }

    if (stats.oldestItem && Date.now() - stats.oldestItem.getTime() > 30000) {
      recommendations.push('오래된 로그가 대기 중입니다. 즉시 배치 처리를 실행하거나 시스템 상태를 점검해보세요.');
    }

    if (status.isProcessing) {
      recommendations.push('현재 배치 처리가 진행 중입니다. 완료를 기다려주세요.');
    }

    if (recommendations.length === 0) {
      recommendations.push('모든 지표가 정상 범위입니다.');
    }

    return recommendations;
  }

  /**
   * 성능 기반 권장사항 생성
   */
  private generatePerformanceRecommendations(stats: any): string[] {
    const recommendations: string[] = [];

    if (stats.totalItems === 0) {
      recommendations.push('큐가 비어있습니다. 시스템이 효율적으로 작동 중입니다.');
    } else if (stats.totalItems > 1000) {
      recommendations.push('큐에 많은 아이템이 대기 중입니다. 처리 성능을 개선하거나 리소스를 늘리는 것을 고려해보세요.');
    }

    const topAction = Object.entries(stats.actionBreakdown)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];
    
    if (topAction && (topAction[1] as number) > stats.totalItems * 0.5) {
      recommendations.push(`'${topAction[0]}' 액션이 큐의 ${Math.round((topAction[1] as number) / stats.totalItems * 100)}%를 차지합니다. 특정 액션의 과도한 로깅을 검토해보세요.`);
    }

    return recommendations;
  }
}