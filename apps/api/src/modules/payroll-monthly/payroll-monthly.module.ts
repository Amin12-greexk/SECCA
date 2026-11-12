import { Module } from '@nestjs/common';
import { PayrollMonthlyController } from './payroll-monthly.controller';
import { PayrollMonthlyService } from './payroll-monthly.service';

@Module({
  controllers: [PayrollMonthlyController],
  providers: [PayrollMonthlyService],
})
export class PayrollMonthlyModule {}
