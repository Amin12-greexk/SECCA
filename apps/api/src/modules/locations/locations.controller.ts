import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { CreateLocationDto } from "./dto/create-location.dto";
import { FindLocationLotsQueryDto } from "./dto/find-location-lots-query.dto";
import { LocationsService } from "./locations.service";

@ApiTags("locations")
@ApiBearerAuth()
@Roles("manager", "baku", "mitra", "koreksi", "trainer")
@Controller("locations")
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Get()
  findAll() {
    return this.locationsService.findAll();
  }

  @Get("code/:code/lots")
  findLotsByCode(@Param("code") code: string) {
    return this.locationsService.findLotsByCode(code);
  }

  @Get("code/:code/lots/paginated")
  findLotsByCodePaginated(
    @Param("code") code: string,
    @Query() query: FindLocationLotsQueryDto,
  ) {
    return this.locationsService.findLotsByCodePaginated(code, query);
  }

  @Get(":id/lots")
  findLots(@Param("id") id: string) {
    return this.locationsService.findLots(id);
  }
}
