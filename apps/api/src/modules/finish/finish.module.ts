import { Module } from '@nestjs/common';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { FinishController } from './finish.controller';
import { FinishService } from './finish.service';

@Module({
  imports: [WorkOrdersModule],
  controllers: [FinishController],
  providers: [FinishService],
})
export class FinishModule {}
