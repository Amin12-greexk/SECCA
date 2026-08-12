import { Module } from '@nestjs/common';
import { BarangJadiController } from './barang-jadi.controller';
import { BarangJadiService } from './barang-jadi.service';

@Module({
  controllers: [BarangJadiController],
  providers: [BarangJadiService],
})
export class BarangJadiModule {}
