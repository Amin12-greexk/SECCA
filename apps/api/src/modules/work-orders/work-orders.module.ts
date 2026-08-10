import { Module } from "@nestjs/common";
import { WorkOrdersController } from "./work-orders.controller";
import { WorkOrdersService } from "./work-orders.service";
import { WorkOrderAssignmentService } from "./work-order-assignment.service";

@Module({
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService, WorkOrderAssignmentService],
  exports: [WorkOrderAssignmentService],
})
export class WorkOrdersModule {}
