import { Module } from "@nestjs/common";
import { FinishController } from "./finish.controller";
import { FinishService } from "./finish.service";

@Module({
  controllers: [FinishController],
  providers: [FinishService],
})
export class FinishModule {}
