import { Module } from '@nestjs/common';
import { AuditDashboardController } from './audit-dashboard.controller';
import { AuditDashboardService } from './audit-dashboard.service';

@Module({
  controllers: [AuditDashboardController],
  providers: [AuditDashboardService],
})
export class AuditDashboardModule {}
