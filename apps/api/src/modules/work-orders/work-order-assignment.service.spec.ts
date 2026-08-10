import { WorkLane, WorkOrderItemStatus, WorkOrderStatus } from '@prisma/client';
import { InventoryMovementService } from '../../common/inventory/inventory-movement.service';
import { WorkOrderAssignmentService } from './work-order-assignment.service';

describe('WorkOrderAssignmentService', () => {
  it('creates an active work item and keeps the LP in the trainer room order rack', async () => {
    const recordMovement = jest.fn().mockResolvedValue({ id: 'movement-1' });
    const movementService = {
      record: recordMovement,
    } as unknown as InventoryMovementService;
    const service = new WorkOrderAssignmentService(movementService);
    const createdItem = {
      id: 'item-1',
      lotId: 'lot-1',
      workOrderId: 'work-order-1',
      lane: WorkLane.IN_PROGRESS,
      status: WorkOrderItemStatus.IN_PROGRESS,
      workOrder: { id: 'work-order-1', workerId: 'worker-1' },
    };
    let createArgs:
      | {
          data: {
            workOrderId: string;
            lotId: string;
            status: WorkOrderItemStatus;
            lane: WorkLane;
            startedAt: Date | null;
            mitraOrderRequestLineId: string | null;
          };
        }
      | undefined;
    const createWorkOrderItem = jest.fn(
      (args: NonNullable<typeof createArgs>) => {
        createArgs = args;
        return Promise.resolve(createdItem);
      },
    );
    const tx = {
      workOrderItem: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: createWorkOrderItem,
      },
      worker: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'worker-1',
          name: 'Mitra Test',
          productionRoomId: null,
          trainer: { productionRoomId: 'room-1' },
        }),
      },
      productionRoom: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'room-1',
          code: 'RP1',
          name: 'Ruang Produksi 1',
        }),
      },
      productionLot: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'lot-1',
          locationId: 'pre-sale-location',
          productionRoomId: null,
        }),
        update: jest.fn().mockResolvedValue({ id: 'lot-1' }),
      },
      rackLocation: {
        upsert: jest.fn().mockResolvedValue({ id: 'order-location' }),
      },
      workerActiveWorkOrder: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'active-1' }),
      },
      workOrder: {
        create: jest.fn().mockResolvedValue({ id: 'work-order-1' }),
      },
    };

    const before = Date.now();
    const result = await service.assignLot(tx as never, {
      lotId: 'lot-1',
      workerId: 'worker-1',
      mitraOrderRequestLineId: 'line-1',
    });
    const after = Date.now();

    expect(result).toBe(createdItem);
    expect(tx.workOrder.create).toHaveBeenCalledWith({
      data: {
        workerId: 'worker-1',
        status: WorkOrderStatus.IN_PROGRESS,
      },
    });
    expect(tx.productionLot.update).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: {
        status: 'IN_PROGRESS',
        locationId: 'order-location',
        productionRoomId: 'room-1',
      },
    });
    expect(createWorkOrderItem).toHaveBeenCalledTimes(1);
    expect(createArgs).toBeDefined();
    if (!createArgs) throw new Error('Work order item was not created');
    expect(createArgs.data).toMatchObject({
      workOrderId: 'work-order-1',
      lotId: 'lot-1',
      status: WorkOrderItemStatus.IN_PROGRESS,
      lane: WorkLane.IN_PROGRESS,
      mitraOrderRequestLineId: 'line-1',
    });
    expect(createArgs.data.startedAt).toBeInstanceOf(Date);
    expect(createArgs.data.startedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(createArgs.data.startedAt!.getTime()).toBeLessThanOrEqual(after);
    expect(recordMovement).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        lotId: 'lot-1',
        fromLocationId: 'pre-sale-location',
        toLocationId: 'order-location',
      }),
    );
  });

  it('returns an existing assignment for the same worker without moving the LP again', async () => {
    const recordMovement = jest.fn();
    const movementService = {
      record: recordMovement,
    } as unknown as InventoryMovementService;
    const service = new WorkOrderAssignmentService(movementService);
    const existing = {
      id: 'item-1',
      lotId: 'lot-1',
      workOrder: { workerId: 'worker-1' },
    };
    const tx = {
      workOrderItem: {
        findUnique: jest.fn().mockResolvedValue(existing),
      },
    };

    await expect(
      service.assignLot(tx as never, {
        lotId: 'lot-1',
        workerId: 'worker-1',
      }),
    ).resolves.toBe(existing);
    expect(recordMovement).not.toHaveBeenCalled();
  });
});
