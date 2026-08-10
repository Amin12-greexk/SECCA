import { Controller, Get, Post, Body, Put, Param, Delete } from '@nestjs/common';
import { ProductionRoomsService } from './production-rooms.service';
import { CreateProductionRoomDto } from './dto/create-production-room.dto';
import { UpdateProductionRoomDto } from './dto/update-production-room.dto';
import { Roles } from '../../auth/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('production-rooms')
@ApiBearerAuth()
@Roles('manager', 'baku', 'koreksi', 'trainer')
@Controller('production-rooms')
export class ProductionRoomsController {
  constructor(private readonly productionRoomsService: ProductionRoomsService) {}

  @Post()
  @Roles('manager')
  create(@Body() dto: CreateProductionRoomDto) {
    return this.productionRoomsService.create(dto);
  }

  @Get()
  @Roles('manager', 'baku', 'koreksi', 'trainer')
  findAll() {
    return this.productionRoomsService.findAll();
  }

  @Get(':id')
  @Roles('manager', 'baku', 'koreksi', 'trainer')
  findOne(@Param('id') id: string) {
    return this.productionRoomsService.findOne(id);
  }

  @Put(':id')
  @Roles('manager')
  update(@Param('id') id: string, @Body() dto: UpdateProductionRoomDto) {
    return this.productionRoomsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  delete(@Param('id') id: string) {
    return this.productionRoomsService.delete(id);
  }
}
