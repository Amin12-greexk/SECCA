import {
  getRemainingAfterPecahBonConsumption,
  isAllowedPecahBonFinalSplit,
  isWithinPecahBonFinalSplitTolerance,
} from './pecah-bon-weight';

describe('pecah bon weight utils', () => {
  it('allows splitting 49 grams into a 50 gram final lot', () => {
    expect(isWithinPecahBonFinalSplitTolerance(49, 50)).toBe(true);
    expect(isAllowedPecahBonFinalSplit(49, 50)).toBe(true);
    expect(getRemainingAfterPecahBonConsumption(49, 50)).toBe(0);
  });

  it('rejects splitting 45 grams into a 50 gram final lot', () => {
    expect(isWithinPecahBonFinalSplitTolerance(45, 50)).toBe(false);
    expect(isAllowedPecahBonFinalSplit(45, 50)).toBe(false);
    expect(getRemainingAfterPecahBonConsumption(45, 50)).toBeNull();
  });

  it('still allows exact final remaining splits', () => {
    expect(isAllowedPecahBonFinalSplit(45, 45)).toBe(true);
    expect(getRemainingAfterPecahBonConsumption(45, 45)).toBe(0);
  });

  it('rejects non-target split weights while in the final remaining range', () => {
    expect(isAllowedPecahBonFinalSplit(49, 48)).toBe(false);
    expect(getRemainingAfterPecahBonConsumption(49, 48)).toBe(1);
  });
});
