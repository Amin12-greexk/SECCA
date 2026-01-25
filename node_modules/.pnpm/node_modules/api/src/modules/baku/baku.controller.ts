import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { BakuService } from "./baku.service";

@ApiTags("baku")
@Controller("baku")
export class BakuController {
  constructor(private readonly bakuService: BakuService) {}

  @Post("receive")
  receive(@Body() dto: ReceiveRawBatchDto) {
    return this.bakuService.receive(dto);
  }
}
