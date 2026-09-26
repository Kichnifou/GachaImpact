import { SourceChannel, type Prisma } from '../../../generated/prisma/client.js';
import { getBusinessDayStartAt } from '../../domain/time/business-date.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import type { LegacyGlobalPlan } from './legacy-global-plan.js';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const monthStart = (year: number, month: number) => getBusinessDayStartAt(`${year}-${String(month).padStart(2, '0')}-01`);

export async function applyLegacyCodes(tx: Prisma.TransactionClient, snapshot: Snapshot, plan: LegacyGlobalPlan, batchId: string, cutoverAt: Date) {
  const source = object(snapshot.sources['gift_codes.json']);
  const catalog = Array.isArray(source.codes) ? source.codes : [];
  const byToken = new Map<string, { id: string; type: 'ANNUAL' | 'ONE_OFF'; month: number | null }>();
  let catalogCount = 0, claimCount = 0, archivedCount = 0;
  for (const raw of catalog) {
    const row = object(raw), token = String(row.code ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(token) || byToken.has(token) || row.annuallyRenewable !== true || !Number.isInteger(row.month) || Number(row.month) < 1 || Number(row.month) > 12)
      throw new Error('Invalid or duplicate legacy gift-code definition.');
    const rewards = object(row.rewards), particles = object(rewards.particles);
    const amounts = [ ['primogems', rewards.primogems], ['moras', rewards.moras], ...Object.entries(particles).map(([element, amount]) => [`particles_${element}`, amount]) ] as [string, unknown][];
    for (const [, amount] of amounts) if (!Number.isSafeInteger(amount) || Number(amount) < 0) throw new Error('Invalid legacy code reward.');
    const definition = { title: token, description: typeof row.message === 'string' ? row.message : '',
      type: 'ANNUAL' as const, status: 'PUBLISHED' as const, recurringMonth: Number(row.month),
      legacyProvenance: { source: 'gift_codes.json', batchId, snapshotHash: snapshot.hash } };
    const code = await tx.giftCode.upsert({ where: { token }, create: { token, ...definition }, update: definition });
    await tx.giftCodeReward.deleteMany({ where: { giftCodeId: code.id } });
    await tx.giftCodeReward.createMany({ data: amounts.filter(([, amount]) => Number(amount) > 0).map(([resourceKey, amount]) => ({ giftCodeId: code.id, resourceKey, amount: BigInt(Number(amount)) })) });
    byToken.set(token, { id: code.id, type: 'ANNUAL', month: Number(row.month) });
    catalogCount++;
  }
  const byName = new Map(plan.players.map(player => [normalizeLegacyName(player.legacyUsername), player.playerId]));
  const viewers = object(snapshot.sources['viewers_data.json']);
  const currentYear = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', year: 'numeric' }).format(cutoverAt));
  for (const [username, raw] of Object.entries(viewers)) {
    const playerId = byName.get(normalizeLegacyName(username));
    if (!playerId) continue;
    const used = object(raw).usedCodes;
    if (used != null && !Array.isArray(used)) throw new Error('Invalid legacy usedCodes list.');
    for (const rawKey of used as unknown[] ?? []) {
      if (typeof rawKey !== 'string') throw new Error('Invalid legacy code claim key.');
      const key = rawKey.trim().toUpperCase(), annual = /^(.*)-(\d{4})$/.exec(key);
      const token = annual?.[1] ?? key, year = annual ? Number(annual[2]) : null;
      if (!/^[A-Z0-9_-]+$/.test(token) || (year !== null && (year < 2000 || year > currentYear + 1))) throw new Error('Invalid legacy code claim key.');
      let code = byToken.get(token);
      if (!code) {
        const archived = { title: token, description: '', type: 'ONE_OFF' as const, status: 'DISABLED' as const,
          legacyProvenance: { source: 'viewers_data.json.usedCodes', batchId, archived: true, rewardUnknown: true } };
        const created = await tx.giftCode.upsert({ where: { token }, create: { token, ...archived }, update: archived });
        code = { id: created.id, type: 'ONE_OFF', month: null };
        byToken.set(token, code);
        archivedCount++;
      }
      if ((code.type === 'ANNUAL') !== (year !== null)) throw new Error('Legacy code claim edition conflicts with definition.');
      const editionKey = year === null ? 'once' : String(year);
      const startsAt = year !== null && code.month !== null ? monthStart(year, code.month) : null;
      const endsAt = year !== null && code.month !== null ? monthStart(code.month === 12 ? year + 1 : year, code.month === 12 ? 1 : code.month + 1) : null;
      const edition = await tx.giftCodeEdition.upsert({ where: { giftCodeId_editionKey: { giftCodeId: code.id, editionKey } },
        create: { giftCodeId: code.id, editionKey, year, startsAt, endsAt,
          legacyProvenance: { source: 'viewers_data.json.usedCodes', batchId, dateKnown: false } }, update: {} });
      await tx.giftCodeClaim.create({ data: { giftCodeEditionId: edition.id, playerId, sourceChannel: SourceChannel.MIGRATION,
        operationId: null, claimedAt: null, origin: 'LEGACY', legacyProvenance: { source: 'viewers_data.json.usedCodes', batchId, snapshotHash: snapshot.hash } } });
      claimCount++;
    }
  }
  // Current annual editions must remain claimable for players without a legacy claim.
  const currentMonth = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', month: 'numeric' }).format(cutoverAt));
  for (const code of byToken.values()) {
    if (code.type !== 'ANNUAL' || code.month !== currentMonth) continue;
    await tx.giftCodeEdition.upsert({ where: { giftCodeId_editionKey: { giftCodeId: code.id, editionKey: String(currentYear) } },
      create: { giftCodeId: code.id, editionKey: String(currentYear), year: currentYear,
        startsAt: monthStart(currentYear, currentMonth), endsAt: monthStart(currentMonth === 12 ? currentYear + 1 : currentYear, currentMonth === 12 ? 1 : currentMonth + 1) }, update: {} });
  }
  return { catalog: catalogCount, claims: claimCount, archived: archivedCount, operations: 0 };
}
