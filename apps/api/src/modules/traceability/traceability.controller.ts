import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TraceabilityService } from "./traceability.service";

@ApiTags("traceability")
@Controller("lots")
export class TraceabilityController {
  constructor(private readonly traceabilityService: TraceabilityService) {}

  @Get(":lotNumber/trace")
  trace(@Param("lotNumber") lotNumber: string) {
    return this.traceabilityService.traceLot(lotNumber);
  }
}
