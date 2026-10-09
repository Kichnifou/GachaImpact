import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getBusinessDate } from '../../domain/time/business-date.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { addLegacyBossContribution, emptyLegacyBossCumulative, reconcileLegacyBossCumulative, validateLegacyBossSnapshot } from './legacy-boss-apply.js';
import { normalizeLegacyName, resolveSnapshotViewer, type Snapshot } from './streamerbot-snapshot.js';

const natural = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const participantSchema = z.object({ damage: natural.positive(), attacks: natural.positive(), highestHit: natural.positive(), lastAttackDate: z.string() }).strict();
const bossSchema = z.object({ month, name: z.string().trim().min(1), maxHp: natural.positive(), currentHp: natural,
  resistance: z.enum(['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']), defeated: z.boolean(),
  createdAt: z.string(), defeatedAt: z.string().nullable(), finalBlowBy: z.string().nullable(),
  totalDamage: natural, totalAttacks: natural, rewardsDistributed: z.boolean(),
  participants: z.record(z.string(), participantSchema) }).strict();
const sourceSchema = z.object({ currentBoss: bossSchema, history: z.array(bossSchema), globalStats: z.object({
  totalBossesGenerated: natural, totalBossesDefeated: natural, totalDamage: natural, totalAttacks: natural,
  highestHit: natural, highestHitPlayer: z.string(),
}).strict() }).strict();
const viewerStatsSchema = z.object({ totalBossDamage: natural.optional(), totalBossAttacks: natural.optional(),
  bossesParticipated: natural.optional(), bossesDefeated: natural.optional(), totalBossFinalBlows: natural.optional(),
  highestBossHit: natural.optional(), lastBossParticipationMonth: z.union([month, z.literal('')]).optional(),
}).passthrough();
const fail = (reason: string): never => { throw new Error(`RECOVERY_BOSS_${reason}`); };
const decimal = (value: bigint) => value.toString();
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

function calendarDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail('SOURCE_DATE_INVALID');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return fail('SOURCE_DATE_INVALID');
  return value;
}

function instant(value: string): Date {
  const paris = parseLegacyParisInstant(value);
  if (paris) return paris;
  const match = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return fail('SOURCE_DATE_INVALID');
  calendarDay(match[1]!);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return fail('SOURCE_DATE_INVALID');
  return parsed;
}

function uniqueNames<T>(entries: [string, T][]): Map<string, T> {
  const names = new Map<string, T>();
  for (const [name, value] of entries) {
    const key = normalizeLegacyName(name);
    if (!key || names.has(key)) return fail('SOURCE_KEY_DUPLICATE');
    names.set(key, value);
  }
  return names;
}

/** A source-only ledger projection. The caller proves the immutable identity and
 * absent native preimage under its locks; this function never assigns a native Boss. */
export function recoveryBossFacts(snapshot: Snapshot, legacyName: string, importedAt: Date, now: Date) {
  if (snapshot.files !== 17 || !/^[a-f0-9]{64}$/.test(snapshot.hash) || typeof legacyName !== 'string' || !normalizeLegacyName(legacyName)
    || !Number.isFinite(importedAt.getTime()) || !Number.isFinite(now.getTime()) || importedAt > now) return fail('INPUT_INVALID');
  const parsed = sourceSchema.safeParse(snapshot.sources['monthly_boss.json']);
  if (!parsed.success) return fail('SOURCE_INVALID');
  validateLegacyBossSnapshot(snapshot);
  const source = parsed.data, legacyKey = normalizeLegacyName(legacyName);
  const viewers = record(snapshot.sources['viewers_data.json']);
  if (!viewers) return fail('VIEWER_INVALID');
  uniqueNames(Object.entries(viewers));
  const viewer = resolveSnapshotViewer(snapshot, legacyName).data;
  if (!viewerStatsSchema.safeParse(viewer.stats).success) return fail('VIEWER_STATS_INVALID');
  const importedDay = getBusinessDate(importedAt), today = getBusinessDate(now), months = new Set<string>();
  let known = emptyLegacyBossCumulative();
  let allDamage = 0n, allAttacks = 0n, allDefeated = 0, highestHit = 0n;
  const recordHolders = new Set<string>();
  const instances = [...source.history, source.currentBoss].map((boss, index) => {
    if (months.has(boss.month)) return fail('SOURCE_MONTH_DUPLICATE');
    months.add(boss.month);
    if (index < source.history.length && boss.month >= source.currentBoss.month) return fail('SOURCE_MONTH_ORDER');
    const createdAt = instant(boss.createdAt), defeatedAt = boss.defeated ? instant(boss.defeatedAt ?? '') : null;
    if (getBusinessDate(createdAt).slice(0, 7) !== boss.month || createdAt > importedAt || createdAt > now
      || boss.currentHp > boss.maxHp || boss.defeated !== (boss.currentHp === 0)
      || !boss.defeated && (boss.defeatedAt !== '' && boss.defeatedAt !== null || boss.finalBlowBy !== '' && boss.finalBlowBy !== null)
      || boss.rewardsDistributed && !boss.defeated
      || defeatedAt && (defeatedAt < createdAt || defeatedAt > importedAt || defeatedAt > now || getBusinessDate(defeatedAt).slice(0, 7) !== boss.month)) return fail('SOURCE_LIFECYCLE_INVALID');
    const participants = uniqueNames(Object.entries(boss.participants));
    const finalBlowLegacyKey = boss.finalBlowBy ? normalizeLegacyName(boss.finalBlowBy) : null;
    if (boss.defeated && (!finalBlowLegacyKey || !participants.has(finalBlowLegacyKey))) return fail('SOURCE_FINAL_BLOW_INVALID');
    let damage = 0n, attacks = 0n;
    for (const [name, row] of participants) {
      const lastDay = calendarDay(row.lastAttackDate);
      if (lastDay.slice(0, 7) !== boss.month || lastDay < getBusinessDate(createdAt)
        || defeatedAt && lastDay > getBusinessDate(defeatedAt) || lastDay > today
        || row.highestHit > row.damage || BigInt(row.highestHit) * BigInt(row.attacks) < BigInt(row.damage)) return fail('SOURCE_CONTRIBUTION_INVALID');
      damage += BigInt(row.damage); attacks += BigInt(row.attacks);
      if (BigInt(row.highestHit) > highestHit) { highestHit = BigInt(row.highestHit); recordHolders.clear(); }
      if (BigInt(row.highestHit) === highestHit) recordHolders.add(name);
    }
    if (damage !== BigInt(boss.totalDamage) || attacks !== BigInt(boss.totalAttacks)
      || damage !== BigInt(boss.maxHp) - BigInt(boss.currentHp)) return fail('SOURCE_TOTALS_INVALID');
    allDamage += damage; allAttacks += attacks; allDefeated += boss.defeated ? 1 : 0;
    const row = participants.get(legacyKey);
    if (row && (row.lastAttackDate >= importedDay || row.lastAttackDate >= today)) return fail('SOURCE_OVERLAP_UNPROVEN');
    if (row && boss.defeated && !boss.rewardsDistributed) return fail('SOURCE_REWARD_UNRESOLVED');
    if (row) known = addLegacyBossContribution(known, { totalDamage: BigInt(row.damage), attackCount: BigInt(row.attacks), bestHit: BigInt(row.highestHit),
      rewarded: boss.rewardsDistributed, finalBlow: finalBlowLegacyKey === legacyKey });
    return { sourceBossKey: createHash('sha256').update(JSON.stringify(['streamerbot-boss-v1', boss.month, createdAt.toISOString()])).digest('hex'),
      month: boss.month, name: boss.name, maxHp: String(boss.maxHp), currentHp: String(boss.currentHp), resistance: boss.resistance,
      defeated: boss.defeated, createdAt: createdAt.toISOString(), defeatedAt: defeatedAt?.toISOString() ?? null,
      finalBlowLegacyKey, rewardsDistributed: boss.rewardsDistributed, totalDamage: String(boss.totalDamage), totalAttacks: String(boss.totalAttacks),
      participantCount: participants.size, contribution: row ? { totalDamage: String(row.damage), attackCount: String(row.attacks), bestHit: String(row.highestHit),
        firstAttackAt: null, lastAttackAt: null, lastAttackDate: row.lastAttackDate, finalBlow: finalBlowLegacyKey === legacyKey,
        reward: { distributed: boss.rewardsDistributed, primogems: null, moras: null, awardedAt: null, operationId: null } } : null };
  }).sort((a, b) => a.month.localeCompare(b.month));
  const globals = source.globalStats;
  if (BigInt(globals.totalDamage) !== allDamage || BigInt(globals.totalAttacks) !== allAttacks || globals.totalBossesGenerated !== instances.length
    || globals.totalBossesDefeated !== allDefeated || BigInt(globals.highestHit) !== highestHit
    || highestHit > 0n && !recordHolders.has(normalizeLegacyName(globals.highestHitPlayer))
    || highestHit === 0n && globals.highestHitPlayer.trim() !== '') return fail('SOURCE_GLOBAL_TOTALS_INVALID');
  const { minimum, stats } = reconcileLegacyBossCumulative(viewer, known);
  const viewerMonth = (viewer.stats as Record<string, unknown>).lastBossParticipationMonth;
  if (typeof viewerMonth === 'string' && viewerMonth && (viewerMonth > importedDay.slice(0, 7) || viewerMonth > today.slice(0, 7)
    || minimum.attacks > 0n && viewerMonth >= importedDay.slice(0, 7) && !instances.some(boss => boss.month === viewerMonth && boss.contribution))) return fail('SOURCE_OVERLAP_UNPROVEN');
  const divergentCounters = (Object.keys(known) as (keyof typeof known)[]).filter(key => known[key] !== minimum[key]);
  const strings = (value: typeof known) => ({ damage: decimal(value.damage), attacks: decimal(value.attacks), participated: decimal(value.participated),
    rewarded: decimal(value.rewarded), finalBlows: decimal(value.finalBlows), bestHit: decimal(value.bestHit) });
  return { facts: { version: 1 as const, source: 'monthly_boss.json' as const, snapshotHash: snapshot.hash, legacyKey,
    scope: 'SOURCE_HISTORY_ONLY' as const, instances, globalStats: { ...globals }, viewerMinimum: strings(minimum), reconstructed: strings(known), divergentCounters },
  stats, counts: { bosses: instances.length, contributions: Number(known.participated), distributedRewards: Number(known.rewarded),
    finalBlows: Number(known.finalBlows), divergences: divergentCounters.length } };
}

export type RecoveryBossFacts = ReturnType<typeof recoveryBossFacts>;
