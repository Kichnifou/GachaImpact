import type { Prisma } from '../../../generated/prisma/client.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import type { LegacyGlobalPlan } from './legacy-global-plan.js';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function count(value: unknown, label: string): bigint {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Invalid legacy Boss ${label}.`);
  return BigInt(Number(value));
}
function instant(value: unknown): Date | null {
  const parsed = parseLegacyParisInstant(value);
  if (parsed) return parsed;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const result = new Date(value);
    if (!Number.isNaN(result.getTime())) return result;
  }
  return null;
}
function day(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid present legacy Boss attack day.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid present legacy Boss attack day.');
  return parsed;
}

export async function applyLegacyBoss(tx: Prisma.TransactionClient, snapshot: Snapshot, plan: LegacyGlobalPlan, batchId: string) {
  validateLegacyBossSnapshot(snapshot);
  const source = object(snapshot.sources['monthly_boss.json']);
  const rawBosses = [...(Array.isArray(source.history) ? source.history : []), source.currentBoss].filter(Boolean);
  const byName = new Map(plan.players.map(player => [normalizeLegacyName(player.legacyUsername), player.playerId]));
  const cumulative = new Map<string, { damage: bigint; attacks: bigint; participated: bigint; rewarded: bigint; finalBlows: bigint; bestHit: bigint }>();
  const empty = () => ({ damage: 0n, attacks: 0n, participated: 0n, rewarded: 0n, finalBlows: 0n, bestHit: 0n });
  let bosses = 0, participants = 0, rewards = 0, excludedParticipants = 0;
  for (const raw of rawBosses) {
    const row = object(raw), month = String(row.month ?? '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid legacy Boss month.');
    const maxHp = count(row.maxHp, 'maxHp'), currentHp = count(row.currentHp, 'currentHp');
    const resistance = String(row.resistance ?? '').toLowerCase();
    if (!['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].includes(resistance) || currentHp > maxHp) throw new Error('Invalid legacy Boss state.');
    const createdAt = instant(row.createdAt), defeatedAt = row.defeated === true ? instant(row.defeatedAt) : null;
    // Combat.txt initializes a living Boss with defeatedAt = "" (no defeat occurred).
    if (!createdAt || (row.defeated === true && !defeatedAt) || (row.defeated !== true && row.defeatedAt != null && row.defeatedAt !== ''))
      throw new Error('Legacy Boss lifecycle timestamp is missing or invalid.');
    const variation = derivedLegacyBossVariation(maxHp);
    const finalBlowPlayerId = typeof row.finalBlowBy === 'string' ? byName.get(normalizeLegacyName(row.finalBlowBy)) ?? null : null;
    const boss = await tx.monthlyBoss.create({ data: { monthStart: new Date(`${month}-01T00:00:00.000Z`), nameSnapshot: String(row.name ?? ''),
      baseHp: 1_500_000n, hpVariationPercent: variation, maxHp, currentHp,
      resistanceElementKey: resistance, defeatedAt,
      finalBlowPlayerId, createdAt } });
    await tx.bossLegacyAggregate.create({ data: { bossId: boss.id, reportedTotalDamage: count(row.totalDamage, 'total damage'),
      reportedTotalAttacks: count(row.totalAttacks, 'total attacks'),
      globalStats: raw === source.currentBoss ? object(source.globalStats) as Prisma.InputJsonValue : undefined,
      batchId, legacyProvenance: { source: 'monthly_boss.json', month, totalsAreSourceReported: true,
        hpVariationPercentKnown: false, derivedHpVariationPercent: variation, maxHpSourceAuthoritative: true } } });
    bosses++;
    for (const [username, rawPart] of Object.entries(object(row.participants))) {
      const playerId = byName.get(normalizeLegacyName(username));
      if (!playerId) { excludedParticipants++; continue; }
      const part = object(rawPart), totalDamage = count(part.damage, 'participant damage'), attackCount = count(part.attacks, 'participant attacks'), bestHit = count(part.highestHit, 'participant best hit');
      const lastAttackDate = day(part.lastAttackDate);
      await tx.playerBossParticipation.create({ data: { bossId: boss.id, playerId, totalDamage, attackCount, bestHit,
        firstAttackAt: null, lastAttackAt: null } });
      await tx.bossLegacyContribution.create({ data: { bossId: boss.id, playerId, totalDamage, attackCount, bestHit,
        firstAttackAt: null, lastAttackAt: null, lastAttackDate, rewardKnown: row.rewardsDistributed === true ? true : null,
        batchId, legacyProvenance: { source: 'monthly_boss.json', month, firstAttackAtKnown: false, lastAttackDayKnown: lastAttackDate !== null } } });
      const totals = cumulative.get(playerId) ?? empty();
      totals.damage += totalDamage; totals.attacks += attackCount; totals.participated++; totals.bestHit = totals.bestHit > bestHit ? totals.bestHit : bestHit;
      if (finalBlowPlayerId === playerId) totals.finalBlows++;
      if (row.rewardsDistributed === true) {
        await tx.bossReward.create({ data: { bossId: boss.id, playerId, primogems: null, moras: null, operationId: null,
          awardedAt: null, origin: 'LEGACY', legacyProvenance: { source: 'monthly_boss.json', batchId, distributionKnown: true, amountsKnown: false } } });
        totals.rewarded++; rewards++;
      }
      cumulative.set(playerId, totals);
      participants++;
    }
  }
  let divergences = 0;
  for (const player of plan.players) {
    const stats = object(player.viewer.stats), known = cumulative.get(player.playerId) ?? empty();
    const viewerDamage = count(stats.totalBossDamage ?? 0, 'viewer damage');
    const viewerAttacks = count(stats.totalBossAttacks ?? 0, 'viewer attacks');
    const viewerParticipated = count(stats.bossesParticipated ?? 0, 'viewer participated');
    const viewerRewarded = count(stats.bossesDefeated ?? 0, 'viewer defeated');
    const viewerFinal = count(stats.totalBossFinalBlows ?? 0, 'viewer final blows');
    const viewerBest = count(stats.highestBossHit ?? 0, 'viewer best hit');
    if (viewerDamage !== known.damage || viewerAttacks !== known.attacks || viewerParticipated !== known.participated) {
      divergences++;
      await tx.migrationIssue.create({ data: { batchId, sourceName: 'monthly_boss.json', path: 'globalStats/participants',
        legacyKey: player.legacyUsername, playerId: player.playerId, domain: 'BOSS', severity: 'WARNING',
        issueCode: 'BOSS_CUMULATIVE_RECONCILED', description: 'Viewer totals differ from known monthly Boss contributions.',
        resolution: 'The certain maximum is retained for each counter.',
        details: { viewerDamage: viewerDamage.toString(), knownDamage: known.damage.toString(),
          viewerAttacks: viewerAttacks.toString(), knownAttacks: known.attacks.toString(),
          viewerParticipated: viewerParticipated.toString(), knownParticipated: known.participated.toString() } } });
    }
    const max = (a: bigint, b: bigint) => a > b ? a : b;
    await tx.playerBossStats.create({ data: { playerId: player.playerId, totalDamage: max(viewerDamage, known.damage),
      totalAttacks: max(viewerAttacks, known.attacks), totalParticipated: max(viewerParticipated, known.participated),
      totalRewarded: max(viewerRewarded, known.rewarded), finalBlows: max(viewerFinal, known.finalBlows), bestHit: max(viewerBest, known.bestHit) } });
  }
  return { bosses, participants, excludedParticipants, rewards, divergences, attacks: 0, operations: 0 };
}

/** Fail before any purge/import when a Boss cannot be represented by the existing contract. */
export function validateLegacyBossSnapshot(snapshot: Snapshot): void {
  const source = object(snapshot.sources['monthly_boss.json']);
  for (const raw of [...(Array.isArray(source.history) ? source.history : []), source.currentBoss].filter(Boolean)) {
    const row = object(raw);
    const maxHp = count(row.maxHp, 'maxHp');
    derivedLegacyBossVariation(maxHp);
  }
}

function derivedLegacyBossVariation(maxHp: bigint): number {
  // R435/R436: the legacy drew HP directly and rounded to 10,000, not an integer percentage.
  // This mandatory column is derived metadata only; maxHp is never reconstructed from it.
  const variation = Math.round((Number(maxHp) - 1_500_000) * 100 / 1_500_000);
  if (variation < -15 || variation > 15) throw new Error('Legacy Boss HP lies outside the supported variation range.');
  return variation;
}
