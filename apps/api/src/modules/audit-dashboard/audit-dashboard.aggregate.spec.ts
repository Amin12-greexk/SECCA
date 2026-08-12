import { aggregateMetrics, fallbackColor } from './audit-dashboard.service';

const row = (
  over: Partial<Parameters<typeof aggregateMetrics>[0][number]> = {},
) => ({
  hk: 6,
  totalBakuBasah: 100,
  totalBjd: 76,
  rendemenPctBps: 7600,
  susutProsesPctBps: 1200,
  susutHilangPctBps: 1200,
  ...over,
});

describe('aggregateMetrics', () => {
  it('sums totals and counts people', () => {
    const result = aggregateMetrics([
      row({ hk: 6, totalBakuBasah: 100, totalBjd: 76 }),
      row({ hk: 5, totalBakuBasah: 200, totalBjd: 150 }),
    ]);

    expect(result.totalPeople).toBe(2);
    expect(result.totalHk).toBe(11);
    expect(result.totalBakuBasah).toBe(300);
    expect(result.totalBjd).toBe(226);
  });

  it('weights rendemen by total, not by row average', () => {
    // Rata-rata baris = (7600+7500)/2 = 7550, tapi weighted = 226/300 = 7533.
    const result = aggregateMetrics([
      row({ totalBakuBasah: 100, totalBjd: 76, rendemenPctBps: 7600 }),
      row({ totalBakuBasah: 200, totalBjd: 150, rendemenPctBps: 7500 }),
    ]);

    expect(result.weightedRendemenPctBps).toBe(7533);
    expect(result.averageRendemenPctBps).toBe(7550);
  });

  it('returns null weighted rendemen when there is no baku basah', () => {
    const result = aggregateMetrics([
      row({ totalBakuBasah: null, totalBjd: null, rendemenPctBps: null }),
    ]);

    expect(result.weightedRendemenPctBps).toBeNull();
    expect(result.totalBakuBasah).toBe(0);
  });

  it('averages only rows that have a value', () => {
    const result = aggregateMetrics([
      row({ rendemenPctBps: 7600, susutProsesPctBps: 1200 }),
      row({ rendemenPctBps: null, susutProsesPctBps: 1400 }),
    ]);

    // null tidak dihitung sebagai 0.
    expect(result.averageRendemenPctBps).toBe(7600);
    expect(result.averageSusutProsesPctBps).toBe(1300);
  });

  it('returns null averages when every row is empty', () => {
    const result = aggregateMetrics([
      row({
        rendemenPctBps: null,
        susutProsesPctBps: null,
        susutHilangPctBps: null,
      }),
    ]);

    expect(result.averageRendemenPctBps).toBeNull();
    expect(result.averageSusutProsesPctBps).toBeNull();
    expect(result.averageSusutHilangPctBps).toBeNull();
  });

  it('handles an empty period without dividing by zero', () => {
    const result = aggregateMetrics([]);

    expect(result.totalPeople).toBe(0);
    expect(result.totalHk).toBe(0);
    expect(result.weightedRendemenPctBps).toBeNull();
    expect(result.averageRendemenPctBps).toBeNull();
  });

  it('weights susut proses by baku basah', () => {
    const result = aggregateMetrics([
      row({ totalBakuBasah: 100, totalBjd: 76, susutProsesPctBps: 1200 }),
      row({ totalBakuBasah: 200, totalBjd: 150, susutProsesPctBps: 1500 }),
    ]);

    // Weighted = (1200*100 + 1500*200) / 300 = 420000 / 300 = 1400
    expect(result.weightedSusutProsesPctBps).toBe(1400);
  });

  it('calculates weighted susut hilang as the remainder of 10000', () => {
    const result = aggregateMetrics([
      row({
        totalBakuBasah: 100,
        totalBjd: 76,
        rendemenPctBps: 7600,
        susutProsesPctBps: 1200,
      }),
      row({
        totalBakuBasah: 200,
        totalBjd: 150,
        rendemenPctBps: 7500,
        susutProsesPctBps: 1500,
      }),
    ]);

    // weightedRendemenPctBps = 226/300 * 10000 = 7533
    // weightedSusutProsesPctBps = 1400
    // weightedSusutHilangPctBps = 10000 - 7533 - 1400 = 1067
    expect(result.weightedSusutHilangPctBps).toBe(1067);
  });

  it('returns null for all weighted fields when totalBakuBasah is 0', () => {
    const result = aggregateMetrics([
      row({ totalBakuBasah: 0, totalBjd: 0, susutProsesPctBps: 1000 }),
    ]);

    expect(result.weightedRendemenPctBps).toBeNull();
    expect(result.weightedSusutProsesPctBps).toBeNull();
    expect(result.weightedSusutHilangPctBps).toBeNull();
  });

  it('ensures Rendemen + SP + SH = 10000 for realistic dataset', () => {
    const result = aggregateMetrics([
      row({ totalBakuBasah: 100, totalBjd: 76, susutProsesPctBps: 1200 }),
      row({ totalBakuBasah: 200, totalBjd: 150, susutProsesPctBps: 1500 }),
    ]);

    const sum =
      result.weightedRendemenPctBps! +
      result.weightedSusutProsesPctBps! +
      result.weightedSusutHilangPctBps!;

    expect(sum).toBe(10000);
  });
});

describe('fallbackColor', () => {
  it('is stable for the same person', () => {
    expect(fallbackColor('abc')).toBe(fallbackColor('abc'));
  });

  it('only ever returns colours from the validated palette', () => {
    const palette = [
      '#2a78d6',
      '#008300',
      '#e87ba4',
      '#eda100',
      '#1baf7a',
      '#eb6834',
      '#4a3aa7',
      '#e34948',
    ];
    for (let i = 0; i < 50; i += 1) {
      expect(palette).toContain(fallbackColor(`person-${i}`));
    }
  });
});
