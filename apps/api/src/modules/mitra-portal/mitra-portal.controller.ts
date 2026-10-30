import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
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
import { AuditDashboardDataset } from '@prisma/client';
import { AuditDashboardService } from '../audit-dashboard/audit-dashboard.service';
import { LinkExcelNameDto } from './dto/link-excel-name.dto';
import { MitraLoginDto } from './dto/mitra-login.dto';
import { MitraPasswordLoginDto } from './dto/mitra-password-login.dto';
import { ResetMitraPasswordDto } from './dto/reset-mitra-password.dto';
import { SetMitraPasswordDto } from './dto/set-mitra-password.dto';
import { MitraPortalService } from './mitra-portal.service';

/**
 * Portal mitra (/cek di web): mitra melihat performa & gajinya sendiri
 * cukup dengan PIN perusahaan, tanpa akun aplikasi.
 */
@ApiTags('Mitra Portal')
@Controller('mitra-portal')
export class MitraPortalController {
  constructor(
    private readonly mitraPortalService: MitraPortalService,
    private readonly auditDashboardService: AuditDashboardService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Masuk portal mitra dengan PIN saja' })
  login(@Body() dto: MitraLoginDto, @Req() request: FastifyRequest) {
    return this.mitraPortalService.login(dto.pin, request.ip);
  }

  @Post('login-password')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Masuk portal mitra dengan nama lengkap + password sendiri',
  })
  loginWithPassword(
    @Body() dto: MitraPasswordLoginDto,
    @Req() request: FastifyRequest,
  ) {
    return this.mitraPortalService.loginWithPassword(
      dto.name,
      dto.password,
      request.ip,
    );
  }

  /** @Public karena token portal diverifikasi service (lihat getMe). */
  @Post('password')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Buat/ganti password mitra yang sedang masuk; semua sesi lama berakhir',
  })
  setPassword(
    @Body() dto: SetMitraPasswordDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.mitraPortalService.setPassword(
      authorization,
      dto.password,
      dto.currentPassword,
    );
  }

  /**
   * @Public karena token portal bukan token pengguna aplikasi: JwtAuthGuard
   * gagal memverifikasinya (rahasia beda) dan melewatkannya sebagai anonim,
   * lalu service memverifikasi sendiri dengan rahasia portal.
   */
  @Get('me')
  @Public()
  @ApiOperation({
    summary: 'Performa & gaji per minggu milik mitra yang masuk',
  })
  getMe(@Headers('authorization') authorization?: string) {
    return this.mitraPortalService.getMyData(authorization);
  }

  @Post('pins')
  @Roles('manager')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload file PIN mitra (kolom Nama + PIN), menggantikan semua PIN lama',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async importPins(@Req() request: FastifyRequest) {
    const { buffer, fileName } = await readExcelUpload(request);
    return this.mitraPortalService.importPins(buffer, fileName);
  }

  @Post('pins/link')
  @Roles('manager')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Hubungkan nama lengkap (file PIN) ke nama di Excel performa',
  })
  linkExcelName(@Body() dto: LinkExcelNameDto) {
    return this.mitraPortalService.linkExcelName(
      dto.name,
      dto.excelName ?? null,
    );
  }

  /**
   * Data yang dilihat mitra di /cek: Excel format sama dengan dashboard
   * performa, tapi file & datanya terpisah (dataset PEMBAYARAN) — upload di
   * sini tidak mengubah dashboard performa, dan sebaliknya.
   */
  @Post('data')
  @Roles('manager')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload Excel data pembayaran mitra (format sama dengan performa)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async importPaymentData(@Req() request: FastifyRequest) {
    const { buffer, fileName } = await readExcelUpload(request);
    const user = (request as FastifyRequest & { user?: { sub?: string } }).user;
    return this.auditDashboardService.importWorkbook({
      buffer,
      fileName,
      userId: user?.sub ?? null,
      dataset: AuditDashboardDataset.PEMBAYARAN,
    });
  }

  @Get('data/periods')
  @Roles('manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Daftar periode data pembayaran mitra' })
  getPaymentPeriods() {
    return this.auditDashboardService.getPeriods(
      AuditDashboardDataset.PEMBAYARAN,
    );
  }

  @Post('data/reset')
  @Roles('manager')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Hapus semua data pembayaran mitra' })
  resetPaymentData() {
    return this.auditDashboardService.resetData(
      AuditDashboardDataset.PEMBAYARAN,
    );
  }

  @Post('pins/reset-password')
  @Roles('manager')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Hapus password mitra (lupa password) -> kembali masuk dengan PIN',
  })
  resetPassword(@Body() dto: ResetMitraPasswordDto) {
    return this.mitraPortalService.resetPassword(dto.name);
  }

  @Get('pins/status')
  @Roles('manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Jumlah PIN terdaftar & nama yang belum cocok' })
  getPinStatus() {
    return this.mitraPortalService.getPinStatus();
  }
}
