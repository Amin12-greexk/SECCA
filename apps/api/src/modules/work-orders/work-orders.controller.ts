import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import { WorkOrdersService } from "./work-orders.service";

@ApiTags("work-orders")
@ApiBearerAuth()
@Roles("manager", "baku", "mitra", "koreksi")
@Controller("work-orders")
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post()
  create(@Body() dto: CreateWorkOrderDto) {
    return this.workOrdersService.create(dto);
  }
}
