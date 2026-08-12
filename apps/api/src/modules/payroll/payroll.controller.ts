import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { PayrollService } from './payroll.service';
import { PayrollSummaryQueryDto } from './dto/payroll-summary-query.dto';

@ApiTags('payroll')
@ApiBearerAuth()
@Roles('manager', 'baku', 'mitra', 'koreksi')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  findAll() {
    return this.payrollService.findAll();
  }

  @Get('summary')
  getSummary(@Query() query: PayrollSummaryQueryDto) {
    return this.payrollService.getSummary(query);
  }
}
