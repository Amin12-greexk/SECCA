import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { ReportsService } from "./reports.service";
import { WeeklyReportQueryDto } from "./dto/weekly-report-query.dto";

@ApiTags("reports")
@ApiBearerAuth()
@Roles("manager")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("weekly-payroll")
  @ApiOperation({
    summary: "Laporan mingguan payroll, kehadiran, dan premi mitra",
  })
  getWeeklyPayroll(@Query() query: WeeklyReportQueryDto) {
    return this.reportsService.getWeeklyPayroll(query);
  }
}
