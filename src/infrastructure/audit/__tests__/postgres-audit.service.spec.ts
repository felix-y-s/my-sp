import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
// import { Repository, DataSource, QueryRunner } from 'typeorm'; // 사용되지 않음
import { PostgresAuditService, AuditLogData, StockChangeAuditData } from '../services/postgres-audit.service';
import { AuditLog } from '../entities/audit-log.entity';
import { ExtendedAuditLogData, AuditSeverity } from '../../../common/interfaces/audit.interface';

describe('PostgresAuditService', () => {
  let service: PostgresAuditService;
  // let repository: Repository<AuditLog>; // 사용되지 않음
  // let dataSource: DataSource; // 사용되지 않음
  // let queryRunner: QueryRunner; // 사용되지 않음

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(), // find 메서드 추가
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getCount: jest.fn(),
      getRawMany: jest.fn(),
    })),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
    manager: {
      save: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostgresAuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<PostgresAuditService>(PostgresAuditService);
    // repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog)); // 사용되지 않음
    // dataSource = module.get<DataSource>(getDataSourceToken()); // 사용되지 않음
    // queryRunner = mockQueryRunner; // 사용되지 않음

    // 모든 mock 초기화
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create and save audit log', async () => {
      const auditData: AuditLogData = {
        userId: 'user-123',
        action: 'CREATE_ITEM',
        resource: 'Item',
        resourceId: 'item-456',
        details: { name: 'Test Item' },
        timestamp: new Date(),
      };

      const expectedLogEntry = {
        ...auditData,
        timestamp: expect.any(Date),
        status: 'success',
        severity: 3,
      };

      const createdLog = { 
        id: 'log-id', 
        ...expectedLogEntry, 
        userRole: null, 
        ipAddress: null, 
        userAgent: null 
      } as AuditLog;
      mockRepository.create.mockReturnValue(createdLog);
      mockRepository.save.mockResolvedValue(createdLog);

      const result = await service.log(auditData);

      expect(mockRepository.create).toHaveBeenCalledWith(expectedLogEntry);
      expect(mockRepository.save).toHaveBeenCalledWith(createdLog);
      expect(result).toEqual(createdLog);
    });

    it('should handle logging errors gracefully', async () => {
      const auditData: AuditLogData = {
        action: 'FAIL_ACTION',
        resource: 'Test',
        resourceId: 'test-id',
      };

      mockRepository.create.mockReturnValue(auditData);
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.log(auditData)).rejects.toThrow('Database error');
    });
  });

  describe('logExtended', () => {
    it('should convert ExtendedAuditLogData and log successfully', async () => {
      const extendedData: ExtendedAuditLogData = {
        userId: 'user-123',
        action: 'LOGIN_SUCCESS',
        resource: 'AUTH',
        timestamp: new Date(),
        severity: AuditSeverity.LOW,
        metadata: { sessionId: 'session-456' },
        ipAddress: '192.168.1.1',
      };

      const expectedLogEntry = {
        userId: 'user-123',
        action: 'LOGIN_SUCCESS',
        resource: 'AUTH',
        resourceId: '',
        details: { sessionId: 'session-456' },
        timestamp: expect.any(Date),
        ipAddress: '192.168.1.1',
        userAgent: undefined,
        severity: AuditSeverity.LOW,
        status: 'success', // 기본값 추가
      };

      const createdLog = { 
        id: 'log-id', 
        ...expectedLogEntry, 
        userRole: null 
      } as AuditLog;
      mockRepository.create.mockReturnValue(createdLog);
      mockRepository.save.mockResolvedValue(createdLog);

      const result = await service.logExtended(extendedData);

      expect(mockRepository.create).toHaveBeenCalledWith(expectedLogEntry);
      expect(result).toEqual(createdLog);
    });
  });

  describe('logStockChange', () => {
    it('should log stock change with proper audit data', async () => {
      const stockData: StockChangeAuditData = {
        itemId: 'item-123',
        oldStock: 50,
        newStock: 45,
        changedBy: 'admin-456',
        reason: 'Sale completed',
        timestamp: new Date(),
      };

      const expectedLogEntry = {
        userId: stockData.changedBy,
        action: 'STOCK_UPDATE', // 실제 구현체에서 사용하는 액션명
        resource: 'Item',
        resourceId: stockData.itemId,
        details: {
          oldStock: stockData.oldStock,
          newStock: stockData.newStock,
          difference: -5, // 계산된 차이값
          reason: stockData.reason,
        },
        timestamp: stockData.timestamp,
        status: 'success', // 기본값
        severity: 3, // 기본값
      };

      const createdLog = { 
        id: 'log-id', 
        ...expectedLogEntry, 
        userRole: null, 
        ipAddress: null, 
        userAgent: null 
      } as AuditLog;
      mockRepository.create.mockReturnValue(createdLog);
      mockRepository.save.mockResolvedValue(createdLog);

      await service.logStockChange(stockData);

      expect(mockRepository.create).toHaveBeenCalledWith(expectedLogEntry);
    });
  });

  describe('logBatch', () => {
    it('should process batch logs in transactions', async () => {
      const batchData: ExtendedAuditLogData[] = [
        {
          action: 'ACTION_1',
          resource: 'Resource',
          timestamp: new Date(),
          severity: AuditSeverity.LOW,
        },
        {
          action: 'ACTION_2', 
          resource: 'Resource',
          timestamp: new Date(),
          severity: AuditSeverity.MEDIUM,
        },
      ];

      const createdLogs = batchData.map((data, index) => ({ 
        id: `log-${index}`, 
        ...data 
      })) as AuditLog[];

      mockQueryRunner.manager.save.mockResolvedValue(createdLogs);

      const result = await service.logBatch(batchData);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result).toEqual(createdLogs);
    });

    it('should rollback on batch error', async () => {
      const batchData: ExtendedAuditLogData[] = [
        {
          action: 'FAIL_ACTION',
          resource: 'Resource',
          timestamp: new Date(),
          severity: AuditSeverity.HIGH,
        },
      ];

      mockQueryRunner.manager.save.mockRejectedValue(new Error('Batch failed'));

      await expect(service.logBatch(batchData)).rejects.toThrow('Batch failed');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should return empty array for empty batch', async () => {
      const result = await service.logBatch([]);
      expect(result).toEqual([]);
      expect(mockQueryRunner.connect).not.toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('데이터베이스에 접근 가능할 때 healthy 상태를 반환해야 함', async () => {
      // 쿼리 러너 작업 모킹
      mockQueryRunner.query.mockResolvedValue([]);
      
      // 최근 로그 개수 조회를 위한 쿼리 빌더 모킹 - 새로운 인스턴스로 생성
      const healthCheckQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
      };
      mockRepository.createQueryBuilder.mockReturnValue(healthCheckQueryBuilder);

      const result = await service.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.details).toEqual({
        database: 'connected',
        recentLogs: 5,
        timestamp: expect.any(String),
      });
      expect(mockQueryRunner.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should return unhealthy status when database is inaccessible', async () => {
      mockQueryRunner.query.mockRejectedValue(new Error('Connection failed'));

      const result = await service.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.details).toEqual({
        database: 'disconnected',
        error: 'Connection failed',
        timestamp: expect.any(String),
      });
    });
  });

  describe('getLogsByUser', () => {
    it('특정 사용자의 감사 로그를 조회할 수 있어야 함', async () => {
      const userId = 'user-123';
      const mockLogs = [
        { 
          id: 'log-1', 
          userId, 
          action: 'LOGIN',
          resource: 'User',
          resourceId: userId,
          userRole: null,
          details: {},
          ipAddress: null,
          userAgent: null,
          timestamp: new Date(),
          status: 'success',
          severity: 3
        },
        { 
          id: 'log-2', 
          userId, 
          action: 'LOGOUT',
          resource: 'User',
          resourceId: userId,
          userRole: null,
          details: {},
          ipAddress: null,
          userAgent: null,
          timestamp: new Date(),
          status: 'success',
          severity: 3
        },
      ] as AuditLog[];

      // getLogsByUser는 repository.find를 사용함
      mockRepository.find.mockResolvedValue(mockLogs);

      const result = await service.getLogsByUser(userId, 10);

      expect(result).toEqual(mockLogs);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { timestamp: 'DESC' },
        take: 10,
      });
    });
  });

  describe('getHighSeverityLogs', () => {
    it('높은 심각도의 감사 로그를 조회할 수 있어야 함', async () => {
      const mockLogs = [
        { 
          id: 'log-1', 
          severity: 4, 
          action: 'CRITICAL_ERROR',
          resource: 'System',
          resourceId: 'system',
          userId: null,
          userRole: null,
          details: {},
          ipAddress: null,
          userAgent: null,
          timestamp: new Date(),
          status: 'failed'
        },
        { 
          id: 'log-2', 
          severity: 5, 
          action: 'SECURITY_BREACH',
          resource: 'Security',
          resourceId: 'security',
          userId: null,
          userRole: null,
          details: {},
          ipAddress: null,
          userAgent: null,
          timestamp: new Date(),
          status: 'blocked'
        },
      ] as AuditLog[];

      // 새로운 쿼리 빌더 인스턴스 생성 및 모킹 재정의
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockLogs),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getHighSeverityLogs(4, 50);

      expect(result).toEqual(mockLogs);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'audit.severity >= :minSeverity',
        { minSeverity: 4 }
      );
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('getActionStatistics', () => {
    it('액션별 통계를 문자열 카운트로 반환해야 함', async () => {
      const mockStats = [
        { action: 'LOGIN', count: 100 },
        { action: 'LOGOUT', count: 95 },
      ];

      // 새로운 쿼리 빌더 인스턴스 생성 및 모킹 재정의
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getActionStatistics();

      expect(result).toEqual([
        { action: 'LOGIN', count: '100' },
        { action: 'LOGOUT', count: '95' },
      ]);
    });

    it('날짜 범위가 제공되면 필터링해야 함', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      
      // 새로운 쿼리 빌더 인스턴스 생성 및 모킹 재정의
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.getActionStatistics(startDate, endDate);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit.timestamp >= :startDate',
        { startDate }
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'audit.timestamp <= :endDate',
        { endDate }
      );
    });
  });
});