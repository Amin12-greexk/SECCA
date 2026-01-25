import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiParam, ApiTags } from "@nestjs/swagger";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { BakuService } from "./baku.service";

@ApiTags("Baku")
@Controller("baku")
export class BakuController {
  constructor(private readonly bakuService: BakuService) {}

  @Post("receive")
  receive(@Body() dto: ReceiveRawBatchDto) {
    return this.bakuService.receive(dto);
  }

  @Get()
  findAll() {
    return this.bakuService.findAll();
  }

  @Get(":cardNumber")
  @ApiParam({ name: "cardNumber" })
  findByCardNumber(@Param("cardNumber") cardNumber: string) {
    return this.bakuService.findByCardNumber(cardNumber);
  }
}
