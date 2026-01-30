import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { CreateWorkerDto } from "./dto/create-worker.dto";
import { WorkersService } from "./workers.service";

@ApiTags("workers")
@ApiBearerAuth()
@Roles("manager", "baku", "mitra", "koreksi")
@Controller("workers")
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Post()
  create(@Body() dto: CreateWorkerDto) {
    return this.workersService.create(dto);
  }

  @Get()
  findAll() {
    return this.workersService.findAll();
  }
}
