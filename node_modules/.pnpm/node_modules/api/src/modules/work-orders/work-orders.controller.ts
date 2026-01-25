import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateWorkOrderDto } from "./dto/create-work-order.dto";
import { WorkOrdersService } from "./work-orders.service";

@ApiTags("work-orders")
@Controller("work-orders")
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post()
  create(@Body() dto: CreateWorkOrderDto) {
    return this.workOrdersService.create(dto);
  }
}
