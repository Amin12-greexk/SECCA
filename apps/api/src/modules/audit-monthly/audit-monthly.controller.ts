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
import { badRequest } from '../../common/errors';
import { AuditMonthlyService } from './audit-monthly.service';
import { PeriodIdQueryDto } from './dto/period-id-query.dto';

/** Batas ukuran upload; workbook bulanan realistis jauh di bawah ini. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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
    if (!request.isMultipart()) {
      badRequest("Request harus multipart/form-data dengan field 'file'.");
    }

    const file = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!file) {
      badRequest("File tidak ditemukan. Kirim file Excel di field 'file'.");
      return;
    }

    const buffer = await file.toBuffer();

    if (file.file.truncated) {
      badRequest('Ukuran file melebihi 10 MB.');
    }
    if (buffer.length === 0) {
      badRequest('File kosong. Upload file Excel yang berisi data.');
    }

    const user = (request as FastifyRequest & { user?: { sub?: string } }).user;

    return this.auditMonthlyService.importWorkbook({
      buffer,
      fileName: file.filename,
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
