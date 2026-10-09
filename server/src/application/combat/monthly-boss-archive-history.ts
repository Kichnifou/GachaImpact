import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { calculateRoundedBossAverage } from '../../domain/combat/monthly-boss.js';
import { BusinessError } from '../errors.js';
import type { MonthlyBossRankingEntry } from './monthly-boss-service.js';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const amount = z.string().regex(/^\d{1,30}$/);
const instant = z.iso.datetime();
const contributionSchema = z.object({ totalDamage: amount, attackCount: amount, bestHit: amount,
  firstAttackAt: z.null(), lastAttackAt: z.null(), lastAttackDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), finalBlow: z.boolean(),
  reward: z.object({ distributed: z.boolean(), primogems: z.null(), moras: z.null(), awardedAt: z.null(), operationId: z.null() }).strict(),
}).strict();
const instanceSchema = z.object({ sourceBossKey: digest, month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), name: z.string().min(1).max(200),
  maxHp: amount, currentHp: amount, resistance: z.string(), defeated: z.boolean(), createdAt: instant, defeatedAt: instant.nullable(),
  rewardsDistributed: z.boolean(), totalDamage: amount, totalAttacks: amount, participantCount: z.number().int().nonnegative(), contribution: contributionSchema.nullable(),
}).strict();
const bindingSchema = z.object({ playerId: z.uuid(), twitchUserId: z.string().regex(/^[1-9]\d*$/), instances: z.array(instanceSchema).min(1) }).strict();
const journalSchema = z.object({ id: z.uuid(), sourceKey: digest, bindings: z.array(bindingSchema).min(1) }).strict();
type Instance = z.infer<typeof instanceSchema>;
type Binding = z.infer<typeof bindingSchema>;
type ProofEntry = Omit<Instance, 'contribution'> & { contributions: { playerId: string; twitchUserId: string; value: NonNullable<Instance['contribution']> }[] };

export type ArchiveContributions = Readonly<{ archiveId: string; page: number; pageSize: 10; total: number; totalPages: number; entries: readonly MonthlyBossRankingEntry[] }>;
export type TwitchBossHistoryEntry = Readonly<{
  id: string; origin: 'TWITCH_ARCHIVE'; monthStart: string; name: string; baseHp: null; maxHp: bigint; currentHp: bigint;
  resistanceElementKey: NonNullable<ReturnType<typeof archiveElement>>; status: 'DEFEATED' | 'INTERRUPTED'; defeatedAt: Date | null;
  finalBlowPlayer: { id: string; displayName: string } | null; victoryDayCount: null; daysRemainingAfterVictory: null; nextBaseAdjustment: null;
  historicalRewardsDistributed: boolean;
  community: { participantCount: number; attackCount: bigint; totalDamage: bigint; averageDamage: bigint };
  records: { topContributor: MonthlyBossRankingEntry | null; mostAttacks: MonthlyBossRankingEntry | null; topThree: readonly MonthlyBossRankingEntry[];
    biggestHit: { playerId: string; displayName: string; damage: bigint; createdAt: null } | null; finalBlow: { id: string; displayName: string } | null };
  contributions: ArchiveContributions;
}>;
type Archive = { entry: TwitchBossHistoryEntry; ranking: MonthlyBossRankingEntry[] };
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export class BossArchiveUnavailableError extends BusinessError {
  public constructor() { super('BOSS_INSTANCE_CHANGED', 'Les archives de Boss sont temporairement indisponibles.'); }
}
function invalid(): never { throw new BossArchiveUnavailableError(); }
function archiveElement(value: string) { return isElementKey(value) ? value : null; }
function publicId(key: string) { return 'twitch-' + createHash('sha256').update('monthly-boss-public-archive-v1:' + key).digest('hex'); }
const desc = (a: bigint, b: bigint) => a === b ? 0 : a > b ? -1 : 1;

function collectProofs(raw: unknown): ProofEntry[] {
  const parsed = z.array(journalSchema).safeParse(raw);
  if (!parsed.success) return invalid();
  const byInstance = new Map<string, ProofEntry>();
  const byJournalKey = new Map<string, Binding[]>();
  for (const journal of parsed.data) {
    const previous = byJournalKey.get(journal.sourceKey);
    if (previous && !same(previous, journal.bindings)) return invalid();
    byJournalKey.set(journal.sourceKey, journal.bindings);
    const players = new Set<string>(), twitchIds = new Set<string>();
    const scoped = new Map<string, ProofEntry>();
    for (const binding of journal.bindings) {
      if (players.has(binding.playerId) || twitchIds.has(binding.twitchUserId)) return invalid();
      players.add(binding.playerId); twitchIds.add(binding.twitchUserId);
      const keys = new Set<string>();
      for (const instance of binding.instances) {
        if (keys.has(instance.sourceBossKey)) return invalid();
        keys.add(instance.sourceBossKey);
        const { contribution, ...metadata } = instance;
        const existing = scoped.get(instance.sourceBossKey);
        if (existing) { const { contributions: _contributions, ...prior } = existing; if (!same(prior, metadata)) return invalid(); }
        const entry = existing ?? { ...metadata, contributions: [] };
        if (contribution) entry.contributions.push({ playerId: binding.playerId, twitchUserId: binding.twitchUserId, value: contribution });
        scoped.set(instance.sourceBossKey, entry);
      }
    }
    for (const entry of scoped.values()) {
      entry.contributions.sort((a, b) => a.playerId.localeCompare(b.playerId));
      const damage = entry.contributions.reduce((sum, row) => sum + BigInt(row.value.totalDamage), 0n);
      const attacks = entry.contributions.reduce((sum, row) => sum + BigInt(row.value.attackCount), 0n);
      if (!archiveElement(entry.resistance) || entry.contributions.length !== entry.participantCount || damage !== BigInt(entry.totalDamage)
        || attacks !== BigInt(entry.totalAttacks) || BigInt(entry.maxHp) - BigInt(entry.currentHp) !== damage
        || entry.defeated !== (BigInt(entry.currentHp) === 0n) || entry.defeated !== Boolean(entry.defeatedAt)
        || entry.rewardsDistributed && !entry.defeated || entry.contributions.filter(row => row.value.finalBlow).length !== (entry.defeated ? 1 : 0)
        || entry.contributions.some(row => row.value.reward.distributed !== entry.rewardsDistributed
          || BigInt(row.value.bestHit) > BigInt(row.value.totalDamage)
          || BigInt(row.value.bestHit) * BigInt(row.value.attackCount) < BigInt(row.value.totalDamage))) return invalid();
      const existing = byInstance.get(entry.sourceBossKey);
      if (existing && !same(existing, entry)) return invalid();
      byInstance.set(entry.sourceBossKey, entry);
    }
  }
  return [...byInstance.values()];
}

/** Only approved ledger projections cross the database boundary. No full summary,
 * source JSON, legacy login, source reward amount or import report is loaded. */
async function readArchives(database: Pick<PrismaClient, '$queryRaw' | 'player'>): Promise<Archive[]> {
  const raw = await database.$queryRaw<unknown[]>`
    SELECT id, summary->>'sourceKey' AS "sourceKey",
      (SELECT jsonb_agg(jsonb_build_object('playerId', binding->'playerId', 'twitchUserId', binding->'twitchUserId',
        'instances', (SELECT jsonb_agg(instance - 'finalBlowLegacyKey') FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(binding#>'{facts,instances}')='array' THEN binding#>'{facts,instances}' ELSE '[]'::jsonb END) instance)))
       FROM jsonb_array_elements(CASE WHEN jsonb_typeof(summary#>'{facts,bindings}')='array' THEN summary#>'{facts,bindings}' ELSE '[]'::jsonb END) binding) AS bindings
    FROM migration_batches WHERE migrator_version='r1063-shared-v1' AND status='COMPLETED' AND mode='CUTOVER'
      AND summary->>'kind'='BOSS_HISTORY' AND summary->>'state'='APPLIED' ORDER BY id`;
  const proofs = collectProofs(raw);
  if (!proofs.length) return [];
  const ids = [...new Set(proofs.flatMap(entry => entry.contributions.map(row => row.playerId)))];
  const players = await database.player.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true, status: true, twitchIdentity: { select: { twitchUserId: true } } } });
  const byId = new Map(players.map(player => [player.id, player]));
  return proofs.map(proof => {
    // A changed/missing binding is never reassigned to a new Player by name or
    // Twitch ID. Archived facts remain evidence but cannot enter the ranking.
    for (const row of proof.contributions) {
      const player = byId.get(row.playerId);
      if (!player || player.status !== 'ARCHIVED' && player.twitchIdentity?.twitchUserId !== row.twitchUserId) return invalid();
    }
    const ranking = proof.contributions.filter(row => byId.get(row.playerId)!.status !== 'ARCHIVED')
      .map(row => ({ rank: 0, playerId: row.playerId, displayName: byId.get(row.playerId)!.displayName,
        totalDamage: BigInt(row.value.totalDamage), attackCount: BigInt(row.value.attackCount), bestHit: BigInt(row.value.bestHit) }))
      .sort((a, b) => desc(a.totalDamage, b.totalDamage) || a.playerId.localeCompare(b.playerId))
      .map((row, index) => ({ ...row, rank: index + 1 }));
    const biggest = [...proof.contributions].sort((a, b) => desc(BigInt(a.value.bestHit), BigInt(b.value.bestHit)) || a.playerId.localeCompare(b.playerId))[0] ?? null;
    const biggestPlayer = biggest ? byId.get(biggest.playerId)! : null;
    const mostAttacks = [...ranking].sort((a, b) => desc(a.attackCount, b.attackCount) || desc(a.totalDamage, b.totalDamage) || a.playerId.localeCompare(b.playerId))[0] ?? null;
    const final = proof.contributions.find(row => row.value.finalBlow);
    const finalPlayer = final ? byId.get(final.playerId)! : null;
    const finalBlow = finalPlayer ? { id: finalPlayer.id, displayName: finalPlayer.status === 'ARCHIVED' ? 'Progression archivée' : finalPlayer.displayName } : null;
    const id = publicId(proof.sourceBossKey), totalDamage = BigInt(proof.totalDamage), attackCount = BigInt(proof.totalAttacks);
    const entry: TwitchBossHistoryEntry = { id, origin: 'TWITCH_ARCHIVE', monthStart: proof.month + '-01', name: proof.name,
      baseHp: null, maxHp: BigInt(proof.maxHp), currentHp: BigInt(proof.currentHp), resistanceElementKey: archiveElement(proof.resistance)!,
      status: proof.defeated ? 'DEFEATED' : 'INTERRUPTED', defeatedAt: proof.defeatedAt ? new Date(proof.defeatedAt) : null,
      finalBlowPlayer: finalBlow, victoryDayCount: null, daysRemainingAfterVictory: null, nextBaseAdjustment: null,
      historicalRewardsDistributed: proof.rewardsDistributed,
      community: { participantCount: proof.participantCount, totalDamage, attackCount, averageDamage: calculateRoundedBossAverage(totalDamage, attackCount) },
      records: { topContributor: ranking[0] ?? null, mostAttacks, topThree: ranking.slice(0, 3), finalBlow,
        biggestHit: biggest && biggestPlayer ? { playerId: biggest.playerId, displayName: biggestPlayer.status === 'ARCHIVED' ? 'Progression archivée' : biggestPlayer.displayName,
          damage: BigInt(biggest.value.bestHit), createdAt: null } : null },
      contributions: contributionPage(id, ranking, 1) };
    return { entry, ranking };
  });
}

function contributionPage(archiveId: string, ranking: MonthlyBossRankingEntry[], page: number): ArchiveContributions {
  if (!Number.isSafeInteger(page) || page < 1) throw new BusinessError('BOSS_INSTANCE_CHANGED', 'Cette page de contributions est invalide.');
  return { archiveId, page, pageSize: 10, total: ranking.length, totalPages: Math.max(1, Math.ceil(ranking.length / 10)), entries: ranking.slice((page - 1) * 10, page * 10) };
}

export async function readTwitchBossHistory(database: Pick<PrismaClient, '$queryRaw' | 'player'>): Promise<TwitchBossHistoryEntry[]> {
  return (await readArchives(database)).map(archive => archive.entry);
}
export async function readTwitchBossContributions(database: Pick<PrismaClient, '$queryRaw' | 'player'>, archiveId: string, page: number): Promise<ArchiveContributions> {
  if (!/^twitch-[a-f0-9]{64}$/.test(archiveId)) throw new BusinessError('BOSS_INSTANCE_CHANGED', 'Cette archive de Boss est introuvable.');
  const archive = (await readArchives(database)).find(item => item.entry.id === archiveId);
  if (!archive) throw new BusinessError('BOSS_INSTANCE_CHANGED', 'Cette archive de Boss est introuvable.');
  return contributionPage(archiveId, archive.ranking, page);
}
