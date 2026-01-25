import { Module } from "@nestjs/common";
import { BakuController } from "./baku.controller";
import { BakuService } from "./baku.service";

@Module({
  controllers: [BakuController],
  providers: [BakuService],
})
export class BakuModule {}
