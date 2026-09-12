import type { PrismaClient } from '../../../generated/prisma/client.js'

import type { JsonValue, MigrationTargetReader, StandaloneMigrationTarget } from './contracts.js'

/**
 * Read-only adapter for the current standalone projection. This class deliberately
 * receives no application service and declares no create/update/delete capability.
 */
export class PrismaMigrationTargetReader implements MigrationTargetReader {
  constructor(private readonly database: PrismaClient) {}

  async readTarget(targetPlayerId: string): Promise<StandaloneMigrationTarget | null> {
    const player = await this.database.player.findUnique({
      where: { id: targetPlayerId },
      include: {
        progression: true,
        resourceBalances: true,
        economyStats: true,
        bankAccount: true,
        gachaState: true,
        characters: { include: { character: true } },
        teams: { include: { members: { include: { character: true } } } },
        items: { include: { item: true } },
        dailyRewardState: true,
        wheelStats: true,
        wheelDailyStates: { orderBy: { businessDate: 'desc' }, take: 1 },
        dailyChallenges: { orderBy: { businessDate: 'desc' }, take: 1 },
        combatStats: true,
        characterCombatStats: { include: { character: true } },
        expedition: { include: { character: true } },
      },
    })
    if (!player) return null

    const resources = Object.fromEntries(player.resourceBalances.map((balance) => [balance.resourceKey, balance.amount.toString()]))
    if (player.economyStats) Object.assign(resources, {
      totalPrimosEarned: player.economyStats.totalPrimosEarned.toString(),
      totalPrimosSpent: player.economyStats.totalPrimosSpent.toString(),
      totalMorasEarned: player.economyStats.totalMorasEarned.toString(),
      totalMorasSpent: player.economyStats.totalMorasSpent.toString(),
      totalMainElementParticlesEarned: player.economyStats.totalMainElementParticlesEarned.toString(),
    })
    const latestWheel = player.wheelDailyStates[0]
    const latestChallenge = player.dailyChallenges[0]

    const domains: Record<string, JsonValue | null> = {
      progression: player.progression ? {
        xp: player.progression.xp.toString(), totalMessages: player.progression.totalMessages.toString(), countedMessages: player.progression.countedMessages.toString(),
      } : null,
      resources,
      bank: player.bankAccount ? { balance: player.bankAccount.balance.toString(), lastInterestDate: date(player.bankAccount.lastInterestDate) } : null,
      gacha: player.gachaState ? {
        pity5: String(player.gachaState.pity5), pity4: String(player.gachaState.pity4), guaranteedFeatured5: player.gachaState.guaranteedFeatured5,
        captureProgress: String(player.gachaState.captureProgress), fiftyFiftyLostStreak: String(player.gachaState.fiftyFiftyLostStreak),
        selectedBannerCharacter: player.gachaState.selectedBannerCharacterId, totalPulls: player.gachaState.totalPulls.toString(),
        totalFiveStars: player.gachaState.totalFiveStars.toString(), totalFourStars: player.gachaState.totalFourStars.toString(),
        fiftyFiftyWon: player.gachaState.fiftyFiftyWon.toString(), fiftyFiftyLost: player.gachaState.fiftyFiftyLost.toString(),
        capturesTriggered: player.gachaState.capturesTriggered.toString(),
      } : null,
      box: player.characters.map((owned) => ({ characterExternalKey: owned.character.externalKey, constellation: owned.constellation, copies: owned.copies, firstObtainedAt: owned.firstObtainedAt.toISOString(), favorite: owned.favorite })),
      teams: player.teams.map((team) => ({ position: team.displayPosition, name: team.name, active: team.isActive, base: team.isBaseSlot, legacySavedAt: date(team.legacySavedAt), members: team.members.sort((left, right) => left.position - right.position).map((member) => member.character.externalKey) })),
      items: Object.fromEntries(player.items.map((item) => [item.item.externalKey, item.quantity.toString()])),
      dailyReward: player.dailyRewardState ? { firstClaimDate: date(player.dailyRewardState.firstClaimDate), lastClaimDate: date(player.dailyRewardState.lastClaimDate), lastClaimedAt: date(player.dailyRewardState.lastClaimedAt) } : null,
      wheel: { totalSpins: player.wheelStats?.totalSpins.toString() ?? '0', totalJackpots: player.wheelStats?.totalJackpots.toString() ?? '0', lastWheelDate: latestWheel ? date(latestWheel.businessDate) : null },
      dailyChallenge: latestChallenge ? { businessDate: date(latestChallenge.businessDate), externalKey: latestChallenge.definitionExternalKeySnapshot, progress: latestChallenge.progress.toString(), status: latestChallenge.status } : null,
      combat: player.combatStats ? { totalCombatFights: player.combatStats.totalFights.toString(), totalCombatWins: player.combatStats.totalWins.toString(), totalCombatLosses: player.combatStats.totalLosses.toString(), totalManualCombatWins: player.combatStats.totalManualWins.toString(), characters: player.characterCombatStats.map((entry) => ({ characterExternalKey: entry.character.externalKey, wins: entry.wins.toString(), losses: entry.losses.toString() })) } : null,
      expedition: player.expedition ? { totalCompleted: player.expedition.totalCompleted.toString(), activeState: { state: player.expedition.state, characterExternalKey: player.expedition.character?.externalKey ?? null, departedAt: date(player.expedition.departedAt), readyAt: date(player.expedition.readyAt), departureBusinessDate: date(player.expedition.departureBusinessDate) } } : null,
    }

    return { playerId: player.id, displayName: player.displayName, legacyUsername: player.legacyUsername, elementKey: player.elementKey, domains }
  }
}

function date(value: Date | null): string | null { return value?.toISOString() ?? null }
