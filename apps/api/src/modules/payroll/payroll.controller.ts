import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PayrollService } from "./payroll.service";

@ApiTags("payroll")
@Controller("payroll")
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  findAll() {
    return this.payrollService.findAll();
  }
}
