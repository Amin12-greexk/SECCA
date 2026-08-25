import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { Public } from '../../auth/public.decorator';
import { Roles } from '../../auth/roles.decorator';
import { badRequest } from '../../common/errors';
import { AuditDashboardService } from './audit-dashboard.service';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { TrendsQueryDto } from './dto/trends-query.dto';
import { UpdatePersonColorDto } from './dto/update-person-color.dto';

/** Batas ukuran upload; workbook periode realistis jauh di bawah ini. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

@ApiTags('Audit Dashboard')
@Controller('audit-dashboard')
export class AuditDashboardController {
  constructor(private readonly auditDashboardService: AuditDashboardService) {}

  /**
   * Upload tetap protected (manager/admin), sementara endpoint GET di bawah
   * public agar halaman /performa bisa dibuka tanpa login.
   */
  @Post('import')
  @Roles('manager', 'admin')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload workbook Excel berisi data periode' })
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

    return this.auditDashboardService.importWorkbook({
      buffer,
      fileName: file.filename,
      userId: user?.sub ?? null,
    });
  }

  @Post('reset')
  @Roles('manager', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset semua data dashboard performa' })
  async resetData() {
    return this.auditDashboardService.resetData();
  }

  @Get('periods')
  @Public()
  @ApiOperation({ summary: 'Daftar periode untuk dashboard performa' })
  getPeriods() {
    return this.auditDashboardService.getPeriods();
  }

  @Get('summary')
  @Public()
  @ApiOperation({
    summary: 'Ringkasan satu periode; kosongkan periodId untuk yang terbaru',
  })
  getSummary(@Query() query: SummaryQueryDto) {
    return this.auditDashboardService.getSummary(query.periodId);
  }

  @Get('expense-summary')
  @Public()
  @ApiOperation({ summary: 'Ringkasan payroll & biaya per periode' })
  getExpenseSummary(@Query() query: SummaryQueryDto) {
    return this.auditDashboardService.getExpenseSummary(query.periodId);
  }

  @Get('harian-summary')
  @Public()
  @ApiOperation({ summary: 'Ringkasan payroll Anak Harian per periode' })
  getHarianSummary(@Query() query: SummaryQueryDto) {
    return this.auditDashboardService.getHarianSummary(query.periodId);
  }

  @Get('persons')
  @Public()
  @ApiOperation({ summary: 'Daftar mitra beserta warnanya' })
  getPersons() {
    return this.auditDashboardService.getPersons();
  }

  @Get('period-stats')
  @Public()
  @ApiOperation({
    summary: 'Kapasitas tiap periode + selisih vs periode sebelumnya',
  })
  getPeriodStats() {
    return this.auditDashboardService.getPeriodStats();
  }

  @Get('trends')
  @Public()
  @ApiOperation({ summary: 'Tren satu/beberapa mitra antar periode' })
  getTrends(@Query() query: TrendsQueryDto) {
    return this.auditDashboardService.getTrends(query.personIds, query.metric);
  }

  @Patch('persons/:id/color')
  @Roles('manager', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set warna custom untuk satu mitra' })
  updatePersonColor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePersonColorDto,
  ) {
    return this.auditDashboardService.updatePersonColor(
      id,
      dto.colorHex ?? null,
    );
  }
}
