import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/roles.decorator";
import { PayrollService } from "./payroll.service";

@ApiTags("payroll")
@ApiBearerAuth()
@Roles("manager", "baku", "mitra", "koreksi")
@Controller("payroll")
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  findAll() {
    return this.payrollService.findAll();
  }
}
