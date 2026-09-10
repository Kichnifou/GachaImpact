export const FIVE_STAR_HARD_PITY = 90;

export function applyFiveStarPityBonus(current: number, bonus: number): number {
  if (!Number.isInteger(current) || current < 0 || current > FIVE_STAR_HARD_PITY) {
    throw new RangeError('The current five-star pity is invalid.');
  }
  if (!Number.isInteger(bonus) || bonus <= 0) {
    throw new RangeError('A five-star pity bonus must be a positive integer.');
  }
  return Math.min(current + bonus, FIVE_STAR_HARD_PITY);
}
