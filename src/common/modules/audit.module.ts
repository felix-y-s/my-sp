import { Global, Module } from '@nestjs/common';
import { AuditModule as InfrastructureAuditModule } from '../../infrastructure/audit/audit.module';

/**
 * 감사 시스템 모듈 (레거시 호환성 래퍼)
 * 
 * @deprecated Phase 2에서 infrastructure/audit/audit.module.ts로 이동됨
 * 이 모듈은 하위 호환성을 위해서만 존재하며, 곧 제거될 예정입니다.
 * 새로운 코드에서는 직접 InfrastructureAuditModule을 import하세요.
 */
@Global()
@Module({
  imports: [InfrastructureAuditModule],
  exports: [InfrastructureAuditModule],
})
export class AuditModule {}