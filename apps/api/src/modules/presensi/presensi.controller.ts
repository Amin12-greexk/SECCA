import {
  Body,
  Controller,
  Delete,
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
import { Roles } from '../../auth/roles.decorator';
import { readExcelUpload } from '../../common/upload';
import { PresensiService } from './presensi.service';
import {
  PresensiQueryDto,
  CreatePresensiDto,
  UpdatePresensiDto,
} from './dto/presensi.dto';

type AuthedRequest = FastifyRequest & { user?: { sub?: string } };

@ApiTags('Presensi Finger')
@ApiBearerAuth()
@Controller('presensi')
export class PresensiController {
  constructor(private readonly presensiService: PresensiService) {}

  /**
   * Lihat presensi: manager, atau akun yang diberi akses menu Laporan
   * (lihat API_ACCESS_RULES — khusus GET).
   */
  @Get()
  @Roles('manager')
  @ApiOperation({
    summary: 'Presensi per bulan; weekStart (Kamis) untuk filter per minggu',
  })
  list(@Query() query: PresensiQueryDto) {
    return this.presensiService.list(query);
  }

  @Post('import')
  @Roles('manager')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload Excel presensi (sheet bulanan)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async importWorkbook(@Req() request: AuthedRequest) {
    const { buffer, fileName } = await readExcelUpload(request);
    return this.presensiService.importWorkbook({
      buffer,
      fileName,
      userId: request.user?.sub ?? null,
    });
  }

  @Post('records')
  @Roles('manager')
  @ApiOperation({ summary: 'Tambah/ganti satu catatan presensi (manual)' })
  create(@Body() dto: CreatePresensiDto, @Req() request: AuthedRequest) {
    return this.presensiService.create(dto, request.user?.sub ?? null);
  }

  @Patch('records/:id')
  @Roles('manager')
  @ApiOperation({ summary: 'Ubah jam masuk/pulang' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePresensiDto,
    @Req() request: AuthedRequest,
  ) {
    return this.presensiService.update(id, dto, request.user?.sub ?? null);
  }

  @Delete('records/:id')
  @Roles('manager')
  @ApiOperation({ summary: 'Hapus satu catatan presensi' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.presensiService.remove(id);
  }

  @Post('reset')
  @Roles('manager')
  @ApiOperation({ summary: 'Hapus semua data presensi' })
  reset() {
    return this.presensiService.reset();
  }
}
