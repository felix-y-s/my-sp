import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditService } from '../services/audit.service';
import { AuditLog } from '../entities/audit-log.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
  ],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}