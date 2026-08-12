import { Prisma, RackType } from '@prisma/client';
import { LOCATION_CODES } from '../constants';
import type { PrismaService } from '../../prisma/prisma.service';

type RackTx = Prisma.TransactionClient | PrismaService;
type CanonicalRackType = 'MITRA_ORDER' | 'FINISHED';

/** Return the single canonical rack for a production room and workflow state. */
export async function getProductionRoomRack(
  tx: RackTx,
  productionRoomId: string,
  type: CanonicalRackType,
) {
  const room = await tx.productionRoom.findUnique({
    where: { id: productionRoomId },
    select: { id: true, code: true, name: true },
  });
  if (!room) return null;

  const isFinished = type === RackType.FINISHED;
  const code = `${isFinished ? 'RAK_FINISHED' : 'RAK_MITRA_ORDER'}_${room.code}`;
  const name = `${isFinished ? 'Rak Finished' : 'Rak Mitra Order'} - ${room.name}`;

  return tx.rackLocation.upsert({
    where: { code },
    update: { name, type, productionRoomId: room.id, workerId: null },
    create: { code, name, type, productionRoomId: room.id },
  });
}

export async function getFallbackRack(
  tx: RackTx,
  type: CanonicalRackType,
  isMiniplant = false,
) {
  const code =
    type === RackType.MITRA_ORDER
      ? LOCATION_CODES.MITRA_ORDER
      : isMiniplant
        ? LOCATION_CODES.FINISHED_MINIPLANT
        : LOCATION_CODES.FINISHED;
  const name =
    type === RackType.MITRA_ORDER
      ? 'Rak Mitra Order'
      : isMiniplant
        ? 'Rak Finished Miniplant'
        : 'Rak Finished';

  return tx.rackLocation.upsert({
    where: { code },
    update: { name, type, workerId: null, productionRoomId: null },
    create: { code, name, type },
  });
}

export async function getWorkerProductionRoomId(tx: RackTx, workerId: string) {
  const worker = await tx.worker.findUnique({
    where: { id: workerId },
    select: {
      productionRoomId: true,
      trainer: { select: { productionRoomId: true } },
    },
  });

  // A mitra belongs to the trainer's room. Keep the worker-level room as a
  // legacy fallback for existing records that are not linked to a trainer.
  return worker?.trainer?.productionRoomId ?? worker?.productionRoomId ?? null;
}

export async function getWorkerOrderRack(tx: RackTx, workerId: string) {
  const productionRoomId = await getWorkerProductionRoomId(tx, workerId);
  return productionRoomId
    ? ((await getProductionRoomRack(
        tx,
        productionRoomId,
        RackType.MITRA_ORDER,
      )) ?? getFallbackRack(tx, RackType.MITRA_ORDER))
    : getFallbackRack(tx, RackType.MITRA_ORDER);
}

export async function getWorkerFinishedRack(tx: RackTx, workerId: string) {
  const worker = await tx.worker.findUnique({
    where: { id: workerId },
    select: {
      isMiniplant: true,
      productionRoomId: true,
      trainer: { select: { productionRoomId: true } },
    },
  });
  const productionRoomId =
    worker?.trainer?.productionRoomId ?? worker?.productionRoomId ?? null;

  return productionRoomId
    ? ((await getProductionRoomRack(tx, productionRoomId, RackType.FINISHED)) ??
        getFallbackRack(tx, RackType.FINISHED, worker?.isMiniplant ?? false))
    : getFallbackRack(tx, RackType.FINISHED, worker?.isMiniplant ?? false);
}
