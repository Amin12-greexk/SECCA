import { Controller, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { WorkItemsService } from "./work-items.service";

@ApiTags("work-items")
@ApiBearerAuth()
@Roles("manager", "baku", "mitra", "koreksi", "trainer")
@Controller("work-items")
export class WorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Post(":id/start")
  @ApiParam({ name: "id" })
  start(@Param("id") id: string) {
    return this.workItemsService.start(id);
  }

  @Post(":id/mark-ready")
  @ApiParam({ name: "id" })
  markReady(@Param("id") id: string) {
    return this.workItemsService.markReady(id);
  }

  @Post(":id/complete-dry-qc")
  @ApiParam({ name: "id" })
  @Roles("koreksi", "manager", "baku", "trainer")
  completeDryQc(@Param("id") id: string) {
    return this.workItemsService.completeDryQc(id);
  }

  @Post(":id/cancel")
  @ApiParam({ name: "id" })
  cancel(@Param("id") id: string) {
    return this.workItemsService.cancel(id);
  }
}
