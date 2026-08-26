import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { WorkersService } from './workers.service';

@ApiTags('workers')
@ApiBearerAuth()
@Roles('manager', 'baku', 'mitra', 'koreksi', 'trainer', 'admin')
@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Post()
  create(@Body() dto: CreateWorkerDto) {
    return this.workersService.create(dto);
  }

  @Patch(':id')
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    return this.workersService.update(id, dto);
  }

  @Get()
  findAll() {
    return this.workersService.findAll();
  }

  @Get(':id/weekly-stats')
  @ApiParam({ name: 'id' })
  @Roles('manager', 'trainer', 'mitra')
  weeklyStats(@Param('id') id: string, @Query('weeks') weeks?: string) {
    const parsed = weeks ? Number(weeks) : undefined;
    return this.workersService.getWeeklyStats(id, parsed);
  }
}
