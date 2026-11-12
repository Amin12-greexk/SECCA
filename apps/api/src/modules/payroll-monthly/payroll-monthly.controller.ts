import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Roles } from '../../auth/roles.decorator';
import { readExcelUpload } from '../../common/upload';
import { MonthQueryDto } from './dto/payroll-monthly.dto';
import { PayrollMonthlyService } from './payroll-monthly.service';

/**
 * Upload & hapus khusus manager. Melihat (GET): manager, atau akun dengan
 * akses Laporan/Dashboard (lihat API_ACCESS_RULES).
 */
@ApiTags('Penggajian Bulanan')
@ApiBearerAuth()
@Controller('payroll-monthly')
export class PayrollMonthlyController {
  constructor(private readonly service: PayrollMonthlyService) {}

  @Post('import')
  @Roles('manager')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload Excel penggajian bulanan (menimpa bulan yang sama)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async importWorkbook(@Req() request: FastifyRequest) {
    const { buffer, fileName } = await readExcelUpload(request);
    return this.service.importWorkbook({ buffer, fileName });
  }

  @Get('months')
  @Roles('manager')
  @ApiOperation({ summary: 'Daftar bulan penggajian yang tersimpan' })
  listMonths() {
    return this.service.listMonths();
  }

  @Get()
  @Roles('manager')
  @ApiOperation({ summary: 'Penggajian satu bulan (mitra + anak harian)' })
  getMonth(@Query() query: MonthQueryDto) {
    return this.service.getMonth(query.month);
  }

  @Delete('reset')
  @Roles('manager')
  @ApiOperation({ summary: 'Hapus semua data penggajian bulanan' })
  reset() {
    return this.service.reset();
  }

  @Delete(':month')
  @Roles('manager')
  @ApiOperation({ summary: 'Hapus satu bulan' })
  deleteMonth(@Param('month') month: string) {
    return this.service.deleteMonth(month);
  }
}
