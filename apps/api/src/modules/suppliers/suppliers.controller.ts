import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('suppliers')
@ApiBearerAuth()
@Roles('manager', 'baku', 'mitra', 'koreksi')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Get()
  findAll() {
    return this.suppliersService.findAll();
  }

  @Patch(':supplierId')
  update(
    @Param('supplierId') supplierId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(supplierId, dto);
  }

  @Delete(':supplierId')
  remove(@Param('supplierId') supplierId: string) {
    return this.suppliersService.remove(supplierId);
  }
}
