export function fiveStarChanceBasisPoints(attempt: number): number {
  if (attempt >= 90) return 10_000
  if (attempt <= 73) return 60
  return 60 + (attempt - 73) * 600
}

export function fourStarChanceBasisPoints(attempt: number): number {
  if (attempt >= 10) return 10_000
  return attempt === 9 ? 1_950 : 150
}

export function probabilityPercent(basisPoints: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(basisPoints / 100) + ' %'
}

export const fiveStarProbabilityRows = [
  { pity: '1–73', chance: fiveStarChanceBasisPoints(1) },
  ...Array.from({ length: 17 }, (_, index) => {
    const pity = index + 74
    return { pity: String(pity), chance: fiveStarChanceBasisPoints(pity) }
  }),
]

export const fourStarProbabilityRows = [
  { pity: '1–8', chance: fourStarChanceBasisPoints(1) },
  { pity: '9', chance: fourStarChanceBasisPoints(9) },
  { pity: '10', chance: fourStarChanceBasisPoints(10) },
]
