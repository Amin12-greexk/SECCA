import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { AnalyticsService } from "./analytics.service";
import { GradeUsageQueryDto } from "./dto/grade-usage-query.dto";
import { CapacityQueryDto } from "./dto/capacity-query.dto";

@ApiTags("Analytics")
@ApiBearerAuth()
@Roles("manager")
@Controller("analytics")
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get("manager/grade-usage")
    getGradeUsage(@Query() dto: GradeUsageQueryDto) {
        return this.analyticsService.getGradeUsage(dto);
    }

    @Get("manager/capacity")
    getCapacity(@Query() dto: CapacityQueryDto) {
        return this.analyticsService.getCapacity(dto);
    }
}
