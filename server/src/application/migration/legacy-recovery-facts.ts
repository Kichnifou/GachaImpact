import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import { getBusinessDate, getBusinessDayStartAt } from '../../domain/time/business-date.js';
import { communityHash } from './legacy-community-proof.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import type { PlannedPlayer } from './legacy-global-plan.js';
import { reconcileExternalBannerVotes } from '../gacha/banner-vote-contributions.js';
import { legacyBannerEvidence } from './legacy-banner-reconciliation.js';

type Tx = Prisma.TransactionClient;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function fail(reason: string): never { throw Error('LEGACY_RECOVERY_' + reason); }
const monthStart = (year: number, month: number) => getBusinessDayStartAt(`${year}-${String(month).padStart(2, '0')}-01`);

/** Secondary daily owners are safe only if the source proves no active session/current lock. */
export function assertRecoveryDailyFacts(snapshot: Snapshot, player: PlannedPlayer, at: Date) {
  const day = getBusinessDate(at), contest = record(snapshot.sources['contests_data.json']);
  if (record(contest.currentContest).status !== 'none') fail('CONTEST_ACTIVE');
  const locks = Object.entries(record(contest.dailyLocks)).filter(([name]) => normalizeLegacyName(name) === normalizeLegacyName(player.legacyUsername));
  for (const [, value] of locks) { const row = record(value);
    if (row.used === true && (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || row.date >= day)) fail('CONTEST_CURRENT_LOCK'); }
  const combat = record(snapshot.sources['combat_data.json']);
  // A stale global encounter cannot carry a current-day win into the new game.
  if (typeof combat.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(combat.date) || combat.date >= day) fail('COMBAT_CURRENT_ENCOUNTER');
  const personal = record(player.viewer.combat);
  for (const key of ['lastWinDate', 'lastFightDate']) if (personal[key] != null && personal[key] !== '' && (typeof personal[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(String(personal[key])) || String(personal[key]) >= day)) fail('COMBAT_CURRENT_LOCK');
  if (Object.keys(record(personal.lostCharacters)).some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= day)) fail('COMBAT_CURRENT_LOCK');
}

/** Claims only: never overwrite a code definition/reward, never create a payment. */
export async function restoreRecoveryCodeClaims(tx: Tx, snapshot: Snapshot, player: PlannedPlayer, batchId: string, at: Date) {
  const used = player.viewer.usedCodes;
  if (used != null && (!Array.isArray(used) || used.some(v => typeof v !== 'string'))) fail('CODE_CLAIMS_INVALID');
  const catalog = record(snapshot.sources['gift_codes.json']).codes;
  if (!Array.isArray(catalog)) fail('CODE_CATALOG_INVALID');
  const definitions = new Map(catalog.map(raw => { const row = record(raw); return [String(row.code).toUpperCase(), row] as const; }));
  const createdCodes: string[] = [], createdEditions: string[] = [], claimIds: string[] = [];
  const seen = new Set<string>();
  for (const raw of used as string[] ?? []) {
    const value = raw.trim().toUpperCase(), annual = /^(.*)-(\d{4})$/.exec(value), token = annual?.[1] ?? value, year = annual ? Number(annual[2]) : null;
    if (!/^[A-Z0-9_-]+$/.test(token) || seen.has(value) || year !== null && (year < 2000 || year > Number(getBusinessDate(at).slice(0, 4)) + 1)) fail('CODE_CLAIMS_INVALID');
    seen.add(value);
    const source = definitions.get(token), sourceAnnual = source?.annuallyRenewable === true;
    if (source && (!sourceAnnual || !Number.isInteger(source.month) || Number(source.month) < 1 || Number(source.month) > 12) || sourceAnnual !== (year !== null)) fail('CODE_EDITION_CONFLICT');
    let code = await tx.giftCode.findUnique({ where: { token } });
    if (!code) {
      if (source) fail('CODE_DEFINITION_MISSING'); // A published catalog needs its own operator plan.
      code = await tx.giftCode.create({ data: { token, title: token, description: '', type: 'ONE_OFF', status: 'DISABLED',
        legacyProvenance: { source: 'viewers_data.json.usedCodes', snapshotHash: snapshot.hash, batchId, rewardUnknown: true } } });
      createdCodes.push(code.id);
    }
    if (code.type !== (sourceAnnual ? 'ANNUAL' : 'ONE_OFF') || sourceAnnual && code.recurringMonth !== source!.month) fail('CODE_DEFINITION_CONFLICT');
    const editionKey = year === null ? 'once' : String(year);
    let edition = await tx.giftCodeEdition.findUnique({ where: { giftCodeId_editionKey: { giftCodeId: code.id, editionKey } } });
    if (!edition) {
      const month = code.recurringMonth;
      edition = await tx.giftCodeEdition.create({ data: { giftCodeId: code.id, editionKey, year,
        startsAt: year !== null && month ? monthStart(year, month) : null,
        endsAt: year !== null && month ? monthStart(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1) : null,
        legacyProvenance: { source: 'viewers_data.json.usedCodes', snapshotHash: snapshot.hash, batchId, dateKnown: false } } });
      createdEditions.push(edition.id);
    }
    if (await tx.giftCodeClaim.findUnique({ where: { giftCodeEditionId_playerId: { giftCodeEditionId: edition.id, playerId: player.playerId } } })) fail('CODE_CLAIM_ALREADY_PRESENT');
    const claim = await tx.giftCodeClaim.create({ data: { giftCodeEditionId: edition.id, playerId: player.playerId, sourceChannel: 'MIGRATION',
      operationId: null, claimedAt: null, origin: 'LEGACY', legacyProvenance: { source: 'viewers_data.json.usedCodes', snapshotHash: snapshot.hash, batchId } } });
    claimIds.push(claim.giftCodeEditionId);
  }
  if (await tx.giftCodeClaim.count({ where: { playerId: player.playerId } }) !== seen.size) fail('CODE_COMPARE_FAILED');
  return { createdCodes, createdEditions, claimIds };
}

export async function restoreRecoveryTarget(tx: Tx, snapshot: Snapshot, player: PlannedPlayer, at: Date) {
  const raw = player.viewer.selectedBannerCharacterId;
  if (raw == null) return null;
  if (!Number.isSafeInteger(raw)) fail('BANNER_TARGET_INVALID');
  const current = await tx.bannerRotation.findFirst({ where: { status: 'ACTIVE', startsAt: { lte: at }, endsAt: { gt: at }, supersededAt: null }, include: { featuredCharacters: { include: { character: true } } } });
  if (!current) fail('CURRENT_BANNER_REQUIRED');
  const source = record(snapshot.sources['genshin_characters.json']);
  const sourceWeek = source.lastBannerUpdate;
  // Retaining a source target requires the official restored source cycle. Once
  // that cycle expires the normal rule clears stale targets, never invents one.
  if (typeof sourceWeek !== 'string' || current.startsAt.getTime() !== getBusinessDayStartAt(sourceWeek).getTime()) return null;
  const provenance = record(current.legacyProvenance);
  const evidence = legacyBannerEvidence(snapshot, await tx.character.findMany());
  const signature = (rows: { id: string; rarity: number }[]) => rows.map(c => `${c.rarity}:${c.id}`).sort().join('|');
  if (provenance.source !== 'genshin_characters.json' || provenance.snapshotHash !== snapshot.hash
    || current.endsAt.getTime() !== evidence.endsAt.getTime()
    || signature(evidence.featured) !== signature(current.featuredCharacters.map(c => ({ id: c.characterId, rarity: c.rarity })))) fail('LEGACY_BANNER_NOT_RESTORED');
  const target = current.featuredCharacters.find(c => c.rarity === 5 && c.character.externalKey === `legacy:${raw}`)?.characterId ?? null;
  if (target) await tx.playerGachaState.update({ where: { playerId: player.playerId }, data: { selectedBannerCharacterId: target } });
  return target;
}

export async function recoveryExternalRows(db: PrismaClient | Tx, twitchUserId: string) {
  return (await db.$queryRaw<{ row: string }[]>`SELECT row_to_json(t)::text AS row FROM external_banner_votes t WHERE twitch_user_id=${twitchUserId} ORDER BY id`).map(r => r.row);
}

export async function restoreRecoveryExternalRows(tx: Tx, twitchUserId: string, before: string[]) {
  const current = await recoveryExternalRows(tx, twitchUserId);
  if (current.length !== before.length) fail('VOTE_COMPENSATION_DRIFT');
  for (const raw of before) { const row = JSON.parse(raw);
    await tx.externalBannerVote.update({ where: { id: row.id }, data: { playerId: row.player_id, bindingHistory: row.binding_history } });
  }
  if (communityHash(await recoveryExternalRows(tx, twitchUserId)) !== communityHash(before)) fail('VOTE_COMPENSATION_DRIFT');
}

export async function recoverySupplementPostimage(tx: Tx, playerId: string, twitchUserId: string, created: { createdCodes: string[]; createdEditions: string[] }) {
  const claims = (await tx.$queryRaw<{ row: string }[]>`SELECT row_to_json(t)::text AS row FROM gift_code_claims t WHERE player_id=${playerId}::uuid ORDER BY gift_code_edition_id`).map(r => r.row);
  const codes = await tx.giftCode.findMany({ where: { id: { in: created.createdCodes } }, orderBy: { id: 'asc' } });
  const editions = await tx.giftCodeEdition.findMany({ where: { id: { in: created.createdEditions } }, orderBy: { id: 'asc' } });
  return { claims, codes, editions, externalVotes: await recoveryExternalRows(tx, twitchUserId) };
}

export { reconcileExternalBannerVotes };
