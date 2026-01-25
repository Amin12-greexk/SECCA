import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateLocationDto } from "./dto/create-location.dto";
import { LocationsService } from "./locations.service";

@ApiTags("locations")
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

  @Get(":id/lots")
  findLots(@Param("id") id: string) {
    return this.locationsService.findLots(id);
  }
}
