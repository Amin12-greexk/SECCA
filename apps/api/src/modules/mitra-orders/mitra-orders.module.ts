import { Module } from '@nestjs/common';
import { MitraOrdersController } from './mitra-orders.controller';
import { MitraOrdersService } from './mitra-orders.service';

@Module({
  controllers: [MitraOrdersController],
  providers: [MitraOrdersService],
})
export class MitraOrdersModule {}
