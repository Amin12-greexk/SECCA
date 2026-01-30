import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { AutoSplitDto } from "./dto/auto-split.dto";
import { CreateLotDto } from "./dto/create-lot.dto";
import { LotsService } from "./lots.service";

@ApiTags("lots")
@ApiBearerAuth()
@Roles("manager", "baku", "mitra", "koreksi")
@Controller("lots")
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  @Post()
  create(@Body() dto: CreateLotDto) {
    return this.lotsService.createLot(dto);
  }

  @Post("auto-split")
  autoSplit(@Body() dto: AutoSplitDto) {
    return this.lotsService.autoSplit(dto);
  }
}
