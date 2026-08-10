import { Module } from "@nestjs/common";
import { BakuController } from "./baku.controller";
import { BakuService } from "./baku.service";
import { WorkOrdersModule } from "../work-orders/work-orders.module";

@Module({
  controllers: [BakuController],
  providers: [BakuService],
  imports: [WorkOrdersModule],
})
export class BakuModule {}
