import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { TraceabilityService } from './traceability.service';

@ApiTags('traceability')
@ApiBearerAuth()
@Roles('manager', 'baku', 'mitra', 'koreksi')
@Controller('lots')
export class TraceabilityController {
  constructor(private readonly traceabilityService: TraceabilityService) {}

  @Get(':lotNumber/trace')
  trace(@Param('lotNumber') lotNumber: string) {
    return this.traceabilityService.traceLot(lotNumber);
  }
}
