import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { CreatePecahBonDto } from "./dto/create-pecah-bon.dto";
import { UpdatePecahBonDto } from "./dto/update-pecah-bon.dto";
import { UpdateRawBatchDto } from "./dto/update-raw-batch.dto";
import { RawBatchPageQueryDto } from "./dto/raw-batch-page-query.dto";
import { PecahBonPageQueryDto } from "./dto/pecah-bon-page-query.dto";
import { PecahBonHistoryQueryDto } from "./dto/pecah-bon-history-query.dto";
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

  @Get("paginated")
  findAllPaginated(@Query() query: RawBatchPageQueryDto) {
    return this.bakuService.findAllPaginated(query);
  }

  @Get("pecah-bon/history")
  getPecahBonHistory(@Query() query: PecahBonHistoryQueryDto) {
    return this.bakuService.getPecahBonHistory(query);
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

  @Patch("pecah-bon-entry/:id")
  @ApiParam({ name: "id" })
  updatePecahBonEntry(@Param("id") id: string, @Body() dto: UpdatePecahBonDto) {
    return this.bakuService.updatePecahBonEntry(id, dto);
  }

  @Patch("raw-batch/:id")
  @ApiParam({ name: "id" })
  updateRawBatch(@Param("id") id: string, @Body() dto: UpdateRawBatchDto) {
    return this.bakuService.updateRawBatch(id, dto);
  }

  @Post("pecah-bon-entry/:id/printed")
  @ApiParam({ name: "id" })
  markPecahBonPrinted(@Param("id") id: string) {
    return this.bakuService.markPecahBonPrinted(id);
  }

  @Get(":id/pecah-bon")
  @ApiParam({ name: "id" })
  getPecahBonEntries(@Param("id") id: string) {
    return this.bakuService.getPecahBonEntries(id);
  }

  @Get(":id/pecah-bon/paginated")
  @ApiParam({ name: "id" })
  getPecahBonEntriesPaginated(
    @Param("id") id: string,
    @Query() query: PecahBonPageQueryDto,
  ) {
    return this.bakuService.getPecahBonEntriesPaginated(id, query);
  }
}
