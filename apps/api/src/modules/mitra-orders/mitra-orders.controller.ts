import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { AssignMitraOrderRequestWorkerDto } from './dto/assign-mitra-order-request-worker.dto';
import { CreateMitraOrderRequestDto } from './dto/create-mitra-order-request.dto';
import { CreateTrainerBulkOrderDto } from './dto/create-trainer-bulk-order.dto';
import { QueryMitraOrderRequestDto } from './dto/query-mitra-order-request.dto';
import { QueryTrainerWorkersDto } from './dto/query-trainer-workers.dto';
import { RejectMitraOrderRequestDto } from './dto/reject-mitra-order-request.dto';
import { MitraOrdersService } from './mitra-orders.service';

type ReqUser = { sub?: string; role?: string };

@ApiTags('mitra-orders')
@ApiBearerAuth()
@Roles('mitra', 'trainer', 'baku', 'manager', 'koreksi')
@Controller('mitra-orders')
export class MitraOrdersController {
  constructor(private readonly mitraOrdersService: MitraOrdersService) {}

  @Post('requests')
  create(
    @Body() dto: CreateMitraOrderRequestDto,
    @Req() req: { user?: ReqUser },
  ) {
    return this.mitraOrdersService.create(dto, req.user ?? {});
  }

  @Post('requests/trainer-bulk')
  @Roles('trainer', 'manager')
  createTrainerBulk(
    @Body() dto: CreateTrainerBulkOrderDto,
    @Req() req: { user?: ReqUser },
  ) {
    return this.mitraOrdersService.createTrainerBulk(dto, req.user ?? {});
  }

  @Get('trainer/workers')
  @Roles('trainer', 'manager', 'baku', 'koreksi')
  listTrainerWorkers(
    @Query() query: QueryTrainerWorkersDto,
    @Req() req: { user?: ReqUser },
  ) {
    return this.mitraOrdersService.listTrainerWorkers(query, req.user ?? {});
  }

  @Get('requests')
  findAll(
    @Query() query: QueryMitraOrderRequestDto,
    @Req() req: { user?: ReqUser },
  ) {
    return this.mitraOrdersService.findAll(query, req.user ?? {});
  }

  @Get('requests/:id')
  findById(@Param('id') id: string, @Req() req: { user?: ReqUser }) {
    return this.mitraOrdersService.findById(id, req.user ?? {});
  }

  @Post('requests/:id/approve')
  @Roles('trainer', 'baku', 'manager', 'koreksi')
  approve(@Param('id') id: string, @Req() req: { user?: ReqUser }) {
    return this.mitraOrdersService.approve(id, req.user ?? {});
  }

  @Post('requests/:id/reject')
  @Roles('trainer', 'baku', 'manager', 'koreksi')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectMitraOrderRequestDto,
    @Req() req: { user?: ReqUser },
  ) {
    return this.mitraOrdersService.reject(id, dto.reason ?? '', req.user ?? {});
  }

  @Post('requests/:id/assign-worker')
  @Roles('trainer', 'manager')
  assignWorker(
    @Param('id') id: string,
    @Body() dto: AssignMitraOrderRequestWorkerDto,
    @Req() req: { user?: ReqUser },
  ) {
    return this.mitraOrdersService.assignWorker(
      id,
      dto.workerId,
      req.user ?? {},
    );
  }

  @Post('requests/:id/fulfill')
  @Roles('baku', 'manager', 'koreksi')
  fulfill(@Param('id') id: string, @Req() req: { user?: ReqUser }) {
    return this.mitraOrdersService.markFulfilled(id, req.user ?? {});
  }

  @Delete('requests/:id')
  cancel(@Param('id') id: string, @Req() req: { user?: ReqUser }) {
    return this.mitraOrdersService.cancel(id, req.user ?? {});
  }

  @Patch('requests/:id')
  updateRequest(
    @Param('id') id: string,
    @Body() dto: { requestedGram: number; lpCount?: number; note?: string },
    @Req() req: { user?: ReqUser },
  ) {
    return this.mitraOrdersService.updateRequest(id, dto, req.user ?? {});
  }
}
