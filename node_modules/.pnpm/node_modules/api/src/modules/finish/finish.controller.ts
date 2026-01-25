import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FinishService } from "./finish.service";
import { FinishDto } from "./dto/finish.dto";

@ApiTags("finish")
@Controller("finish")
export class FinishController {
  constructor(private readonly finishService: FinishService) {}

  @Post()
  finish(@Body() dto: FinishDto) {
    return this.finishService.finish(dto);
  }
}
