import { Global, Module } from '@nestjs/common';
import { InventoryMovementService } from './inventory/inventory-movement.service';
import { NumberingService } from './numbering/numbering.service';

@Global()
@Module({
  providers: [InventoryMovementService, NumberingService],
  exports: [InventoryMovementService, NumberingService],
})
export class CommonModule {}
