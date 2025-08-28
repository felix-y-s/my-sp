import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLogMongo, AuditLogMongoDocument } from '../schemas/audit-log-mongo.schema';
import { IAuditService, ExtendedAuditLogData } from '../../../common/interfaces/audit.interface';
import { AuditLogData, StockChangeAuditData } from './postgres-audit.service';

/**
 * MongoDB 전용 AuditService 구현체
 * NoSQL 기반의 유연한 스키마와 집계 기능을 활용한 감사 로그 시스템
 */
@Injectable()
export class MongoAuditService extends IAuditService {
  private readonly logger = new Logger(MongoAuditService.name);

  constructor(
    @InjectModel(AuditLogMongo.name)
    private readonly auditLogModel: Model<AuditLogMongoDocument>,
  ) {
    super(); // 추상 클래스 상속
  }

  /**
   * 일반 감사 로그 기록
   */
  async log(auditData: AuditLogData): Promise<AuditLogMongoDocument> {
    try {
      const logEntry = new this.auditLogModel({
        ...auditData,
        status: auditData.status || 'success',
        severity: auditData.severity || 3,
      });

      // MongoDB에 저장
      const savedLog = await logEntry.save();

      // 추가적으로 로그파일에도 기록 (중요한 이벤트의 경우)
      if (auditData.severity && auditData.severity >= 4) {
        this.logger.warn(
          `[HIGH PRIORITY] 감사 로그: ${JSON.stringify(auditData)}`,
        );
      } else {
        this.logger.log(
          `감사 로그: ${auditData.action} | ${auditData.resource}:${auditData.resourceId} | 사용자: ${auditData.userId || 'unknown'}`,
        );
      }

      return savedLog;
    } catch (error) {
      // MongoDB 저장 실패 시에도 최소한 로그는 남김
      this.logger.error(`감사 로그 저장 실패: ${error.message}`, error.stack);
      this.logger.log(`[FALLBACK] 감사 로그: ${JSON.stringify(auditData)}`);
      throw error;
    }
  }

  /**
   * 재고 변경 감사 로그 기록
   */
  async logStockChange(stockChangeData: StockChangeAuditData): Promise<void> {
    const auditData: AuditLogData = {
      action: 'STOCK_UPDATE',
      resource: 'Item',
      resourceId: stockChangeData.itemId,
      userId: stockChangeData.changedBy,
      details: {
        oldStock: stockChangeData.oldStock,
        newStock: stockChangeData.newStock,
        difference: stockChangeData.newStock - stockChangeData.oldStock,
        reason: stockChangeData.reason,
      },
      timestamp: stockChangeData.timestamp,
    };

    await this.log(auditData);
  }

  /**
   * 로그인 감사 로그 기록
   */
  async logLogin(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const auditData: AuditLogData = {
      action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      resource: 'User',
      resourceId: userId,
      userId: userId,
      ipAddress,
      userAgent,
    };

    await this.log(auditData);
  }

  /**
   * 권한 없는 접근 시도 기록
   */
  async logUnauthorizedAccess(
    userId: string | undefined,
    action: string,
    resource: string,
    ipAddress?: string,
  ): Promise<AuditLogMongoDocument> {
    const auditData: AuditLogData = {
      action: 'UNAUTHORIZED_ACCESS',
      resource,
      resourceId: 'N/A',
      userId,
      details: {
        attemptedAction: action,
        blocked: true,
      },
      ipAddress,
      status: 'blocked',
      severity: 5, // 최고 심각도
    };

    const savedLog = await this.log(auditData);

    // 보안 경고 로그
    this.logger.warn(
      `🚨 권한 없는 접근 시도: 사용자 ${userId || 'unknown'} | 액션: ${action} | 리소스: ${resource} | IP: ${ipAddress || 'unknown'}`,
    );

    return savedLog;
  }

  /**
   * 시스템 이벤트 감사 로그 기록
   */
  async logSystemEvent(
    event: string,
    details?: Record<string, any>,
  ): Promise<void> {
    const auditData: AuditLogData = {
      action: 'SYSTEM_EVENT',
      resource: 'System',
      resourceId: 'system',
      details: {
        event,
        ...details,
      },
    };

    await this.log(auditData);
  }

  /**
   * 특정 사용자의 감사 로그 조회
   */
  async getLogsByUser(userId: string, limit: number = 50): Promise<AuditLogMongoDocument[]> {
    return this.auditLogModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * 특정 리소스의 감사 로그 조회
   */
  async getLogsByResource(
    resource: string,
    resourceId: string,
    limit: number = 50,
  ): Promise<AuditLogMongoDocument[]> {
    return this.auditLogModel
      .find({ resource, resourceId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * 높은 심각도 이벤트 조회
   */
  async getHighSeverityLogs(
    minSeverity: number = 4,
    limit: number = 100,
  ): Promise<AuditLogMongoDocument[]> {
    return this.auditLogModel
      .find({ severity: { $gte: minSeverity } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * 보안 관련 로그 조회 (권한 없는 접근, 로그인 실패 등)
   */
  async getSecurityLogs(limit: number = 100): Promise<AuditLogMongoDocument[]> {
    return this.auditLogModel
      .find({
        $or: [
          { action: { $in: ['UNAUTHORIZED_ACCESS', 'LOGIN_FAILED'] } },
          { status: 'blocked' }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * 통계: 액션별 카운트
   */
  async getActionStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{ action: string; count: string }[]> {
    const matchStage: any = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        matchStage.createdAt.$gte = startDate;
      }
      if (endDate) {
        matchStage.createdAt.$lte = endDate;
      }
    }

    const pipeline = [
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          action: '$_id',
          count: { $toString: '$count' }, // 기존 PostgreSQL 버전과 호환성을 위해 문자열로 변환
          _id: 0
        }
      },
      {
        $sort: { count: -1 as -1 }
      }
    ];

    return this.auditLogModel.aggregate(pipeline).exec();
  }

  /**
   * MongoDB 고유 기능: 전체 텍스트 검색
   */
  async searchLogs(
    searchText: string,
    limit: number = 50,
  ): Promise<AuditLogMongoDocument[]> {
    try {
      return this.auditLogModel
        .find({ $text: { $search: searchText } })
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .limit(limit)
        .exec();
    } catch (error) {
      // 텍스트 인덱스가 없는 경우 기본 검색으로 대체
      this.logger.warn('텍스트 검색 실패, 기본 검색으로 대체:', error.message);
      return this.auditLogModel
        .find({
          $or: [
            { action: { $regex: searchText, $options: 'i' } },
            { resource: { $regex: searchText, $options: 'i' } },
          ]
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();
    }
  }

  /**
   * MongoDB 고유 기능: 집계 통계
   */
  async getDetailedStatistics(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalLogs: number;
    successRate: number;
    topActions: { action: string; count: number }[];
    severityDistribution: { severity: number; count: number }[];
    dailyTrends: { date: string; count: number }[];
  }> {
    const matchStage: any = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) {
        matchStage.createdAt.$gte = startDate;
      }
      if (endDate) {
        matchStage.createdAt.$lte = endDate;
      }
    }

    const [
      totalResult,
      actionStats,
      severityStats,
      dailyStats
    ] = await Promise.all([
      // 전체 개수와 성공률
      this.auditLogModel.aggregate([
        ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            successCount: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
            }
          }
        }
      ]),

      // 상위 액션
      this.auditLogModel.aggregate([
        ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { action: '$_id', count: 1, _id: 0 } }
      ]),

      // 심각도 분포
      this.auditLogModel.aggregate([
        ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { severity: '$_id', count: 1, _id: 0 } }
      ]),

      // 일별 트렌드
      this.auditLogModel.aggregate([
        ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', count: 1, _id: 0 } }
      ])
    ]);

    const total = totalResult[0];
    const successRate = total ? (total.successCount / total.total) * 100 : 0;

    return {
      totalLogs: total?.total || 0,
      successRate: Math.round(successRate * 100) / 100,
      topActions: actionStats,
      severityDistribution: severityStats,
      dailyTrends: dailyStats
    };
  }

  /**
   * 확장된 감사 로그 기록 (새로운 타입 안전한 메서드)
   */
  async logExtended<T extends ExtendedAuditLogData>(auditData: T): Promise<AuditLogMongoDocument> {
    try {
      // ExtendedAuditLogData를 기존 AuditLogData 형식으로 변환
      const legacyData: AuditLogData = {
        userId: auditData.userId || '',
        action: auditData.action,
        resource: auditData.resource,
        resourceId: auditData.resourceId || '',
        details: auditData.metadata || {},
        timestamp: auditData.timestamp,
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        severity: auditData.severity,
      };

      return await this.log(legacyData);
    } catch (error) {
      this.logger.error('Extended audit logging failed', error);
      throw error;
    }
  }

  /**
   * 배치 로그 처리 (MongoDB의 배열 삽입 성능 활용)
   */
  async logBatch(auditDataList: ExtendedAuditLogData[]): Promise<AuditLogMongoDocument[]> {
    if (auditDataList.length === 0) {
      return [];
    }

    try {
      // MongoDB의 insertMany를 활용한 고성능 배치 처리
      const logEntries = auditDataList.map(auditData => ({
        userId: auditData.userId || '',
        action: auditData.action,
        resource: auditData.resource,
        resourceId: auditData.resourceId || '',
        details: auditData.metadata || {},
        timestamp: auditData.timestamp || new Date(),
        ipAddress: auditData.ipAddress,
        userAgent: auditData.userAgent,
        severity: auditData.severity || 3,
        status: 'success'
      }));

      const results = await this.auditLogModel.insertMany(logEntries, { 
        ordered: false // 일부 실패해도 다른 로그 처리 계속
      });
      
      this.logger.log(`Successfully batch processed ${auditDataList.length} audit logs in MongoDB`);
      return results;

    } catch (error) {
      this.logger.error('MongoDB batch audit logging failed', {
        count: auditDataList.length,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 헬스체크 메서드 (MongoDB 연결 및 상태 확인)
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details?: Record<string, any>;
  }> {
    try {
      // MongoDB 연결 상태 확인
      const connection = this.auditLogModel.db;
      if (!connection || !connection.db) {
        throw new Error('MongoDB connection not available');
      }
      await connection.db.admin().ping();
      
      // 최근 5분간 로그 개수 확인
      const recentLogCount = await this.auditLogModel.countDocuments({
        createdAt: { $gt: new Date(Date.now() - 5 * 60 * 1000) }
      });

      // 콜렉션 인덱스 상태 확인
      const indexStats = await this.auditLogModel.collection.getIndexes();

      return {
        status: 'healthy',
        details: {
          database: 'connected',
          recentLogs: recentLogCount,
          indexCount: Object.keys(indexStats).length,
          timestamp: new Date().toISOString(),
        }
      };

    } catch (error) {
      this.logger.error('MongoDB audit service health check failed', error);
      return {
        status: 'unhealthy',
        details: {
          database: 'disconnected',
          error: error.message,
          timestamp: new Date().toISOString(),
        }
      };
    }
  }
}