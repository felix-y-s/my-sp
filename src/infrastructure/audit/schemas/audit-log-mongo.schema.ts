import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * MongoDB용 AuditLog 스키마
 * TypeORM AuditLog 엔티티와 호환되는 구조로 설계
 */
@Schema({ 
  collection: 'audit_logs',
  timestamps: true // createdAt, updatedAt 자동 생성
})
export class AuditLogMongo {
  /**
   * 수행된 액션 (CREATE_ORDER, PAYMENT_PROCESS 등)
   */
  @Prop({ 
    required: true, 
    maxLength: 100,
    index: true // 액션별 검색 최적화
  })
  action: string;

  /**
   * 대상 리소스 타입 (Order, User, Item 등)
   */
  @Prop({ 
    required: true, 
    maxLength: 100,
    index: true // 리소스별 검색 최적화
  })
  resource: string;

  /**
   * 리소스 식별자 (order_123, user_456 등)
   */
  @Prop({ 
    required: true, 
    maxLength: 255,
    index: true // 특정 리소스 검색 최적화
  })
  resourceId: string;

  /**
   * 사용자 ID (작업을 수행한 사용자)
   */
  @Prop({ 
    maxLength: 100,
    index: true // 사용자별 로그 조회 최적화
  })
  userId?: string;

  /**
   * 사용자 역할 (admin, customer, system 등)
   */
  @Prop({ 
    maxLength: 50,
    index: true // 역할별 필터링 최적화
  })
  userRole?: string;

  /**
   * 상세 정보 (JSON 객체)
   */
  @Prop({ 
    type: Object,
    default: null
  })
  details?: Record<string, any>;

  /**
   * IP 주소
   */
  @Prop({ 
    maxLength: 45, // IPv6 주소까지 지원
    sparse: true // null 값이 많은 경우 인덱스 최적화
  })
  ipAddress?: string;

  /**
   * User Agent 정보
   */
  @Prop({ 
    type: String,
    maxLength: 1000 // User Agent는 길 수 있음
  })
  userAgent?: string;

  /**
   * 결과 상태 (success, failed, blocked)
   */
  @Prop({ 
    enum: ['success', 'failed', 'blocked'], 
    default: 'success',
    index: true // 상태별 필터링 최적화
  })
  status: string;

  /**
   * 중요도 수준 (1-5, 5가 가장 중요)
   */
  @Prop({ 
    type: Number,
    min: 1, 
    max: 5, 
    default: 3,
    index: true // 심각도별 필터링 최적화
  })
  severity: number;

  /**
   * 로그 생성 시각 (Mongoose timestamps로 자동 생성)
   */
  createdAt?: Date;

  /**
   * 로그 수정 시각 (Mongoose timestamps로 자동 생성)
   */
  updatedAt?: Date;
}

export type AuditLogMongoDocument = AuditLogMongo & Document;
export const AuditLogMongoSchema = SchemaFactory.createForClass(AuditLogMongo);

// 복합 인덱스 설정
AuditLogMongoSchema.index({ resource: 1, action: 1 }, { background: true });
AuditLogMongoSchema.index({ userId: 1, createdAt: -1 }, { background: true });
AuditLogMongoSchema.index({ createdAt: -1 }, { background: true });
AuditLogMongoSchema.index({ severity: -1, createdAt: -1 }, { background: true });
AuditLogMongoSchema.index({ status: 1, createdAt: -1 }, { background: true });

// 텍스트 검색을 위한 인덱스 (선택사항)
AuditLogMongoSchema.index({ 
  action: 'text', 
  resource: 'text', 
  'details.event': 'text' 
}, { 
  background: true,
  name: 'audit_text_search'
});