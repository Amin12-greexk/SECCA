import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { GradeRawBatchDto } from "./dto/grade-raw-batch.dto";
import { GradingService } from "./grading.service";

@ApiTags("grading")
@Controller("grading")
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Post(":rawBatchId")
  grade(@Param("rawBatchId") rawBatchId: string, @Body() dto: GradeRawBatchDto) {
    return this.gradingService.grade(rawBatchId, dto);
  }
}
