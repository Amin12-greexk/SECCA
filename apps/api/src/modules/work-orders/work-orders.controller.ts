import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { AssignFromMitraOrderDto } from './dto/assign-from-mitra-order.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { CancelWorkOrderDto } from './dto/cancel-work-order.dto';
import { WorkOrdersService } from './work-orders.service';

@ApiTags('work-orders')
@ApiBearerAuth()
@Roles('manager', 'baku', 'mitra', 'koreksi', 'trainer')
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post()
  create(@Body() dto: CreateWorkOrderDto) {
    return this.workOrdersService.create(dto);
  }

  @Post('assign-from-mitra-order')
  @Roles('trainer', 'manager', 'baku')
  assignFromMitraOrder(@Body() dto: AssignFromMitraOrderDto) {
    return this.workOrdersService.assignFromMitraOrder(dto);
  }

  @Get('board')
  board(
    @Query('workerId') workerId?: string,
    @Query('trainerId') trainerId?: string,
  ) {
    return this.workOrdersService.board(workerId, trainerId);
  }

  @Post(':id/close')
  @ApiParam({ name: 'id' })
  @Roles('manager', 'baku', 'koreksi')
  close(@Param('id') id: string) {
    return this.workOrdersService.close(id);
  }

  @Post(':id/cancel')
  @ApiParam({ name: 'id' })
  @Roles('trainer', 'manager')
  cancelOrder(@Param('id') id: string, @Body() dto: CancelWorkOrderDto) {
    return this.workOrdersService.cancelOrder(id, dto);
  }
}
