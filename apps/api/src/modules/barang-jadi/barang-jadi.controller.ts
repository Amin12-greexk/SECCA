import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { BarangJadiService } from './barang-jadi.service';
import { CreateBarangJadiDto } from './dto/create-barang-jadi.dto';
import { UpdateBarangJadiDto } from './dto/update-barang-jadi.dto';
import { CreateByProductTypeDto } from './dto/create-by-product-type.dto';
import { UpdateByProductTypeDto } from './dto/update-by-product-type.dto';
import { CreateResultGradeTypeDto } from './dto/create-result-grade-type.dto';
import { UpdateResultGradeTypeDto } from './dto/update-result-grade-type.dto';

@ApiTags('barang-jadi')
@ApiBearerAuth()
@Controller('barang-jadi')
export class BarangJadiController {
  constructor(private readonly barangJadiService: BarangJadiService) {}

  @Get()
  @Roles('koreksi', 'manager', 'baku')
  findAll() {
    return this.barangJadiService.findAll();
  }

  @Get('by-products')
  @Roles('koreksi', 'manager', 'baku')
  findAllByProducts() {
    return this.barangJadiService.findAllByProductTypes();
  }

  @Get('result-grades')
  @Roles('koreksi', 'manager', 'baku')
  findAllResultGrades() {
    return this.barangJadiService.findAllResultGradeTypes();
  }

  @Post()
  @Roles('koreksi', 'manager')
  create(@Body() dto: CreateBarangJadiDto) {
    return this.barangJadiService.create(dto);
  }

  @Post('by-products')
  @Roles('koreksi', 'manager')
  createByProduct(@Body() dto: CreateByProductTypeDto) {
    return this.barangJadiService.createByProductType(dto);
  }

  @Post('result-grades')
  @Roles('koreksi', 'manager')
  createResultGrade(@Body() dto: CreateResultGradeTypeDto) {
    return this.barangJadiService.createResultGradeType(dto);
  }

  @Patch(':id')
  @Roles('koreksi', 'manager')
  @ApiParam({ name: 'id', description: 'Barang jadi id' })
  update(@Param('id') id: string, @Body() dto: UpdateBarangJadiDto) {
    return this.barangJadiService.update(id, dto);
  }

  @Patch('by-products/:id')
  @Roles('koreksi', 'manager')
  @ApiParam({ name: 'id', description: 'By product id' })
  updateByProduct(
    @Param('id') id: string,
    @Body() dto: UpdateByProductTypeDto,
  ) {
    return this.barangJadiService.updateByProductType(id, dto);
  }

  @Patch('result-grades/:id')
  @Roles('koreksi', 'manager')
  @ApiParam({ name: 'id', description: 'Result grade id' })
  updateResultGrade(
    @Param('id') id: string,
    @Body() dto: UpdateResultGradeTypeDto,
  ) {
    return this.barangJadiService.updateResultGradeType(id, dto);
  }

  @Delete(':id')
  @Roles('koreksi', 'manager')
  @ApiParam({ name: 'id', description: 'Barang jadi id' })
  remove(@Param('id') id: string) {
    return this.barangJadiService.remove(id);
  }

  @Delete('by-products/:id')
  @Roles('koreksi', 'manager')
  @ApiParam({ name: 'id', description: 'By product id' })
  removeByProduct(@Param('id') id: string) {
    return this.barangJadiService.removeByProductType(id);
  }

  @Delete('result-grades/:id')
  @Roles('koreksi', 'manager')
  @ApiParam({ name: 'id', description: 'Result grade id' })
  removeResultGrade(@Param('id') id: string) {
    return this.barangJadiService.removeResultGradeType(id);
  }
}
