import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateGradeDto } from "./dto/create-grade.dto";
import { GradesService } from "./grades.service";

@ApiTags("grades")
@Controller("grades")
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Post()
  create(@Body() dto: CreateGradeDto) {
    return this.gradesService.create(dto);
  }

  @Get()
  findAll() {
    return this.gradesService.findAll();
  }
}
