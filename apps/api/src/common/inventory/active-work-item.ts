import { WorkOrderItemStatus } from '@prisma/client';

/**
 * Sebuah ProductionLot bisa punya beberapa WorkOrderItem: yang CANCELED
 * disimpan sebagai riwayat, dan maksimal satu yang aktif (dijaga partial
 * unique index `WorkOrderItem_lotId_active_key`).
 *
 * Dua helper di bawah dipakai supaya semua tempat yang dulunya menganggap
 * `lot.workItem` bernilai tunggal punya satu definisi "aktif" yang sama —
 * kalau tiap pemanggil bikin filter sendiri, gampang ada yang lupa
 * mengecualikan CANCELED dan lot yang sudah dibatalkan ikut terbaca lagi.
 */

/** Filter Prisma untuk item yang belum dibatalkan. */
export const ACTIVE_WORK_ITEM_WHERE = {
  status: { not: WorkOrderItemStatus.CANCELED },
} as const;

/** `include`/`select` siap pakai: ambil maksimal 1 item aktif dari sebuah lot. */
export const activeWorkItemsArg = <T>(nested?: T) =>
  ({
    where: ACTIVE_WORK_ITEM_WHERE,
    take: 1,
    ...(nested ?? {}),
  }) as { where: typeof ACTIVE_WORK_ITEM_WHERE; take: 1 } & T;

/** Ambil item aktif dari hasil query `workItems`. */
export function activeWorkItem<T extends { status: WorkOrderItemStatus }>(
  workItems: T[] | undefined | null,
): T | null {
  if (!workItems?.length) return null;
  return (
    workItems.find((item) => item.status !== WorkOrderItemStatus.CANCELED) ??
    null
  );
}
