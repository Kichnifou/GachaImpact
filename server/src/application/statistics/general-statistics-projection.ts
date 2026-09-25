import type { PrismaClient } from '../../../generated/prisma/client.js';

// The profile owns access control; this projection only reads domain-owned counters.
// Percent is rounded to two decimal places with bigint arithmetic throughout.
export function fiveStarRate(totalFiveStars: bigint | null, totalPulls: bigint | null): string | null {
  if (totalFiveStars === null || totalPulls === null || totalPulls === 0n) return null;
  const hundredths = (totalFiveStars * 10000n + totalPulls / 2n) / totalPulls;
  return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, '0')}`;
}

const decimal = (value: bigint | undefined): string | null => value?.toString() ?? null;

export class GeneralStatisticsProjection {
  constructor(private readonly database: PrismaClient) {}

  async read(playerId: string) {
    const [progression, gacha, economy, combat, expedition, social, wheel] = await Promise.all([
      this.database.playerProgression.findUnique({ where: { playerId }, select: { xp: true, totalMessages: true, countedMessages: true } }),
      this.database.playerGachaState.findUnique({ where: { playerId }, select: { totalPulls: true, totalFiveStars: true, totalFourStars: true, fiftyFiftyWon: true, fiftyFiftyLost: true, capturesTriggered: true } }),
      this.database.playerEconomyStats.findUnique({ where: { playerId }, select: { totalPrimosEarned: true, totalPrimosSpent: true, totalMorasEarned: true, totalMorasSpent: true, totalMainElementParticlesEarned: true } }),
      this.database.playerCombatStats.findUnique({ where: { playerId }, select: { totalFights: true, totalWins: true, totalLosses: true, totalManualWins: true } }),
      this.database.playerExpedition.findUnique({ where: { playerId }, select: { totalCompleted: true } }),
      this.database.playerSocialStats.findUnique({ where: { playerId }, select: { totalFriendHeartsSent: true } }),
      this.database.playerWheelStats.findUnique({ where: { playerId }, select: { totalSpins: true, totalJackpots: true } }),
    ]);
    return {
      totalXp: decimal(progression?.xp), totalMessages: decimal(progression?.totalMessages), countedMessages: decimal(progression?.countedMessages),
      totalPulls: decimal(gacha?.totalPulls), totalFiveStars: decimal(gacha?.totalFiveStars), totalFourStars: decimal(gacha?.totalFourStars),
      fiftyFiftyWon: decimal(gacha?.fiftyFiftyWon), fiftyFiftyLost: decimal(gacha?.fiftyFiftyLost), capturesTriggered: decimal(gacha?.capturesTriggered),
      fiveStarRate: fiveStarRate(gacha?.totalFiveStars ?? null, gacha?.totalPulls ?? null),
      totalPrimosEarned: decimal(economy?.totalPrimosEarned), totalPrimosSpent: decimal(economy?.totalPrimosSpent),
      totalMorasEarned: decimal(economy?.totalMorasEarned), totalMorasSpent: decimal(economy?.totalMorasSpent),
      totalMainElementParticlesEarned: decimal(economy?.totalMainElementParticlesEarned),
      totalFights: decimal(combat?.totalFights), combatWins: decimal(combat?.totalWins), totalLosses: decimal(combat?.totalLosses), totalManualWins: decimal(combat?.totalManualWins),
      expeditionsCompleted: decimal(expedition?.totalCompleted), totalFriendHeartsSent: decimal(social?.totalFriendHeartsSent),
      totalSpins: decimal(wheel?.totalSpins), totalJackpots: decimal(wheel?.totalJackpots),
    };
  }
}
