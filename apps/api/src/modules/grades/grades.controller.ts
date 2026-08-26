import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { GradesService } from './grades.service';

@ApiTags('grades')
@ApiBearerAuth()
@Roles('manager', 'baku', 'mitra', 'koreksi', 'admin')
@Controller('grades')
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

  @Patch(':gradeId')
  update(@Param('gradeId') gradeId: string, @Body() dto: UpdateGradeDto) {
    return this.gradesService.update(gradeId, dto);
  }

  @Delete(':gradeId')
  remove(@Param('gradeId') gradeId: string) {
    return this.gradesService.remove(gradeId);
  }
}
