import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { GradeRawBatchDto } from './dto/grade-raw-batch.dto';
import { GradingService } from './grading.service';

@ApiTags('grading')
@ApiBearerAuth()
@Roles('manager', 'baku', 'mitra', 'koreksi')
@Controller('grading')
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Post(':rawBatchId')
  grade(
    @Param('rawBatchId') rawBatchId: string,
    @Body() dto: GradeRawBatchDto,
  ) {
    return this.gradingService.grade(rawBatchId, dto);
  }
}
