import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditDashboardModule } from '../audit-dashboard/audit-dashboard.module';
import { MitraPortalController } from './mitra-portal.controller';
import { MitraPortalService } from './mitra-portal.service';

@Module({
  // Tanpa secret bawaan: token portal selalu ditandatangani/diverifikasi
  // dengan rahasia portal sendiri (lihat MitraPortalService.secret).
  imports: [AuditDashboardModule, JwtModule.register({})],
  controllers: [MitraPortalController],
  providers: [MitraPortalService],
})
export class MitraPortalModule {}
