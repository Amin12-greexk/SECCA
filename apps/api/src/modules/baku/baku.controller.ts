import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { BakuService } from "./baku.service";

@ApiTags("Baku")
@ApiBearerAuth()
@Roles("manager", "baku", "mitra", "koreksi")
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

  @Get(":cardId")
  @ApiParam({ name: "cardId" })
  findByCardId(@Param("cardId") cardId: string) {
    return this.bakuService.findByCardId(cardId);
  }
}
