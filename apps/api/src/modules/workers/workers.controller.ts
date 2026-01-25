import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateWorkerDto } from "./dto/create-worker.dto";
import { WorkersService } from "./workers.service";

@ApiTags("workers")
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
