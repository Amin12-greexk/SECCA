import { WorkLane, WorkOrderItemStatus } from '@prisma/client';

export type WorkProcessState =
  | 'NEXT_DAY'
  | 'IN_PROGRESS'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTED'
  | 'CANCELED';

export type WorkAttentionLevel = 'NORMAL' | 'YELLOW' | 'RED';

export function deriveWorkProcessState(item: {
  status: WorkOrderItemStatus;
  lane: WorkLane;
}): WorkProcessState {
  if (item.status === WorkOrderItemStatus.COMPLETED) return 'SUBMITTED';
  if (item.status === WorkOrderItemStatus.CANCELED) return 'CANCELED';
  if (item.lane === WorkLane.NEXT_DAY) return 'NEXT_DAY';
  if (item.lane === WorkLane.READY_TO_SUBMIT) return 'READY_TO_SUBMIT';
  return 'IN_PROGRESS';
}

export function deriveWorkAttention(
  processState: WorkProcessState,
  startedAt: Date | null,
  now = new Date(),
) {
  if (processState !== 'IN_PROGRESS' || !startedAt) {
    return { attentionLevel: 'NORMAL' as WorkAttentionLevel, ageDays: 0 };
  }

  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());
  const ageDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  const attentionLevel: WorkAttentionLevel =
    elapsedMs >= 72 * 60 * 60 * 1000
      ? 'RED'
      : elapsedMs >= 48 * 60 * 60 * 1000
        ? 'YELLOW'
        : 'NORMAL';

  return { attentionLevel, ageDays };
}
