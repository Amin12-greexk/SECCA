import { WorkLane, WorkOrderItemStatus } from '@prisma/client';
import {
  deriveWorkAttention,
  deriveWorkProcessState,
} from './work-order-board.utils';

describe('work-order board helpers', () => {
  const now = new Date('2026-07-28T12:00:00.000Z');

  it.each([
    [47 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000, 'NORMAL', 1],
    [48 * 60 * 60 * 1000, 'YELLOW', 2],
    [72 * 60 * 60 * 1000 - 1, 'YELLOW', 2],
    [72 * 60 * 60 * 1000, 'RED', 3],
  ] as const)(
    'classifies an in-progress LP aged %d ms as %s',
    (elapsedMs, expectedLevel, expectedDays) => {
      const startedAt = new Date(now.getTime() - elapsedMs);

      expect(deriveWorkAttention('IN_PROGRESS', startedAt, now)).toEqual({
        attentionLevel: expectedLevel,
        ageDays: expectedDays,
      });
    },
  );

  it('does not retain an age warning after production is ready to submit', () => {
    const startedAt = new Date(now.getTime() - 96 * 60 * 60 * 1000);

    expect(deriveWorkAttention('READY_TO_SUBMIT', startedAt, now)).toEqual({
      attentionLevel: 'NORMAL',
      ageDays: 0,
    });
  });

  it('uses only the lane to derive production and setoran states', () => {
    const baseItem = {
      status: WorkOrderItemStatus.IN_PROGRESS,
      lane: WorkLane.IN_PROGRESS,
    };

    expect(deriveWorkProcessState(baseItem)).toBe('IN_PROGRESS');
    expect(
      deriveWorkProcessState({
        ...baseItem,
        lane: WorkLane.READY_TO_SUBMIT,
      }),
    ).toBe('READY_TO_SUBMIT');
  });
});
