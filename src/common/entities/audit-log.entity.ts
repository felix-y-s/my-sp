import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index(['resource', 'action'], { background: true })
@Index(['userId'], { background: true })
@Index(['timestamp'], { background: true })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, comment: '수행된 액션' })
  action: string;

  @Column({ type: 'varchar', length: 100, comment: '대상 리소스 타입' })
  resource: string;

  @Column({ type: 'varchar', length: 255, comment: '리소스 식별자' })
  resourceId: string;

  @Column({ 
    type: 'varchar', 
    length: 100, 
    nullable: true, 
    comment: '사용자 ID' 
  })
  userId: string;

  @Column({ 
    type: 'varchar', 
    length: 50, 
    nullable: true, 
    comment: '사용자 역할' 
  })
  userRole: string;

  @Column({ 
    type: 'json', 
    nullable: true, 
    comment: '상세 정보' 
  })
  details: Record<string, any>;

  @Column({ 
    type: 'varchar', 
    length: 45, 
    nullable: true, 
    comment: 'IP 주소' 
  })
  ipAddress: string;

  @Column({ 
    type: 'text', 
    nullable: true, 
    comment: 'User Agent' 
  })
  userAgent: string;

  @CreateDateColumn({ comment: '로그 생성 시각' })
  timestamp: Date;

  @Column({ 
    type: 'varchar', 
    length: 20,
    default: 'success',
    comment: '결과 상태 (success, failed, blocked)' 
  })
  status: string;

  /**
   * 중요도 수준 (1-5, 5가 가장 중요)
   */
  @Column({ 
    type: 'tinyint', 
    default: 3, 
    comment: '중요도 (1-5)' 
  })
  severity: number;
}