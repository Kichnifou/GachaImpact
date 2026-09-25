export const lockedZMessage = 'Le rang Z sera accessible après accomplissement de toutes les missions des rangs B, A et S.'

export function progressPercent(progress: string, target: string): number {
  try {
    const safeTarget = BigInt(target)
    if (safeTarget <= 0n) return 100
    const safeProgress = BigInt(progress)
    if (safeProgress <= 0n) return 0
    if (safeProgress >= safeTarget) return 100
    return Number((safeProgress * 10_000n) / safeTarget) / 100
  } catch {
    return 0
  }
}
