/// <reference types="jest" />
import { WorkLane, WorkOrderItemStatus } from '@prisma/client';
import { InventoryMovementService } from '../../common/inventory/inventory-movement.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkItemsService } from './work-items.service';

describe('WorkItemsService', () => {
  it('moves a completed production item directly to setoran-ready', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'item-1',
      status: WorkOrderItemStatus.IN_PROGRESS,
      lane: WorkLane.IN_PROGRESS,
    });
    let readyAt: Date | undefined;
    const update = jest.fn(
      (args: {
        data: {
          readyAt: Date;
        };
      }) => {
        readyAt = args.data.readyAt;
        return Promise.resolve(args);
      },
    );
    const prisma = {
      workOrderItem: { findUnique, update },
    } as unknown as PrismaService;
    const movementService = {} as InventoryMovementService;
    const service = new WorkItemsService(prisma, movementService);

    await service.markReady('item-1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        lane: WorkLane.READY_TO_SUBMIT,
        readyAt,
        dryingStartedAt: null,
        dryingReadyAt: null,
        dryCheckedAt: null,
      },
    });
    expect(readyAt).toBeInstanceOf(Date);
  });
});
