import { Controller, Get, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { AttendanceService } from "./attendance.service";
import { QueryAttendanceDto } from "./dto/query-attendance.dto";

@ApiTags("attendance")
@ApiBearerAuth()
@Roles("mitra", "manager", "trainer")
@Controller("attendance")
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get("me")
  getMyAttendance(
    @Req() req: { user?: { sub?: string } },
    @Query() query: QueryAttendanceDto,
  ) {
    return this.attendanceService.getMyAttendance(req.user?.sub ?? "", query);
  }
}
