export const roundDryWeight = (wetWeightGram: number, moistureBps: number) =>
  Math.round((wetWeightGram * (10000 - moistureBps)) / 10000);

export const calcSusutProses = (byProductGram: number) => byProductGram;

export const calcSusutHilang = (
  dryInGram: number,
  mainOutGram: number,
  byProductGram: number,
) => dryInGram - (mainOutGram + byProductGram);

export const calcRendemenMainBps = (dryInGram: number, mainOutGram: number) =>
  toBps(mainOutGram, dryInGram);

export const calcRendemenNetBps = (
  dryInGram: number,
  mainOutGram: number,
  byProductGram: number,
) => toBps(mainOutGram + byProductGram, dryInGram);

export const toBps = (part: number, total: number) => {
  if (total <= 0) {
    return 0;
  }

  return Math.round((part / total) * 10000);
};
