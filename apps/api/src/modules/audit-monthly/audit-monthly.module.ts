import { Module } from '@nestjs/common';
import { AuditMonthlyController } from './audit-monthly.controller';
import { AuditMonthlyService } from './audit-monthly.service';

@Module({
  controllers: [AuditMonthlyController],
  providers: [AuditMonthlyService],
})
export class AuditMonthlyModule {}
