import { Module } from '@nestjs/common';
import { ProductionRoomsService } from './production-rooms.service';
import { ProductionRoomsController } from './production-rooms.controller';

@Module({
  controllers: [ProductionRoomsController],
  providers: [ProductionRoomsService],
  exports: [ProductionRoomsService],
})
export class ProductionRoomsModule {}
