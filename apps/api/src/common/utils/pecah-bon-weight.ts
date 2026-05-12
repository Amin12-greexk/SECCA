export const PECAH_BON_FINAL_REMAINING_MIN_GRAM = 35;
export const PECAH_BON_FINAL_SPLIT_TARGET_GRAM = 50;
export const PECAH_BON_FINAL_SPLIT_TOLERANCE_GRAM = 5;

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

export const isPecahBonFinalRemainingRange = (remainingWeightGram: number) => {
  const roundedRemaining = Math.round(remainingWeightGram);
  return (
    roundedRemaining >= PECAH_BON_FINAL_REMAINING_MIN_GRAM &&
    roundedRemaining <= PECAH_BON_FINAL_SPLIT_TARGET_GRAM
  );
};

export const isWithinPecahBonFinalSplitTolerance = (
  remainingWeightGram: number,
  requestedWeightGram: number,
) => {
  const deficit = roundToTwoDecimals(requestedWeightGram - remainingWeightGram);
  return (
    isPecahBonFinalRemainingRange(remainingWeightGram) &&
    Math.round(requestedWeightGram) === PECAH_BON_FINAL_SPLIT_TARGET_GRAM &&
    deficit > 0 &&
    deficit < PECAH_BON_FINAL_SPLIT_TOLERANCE_GRAM
  );
};

export const isAllowedPecahBonFinalSplit = (
  remainingWeightGram: number,
  requestedWeightGram: number,
) => {
  if (!isPecahBonFinalRemainingRange(remainingWeightGram)) {
    return true;
  }

  return (
    Math.round(requestedWeightGram) === Math.round(remainingWeightGram) ||
    isWithinPecahBonFinalSplitTolerance(
      remainingWeightGram,
      requestedWeightGram,
    )
  );
};

export const getRemainingAfterPecahBonConsumption = (
  remainingWeightGram: number,
  requestedWeightGram: number,
) => {
  if (requestedWeightGram <= remainingWeightGram) {
    return roundToTwoDecimals(remainingWeightGram - requestedWeightGram);
  }

  if (
    isWithinPecahBonFinalSplitTolerance(
      remainingWeightGram,
      requestedWeightGram,
    )
  ) {
    return 0;
  }

  return null;
};
