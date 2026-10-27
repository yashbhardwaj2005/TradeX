import { requireValue } from './errors.js';
export function safeMoney(value) {
  requireValue(
    Number.isSafeInteger(value) && value >= 0,
    422,
    'AMOUNT_OUT_OF_RANGE',
    'This amount is outside the supported range.',
  );
  return value;
}
export function allocatedCost(costBasis, soldQuantity, ownedQuantity) {
  if (soldQuantity === ownedQuantity) return costBasis;
  // BigInt avoids floating-point rounding in weighted-average cost allocation.
  const numerator = BigInt(costBasis) * BigInt(soldQuantity),
    denominator = BigInt(ownedQuantity);
  return Number((numerator + denominator / 2n) / denominator);
}
