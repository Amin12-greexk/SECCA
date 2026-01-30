import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { FinishService } from "./finish.service";
import { FinishDto } from "./dto/finish.dto";

@ApiTags("finish")
@ApiBearerAuth()
@Roles("manager", "baku", "mitra", "koreksi")
@Controller("finish")
export class FinishController {
  constructor(private readonly finishService: FinishService) {}

  @Post()
  finish(@Body() dto: FinishDto) {
    return this.finishService.finish(dto);
  }
}
