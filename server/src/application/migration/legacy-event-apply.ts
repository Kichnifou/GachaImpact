import { Prisma, type Prisma as PrismaType } from '../../../generated/prisma/client.js';
import { createHash } from 'node:crypto';
import { getBusinessDate, getBusinessDayStartAt } from '../../domain/time/business-date.js';
import { generateEventGameAState } from '../../domain/event/game-a.js';
import { collectionItemExternalKey } from '../../domain/event/shop.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import { isIdentityQuarantined, isOwnerDiscarded, type LegacyGlobalPlan } from './legacy-global-plan.js';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
function number(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`Invalid legacy Event ${label}.`);
  return Number(value);
}
function editionWindow(year: number, month: number) {
  return { startsAt: getBusinessDayStartAt(`${year}-${String(month).padStart(2, '0')}-01`),
    endsAt: getBusinessDayStartAt(`${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`) };
}
function minute(value: unknown): number {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Invalid legacy Event Game A window time.');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function snapshotConfig(definition: { externalKey: string; displayName: string; calendarMonth: number; currencyKey: string; config: Prisma.JsonValue }) {
  return { externalKey: definition.externalKey, displayName: definition.displayName, calendarMonth: definition.calendarMonth,
    currencyKey: definition.currencyKey, config: definition.config } as Prisma.InputJsonValue;
}

export async function applyLegacyEvent(tx: PrismaType.TransactionClient, snapshot: Snapshot, plan: LegacyGlobalPlan, batchId: string, cutoverAt: Date) {
  const source = object(snapshot.sources['monthly_events_data.json']);
  const year = number(source.year, 'year'), month = number(source.month, 'month');
  if (year < 2000 || month < 1 || month > 12) throw new Error('Invalid legacy Event period.');
  const businessDate = getBusinessDate(cutoverAt), active = `${year}-${String(month).padStart(2, '0')}` === businessDate.slice(0, 7);
  const definition = await tx.eventDefinition.findUnique({ where: { calendarMonth: month } });
  if (!definition) throw new Error('Legacy Event definition is missing.');
  const byName = new Map(plan.players.map(player => [normalizeLegacyName(player.legacyUsername), player.playerId]));
  const nativeIds = new Set(plan.players.filter(player => player.personalImport === false).map(player => player.playerId));
  let editionId: string | null = null;
  if (active) {
    const editionData = { ...editionWindow(year, month), status: 'ACTIVE' as const, snapshot: snapshotConfig(definition) };
    const edition = await tx.eventEdition.upsert({ where: { eventDefinitionId_year: { eventDefinitionId: definition.id, year } },
      create: { eventDefinitionId: definition.id, year, ...editionData }, update: editionData });
    editionId = edition.id;
  }
  let participants = 0, balances = 0, milestoneClaims = 0, dailyStates = 0, gameB = 0, collection = 0, messages = 0, generatedWindows = 0;
  for (const [username, raw] of Object.entries(object(source.participants))) {
    const playerId = byName.get(normalizeLegacyName(username));
    if (!playerId || nativeIds.has(playerId)) continue;
    const row = object(raw), currency = number(row.currency, 'currency');
    await tx.playerEventCurrencyBalance.create({ data: { playerId, eventDefinitionId: definition.id, amount: BigInt(currency) } });
    balances++;
    if (!active || !editionId) continue;
    if (row.joined !== true) continue;
    const joinedAt = parseLegacyParisInstant(row.joinedAt);
    await tx.eventParticipant.create({ data: { eventEditionId: editionId, playerId, points: number(row.points, 'points'), joinedAt,
      legacyProvenance: { source: 'monthly_events_data.json.participants', batchId, joinedAtKnown: joinedAt !== null } } });
    participants++;
    const milestones = row.milestonesClaimed;
    if (milestones !== undefined && !Array.isArray(milestones)) throw new Error('Invalid legacy Event milestones.');
    for (const rawMilestone of milestones as unknown[] ?? []) {
      const milestone = number(rawMilestone, 'milestone');
      await tx.eventMilestoneClaim.create({ data: { eventEditionId: editionId, playerId, milestone, operationId: null,
        claimedAt: null, origin: 'LEGACY', legacyProvenance: { source: 'monthly_events_data.json.participants.milestonesClaimed', batchId } } });
      milestoneClaims++;
    }
    const today = object(object(row.daily)[businessDate]);
    if (Object.keys(today).length) {
      const windows = object(object(source.dailyWindows)[username])[businessDate];
      if (windows !== undefined && (!Array.isArray(windows) || windows.length !== 3)) throw new Error('Invalid legacy Event daily windows.');
      const nativeWindows = Array.isArray(windows)
        ? windows.map(rawWindow => ({ startMinute: minute(object(rawWindow).start), endMinute: minute(object(rawWindow).end) }))
        : generateEventGameAState({ nextInt: (max) => {
          const digest = createHash('sha256').update(`${snapshot.hash}:${playerId}:${businessDate}:${max}`).digest();
          return digest.readUInt32BE(0) % max;
        } }).gameA.windows;
      if (!Array.isArray(windows)) {
        generatedWindows++;
        await tx.migrationIssue.create({ data: { batchId, sourceName: 'monthly_events_data.json', path: 'dailyWindows.*.*',
          legacyKey: username, playerId, domain: 'EVENT', severity: 'INFO', issueCode: 'EVENT_GAME_A_WINDOWS_GENERATED',
          description: 'No legacy Game A windows existed for a player with current daily state.',
          resolution: 'V1 windows generated deterministically at cutover; existing daily claim retained.' } });
      }
      await tx.eventDailyPlayerState.create({ data: { eventEditionId: editionId, playerId, businessDate: new Date(`${businessDate}T00:00:00.000Z`),
        gameASuccess: today.gameASuccess === true, gameBAttemptsUsed: number(today.gameBAttempts ?? 0, 'Game B attempts'),
        gameCSent: today.gameCSent === true, dailyBonusClaimed: today.dailyEventCurrencyClaimed === true,
        state: { version: 1, gameA: { windows: nativeWindows }, migration: { source: 'monthly_events_data.json', batchId, sourceWindowsPresent: Array.isArray(windows) } } } });
      dailyStates++;
    }
  }
  if (active && editionId) {
    const today = object(object(source.gameB)[businessDate]);
    if (Object.keys(today).length && !isIdentityQuarantined(plan, today.foundBy) && !isOwnerDiscarded(plan, today.foundBy)) {
      const solutionCode = today.winningCode;
      if (typeof solutionCode !== 'string' || !Array.isArray(today.testedCodes)) throw new Error('Invalid legacy Event Game B state.');
      const discovererPlayerId = typeof today.foundBy === 'string' ? byName.get(normalizeLegacyName(today.foundBy)) ?? null : null;
      if (today.foundBy && !discovererPlayerId) throw new Error('Legacy Event Game B discoverer is outside the migrable population.');
      await tx.eventGameBDailyState.create({ data: { eventEditionId: editionId, businessDate: new Date(`${businessDate}T00:00:00.000Z`),
        solutionCode, solvedAt: null, legacyFound: today.found === true,
        legacyProvenance: { source: 'monthly_events_data.json.gameB', batchId, foundAtKnown: false },
        discovererPlayerId,
        testedCodes: today.testedCodes as Prisma.InputJsonValue } });
      gameB++;
    }
  }
  for (const [yearKey, buyers] of Object.entries(object(source.collectionPurchases))) {
    const collectionYear = Number(yearKey);
    if (!Number.isInteger(collectionYear) || collectionYear < 2000 || collectionYear > year) throw new Error('Invalid legacy Collection year.');
    for (const [username, rawItems] of Object.entries(object(buyers))) {
      const playerId = byName.get(normalizeLegacyName(username));
      if (!playerId || nativeIds.has(playerId)) continue;
      if (!Array.isArray(rawItems)) throw new Error('Invalid legacy Collection purchases.');
      for (const rawItem of rawItems) {
        if (typeof rawItem !== 'string') throw new Error('Invalid legacy Collection item.');
        const item = await tx.itemDefinition.findUnique({ where: { externalKey: rawItem } });
        if (!item) throw new Error('Legacy Collection item is absent from the V1 catalog.');
        const candidate = await tx.eventDefinition.findMany();
        const owner = candidate.find(row => {
          const config = object(row.config), collectionConfig = object(config.collection);
          try { return collectionItemExternalKey(String(collectionConfig.key)) === rawItem; } catch { return false; }
        });
        if (!owner) throw new Error('Legacy Collection item has no Event owner.');
        const existing = await tx.eventEdition.findUnique({ where: { eventDefinitionId_year: { eventDefinitionId: owner.id, year: collectionYear } } });
        const edition = existing ?? await tx.eventEdition.create({ data: { eventDefinitionId: owner.id, year: collectionYear,
          ...editionWindow(collectionYear, owner.calendarMonth), status: active && collectionYear === year && owner.id === definition.id ? 'ACTIVE' : 'FINISHED',
          snapshot: snapshotConfig(owner) } });
        await tx.eventCollectionAcquisition.create({ data: { eventEditionId: edition.id, playerId, itemId: item.id,
          itemAcquisitionId: null, operationId: null, acquiredAt: null, origin: 'LEGACY',
          legacyProvenance: { source: 'monthly_events_data.json.collectionPurchases', batchId, year: collectionYear } } });
        collection++;
      }
    }
  }
  if (active && editionId) {
    for (const [recipientName, rawMessages] of Object.entries(object(source.messages))) {
      const recipientPlayerId = byName.get(normalizeLegacyName(recipientName));
      if (!recipientPlayerId) continue;
      if (!Array.isArray(rawMessages)) throw new Error('Invalid legacy Event messages.');
      for (const raw of rawMessages) {
        const message = object(raw);
        if (message.read === true) continue;
        if (isIdentityQuarantined(plan, message.sender) || isOwnerDiscarded(plan, message.sender)) continue;
        const senderPlayerId = typeof message.sender === 'string' ? byName.get(normalizeLegacyName(message.sender)) : null;
        const createdAt = parseLegacyParisInstant(message.createdAt);
        if (!senderPlayerId || !createdAt || typeof message.text !== 'string') throw new Error('Undelivered legacy Event message cannot be mapped.');
        await tx.eventSocialMessage.create({ data: { eventEditionId: editionId, businessDate: new Date(`${getBusinessDate(createdAt)}T00:00:00.000Z`),
          senderPlayerId, recipientPlayerId, content: message.text, createdAt } });
        messages++;
      }
    }
  }
  return { mode: active ? 'ACTIVE' : 'STALE', participants, balances, milestoneClaims, dailyStates, gameB, collection, messages, generatedWindows, operations: 0 };
}
