import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { CreatePecahBonDto } from "./dto/create-pecah-bon.dto";
import { BakuService } from "./baku.service";

@ApiTags("Baku")
@ApiBearerAuth()
@Roles("manager", "baku", "mitra", "koreksi")
@Controller("baku")
export class BakuController {
  constructor(private readonly bakuService: BakuService) { }

  @Post("receive")
  receive(@Body() dto: ReceiveRawBatchDto) {
    return this.bakuService.receive(dto);
  }

  @Get()
  findAll() {
    return this.bakuService.findAll();
  }

  @Get("pecah-bon/:pecahBonId")
  @ApiParam({ name: "pecahBonId" })
  findPecahBonById(@Param("pecahBonId") pecahBonId: string) {
    return this.bakuService.findPecahBonById(pecahBonId);
  }

  @Get(":cardId")
  @ApiParam({ name: "cardId" })
  findByCardId(@Param("cardId") cardId: string) {
    return this.bakuService.findByCardId(cardId);
  }

  @Post(":id/pecah-bon")
  @ApiParam({ name: "id" })
  createPecahBon(@Param("id") id: string, @Body() dto: CreatePecahBonDto) {
    return this.bakuService.createPecahBon(id, dto);
  }

  @Get(":id/pecah-bon")
  @ApiParam({ name: "id" })
  getPecahBonEntries(@Param("id") id: string) {
    return this.bakuService.getPecahBonEntries(id);
  }
}
