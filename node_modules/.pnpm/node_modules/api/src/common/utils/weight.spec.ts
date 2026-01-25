import {
  calcSusutHilang,
  calcSusutProses,
  roundDryWeight,
  toBps,
} from "./weight";

describe("weight utils", () => {
  it("rounds dry weight from wet weight and moisture", () => {
    expect(roundDryWeight(100, 1200)).toBe(88);
    expect(roundDryWeight(75, 1000)).toBe(68);
  });

  it("calculates susut values", () => {
    expect(calcSusutProses(88, 70)).toBe(18);
    expect(calcSusutHilang(88, 70, 10)).toBe(8);
  });

  it("converts to basis points", () => {
    expect(toBps(18, 88)).toBe(2045);
    expect(toBps(8, 88)).toBe(909);
  });
});
