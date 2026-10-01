import { Controller, Get, Post, Query, Req } from '@nestjs/common';
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
import { AuditMonthlyService } from './audit-monthly.service';
import { PeriodIdQueryDto } from './dto/period-id-query.dto';

/**
 * Dashboard audit bulanan — khusus role ADMIN, tidak ada endpoint @Public di
 * modul ini sama sekali (beda dari /audit-dashboard yang publik untuk
 * kapasitas). Lihat audit-monthly.parser.ts untuk format sumbernya.
 */
@ApiTags('Audit Monthly')
@Controller('audit-monthly')
@Roles('admin')
@ApiBearerAuth()
export class AuditMonthlyController {
  constructor(private readonly auditMonthlyService: AuditMonthlyService) {}

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload workbook Excel laporan bulanan (1 sheet = 1 bulan)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async importWorkbook(@Req() request: FastifyRequest) {
    const { buffer, fileName } = await readExcelUpload(request);

    const user = (request as FastifyRequest & { user?: { sub?: string } }).user;

    return this.auditMonthlyService.importWorkbook({
      buffer,
      fileName,
      userId: user?.sub ?? null,
    });
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset semua data laporan bulanan' })
  resetData() {
    return this.auditMonthlyService.resetData();
  }

  @Get('months')
  @ApiOperation({
    summary:
      'Daftar total per bulan (Baku Basah, BJD, Rendemen) + delta vs bulan sebelumnya',
  })
  getMonths() {
    return this.auditMonthlyService.getMonths();
  }

  @Get('persons')
  @ApiOperation({
    summary: 'Rincian per mitra satu bulan (Baku Basah, BJD, Rendemen)',
  })
  getPersonMetrics(@Query() query: PeriodIdQueryDto) {
    return this.auditMonthlyService.getPersonMetrics(query.periodId);
  }
}
