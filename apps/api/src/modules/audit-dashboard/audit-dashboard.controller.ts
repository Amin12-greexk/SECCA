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
import { readExcelUpload } from '../../common/upload';
import { AuditDashboardService } from './audit-dashboard.service';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { TrendsQueryDto } from './dto/trends-query.dto';
import { UpdatePersonColorDto } from './dto/update-person-color.dto';

@ApiTags('Audit Dashboard')
@Controller('audit-dashboard')
export class AuditDashboardController {
  constructor(private readonly auditDashboardService: AuditDashboardService) {}

  /**
   * Upload tetap protected (manager/admin), sementara endpoint GET di bawah
   * public agar halaman /performa bisa dibuka tanpa login.
   */
  @Post('import')
  @Roles('manager')
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
    const { buffer, fileName } = await readExcelUpload(request);

    const user = (request as FastifyRequest & { user?: { sub?: string } }).user;

    return this.auditDashboardService.importWorkbook({
      buffer,
      fileName,
      userId: user?.sub ?? null,
    });
  }

  @Post('reset')
  @Roles('manager')
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
    summary:
      'Ringkasan satu periode; kosongkan periodId untuk yang terbaru. Publik, tapi kolom upah & PIN hanya ikut terkirim untuk pemanggil yang login.',
  })
  getSummary(
    @Query() query: SummaryQueryDto,
    @Req() request: { user?: { sub?: string } },
  ) {
    return this.auditDashboardService.getSummary(
      query.periodId,
      Boolean(request.user?.sub),
    );
  }

  // Dua endpoint di bawah isinya MURNI payroll (upah borong/bulanan, subsidi,
  // potongan, gaji anak harian), jadi tidak lagi @Public — cukup login, tanpa
  // syarat role tertentu.
  @Get('expense-summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ringkasan payroll & biaya per periode (perlu login)' })
  getExpenseSummary(@Query() query: SummaryQueryDto) {
    return this.auditDashboardService.getExpenseSummary(query.periodId);
  }

  @Get('harian-summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ringkasan payroll Anak Harian per periode (perlu login)' })
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
    // `personIds` dijamin ada & tidak kosong oleh @ArrayNotEmpty; `?? []` cuma
    // menjembatani tipe DTO yang `string[] | undefined` (properti tanpa
    // inisialisasi di bawah strictPropertyInitialization).
    return this.auditDashboardService.getTrends(
      query.personIds ?? [],
      query.metric,
    );
  }

  @Patch('persons/:id/color')
  @Roles('manager')
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
