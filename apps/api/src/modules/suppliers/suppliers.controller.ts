import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@ApiTags("suppliers")
@ApiBearerAuth()
@Roles("manager", "baku", "mitra", "koreksi")
@Controller("suppliers")
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
}
