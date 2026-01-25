export const roundDryWeight = (wetWeightGram: number, moistureBps: number) =>
  Math.round((wetWeightGram * (10000 - moistureBps)) / 10000);

export const calcSusutProses = (dryInGram: number, mainOutGram: number) =>
  dryInGram - mainOutGram;

export const calcSusutHilang = (
  dryInGram: number,
  mainOutGram: number,
  byProductGram: number,
) => dryInGram - (mainOutGram + byProductGram);

export const toBps = (part: number, total: number) => {
  if (total <= 0) {
    return 0;
  }

  return Math.round((part / total) * 10000);
};
