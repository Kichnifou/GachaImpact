import { createHash } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { identityProofHash } from './owner-approved-population.js';
import { normalizeLegacyName, type Snapshot } from './streamerbot-snapshot.js';
import { validateVerifiedTwitchReport, type VerifiedTwitchReport } from './verified-twitch-report.js';

type Tx = Prisma.TransactionClient;
type SourceFact = { leftSourceKeyHash: string; rightSourceKeyHash: string; level: number; totalHearts: bigint; becameFriendsAt: Date | null;
  leftLastHeartSentDate: Date | null; rightLastHeartSentDate: Date | null; sourcePairKeyHash: string; sourceFingerprint: string };
type RegistrationInput = { snapshot: Snapshot; report: VerifiedTwitchReport; ownerTwitchUserId: string; now: Date; sourcePairKeyHash?: string };
type StoredFact = Prisma.LegacyFriendshipFactGetPayload<Record<string, never>>;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceKey = (name: string) => hash(['legacy-friendship-identity-v1', normalizeLegacyName(name)]);
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const pair = (left: string, right: string) => { const ids = [left, right].sort(); return { playerAId: ids[0]!, playerBId: ids[1]! }; };
const fail = (reason: string): never => { throw new Error(`LEGACY_FRIENDSHIP_${reason}`); };
function knownDate(value: unknown, daily: boolean): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return fail('SOURCE_DATE_INVALID');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const result = businessDateToDatabaseDate(value);
    if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value) return fail('SOURCE_DATE_INVALID');
    return result;
  }
  const instant = parseLegacyParisInstant(value) ?? new Date(value);
  if (Number.isNaN(instant.getTime())) return fail('SOURCE_DATE_INVALID');
  return daily ? businessDateToDatabaseDate(getBusinessDate(instant)) : instant;
}

/** Pure source projection: names only bind keys inside the validated source, never a live Player. */
export function legacyFriendshipSourceFacts(snapshot: Snapshot, ownerLegacyLogin: string) {
  const owner = normalizeLegacyName(ownerLegacyLogin), facts: SourceFact[] = [];
  for (const raw of Object.values(object(object(snapshot.sources['friendships_data.json']).friendships))) {
    const row = object(raw);
    if (!Array.isArray(row.users) || row.users.length !== 2 || row.users.some(name => typeof name !== 'string')) return fail('SOURCE_PAIR_INVALID');
    const names = (row.users as string[]).map(normalizeLegacyName).sort();
    if (names[0] === names[1]) return fail('SOURCE_PAIR_INVALID');
    if (!names.includes(owner)) continue;
    if (!Number.isSafeInteger(row.level) || Number(row.level) < 1 || Number(row.level) > 1000 || !Number.isSafeInteger(row.sparkleHearts) || Number(row.sparkleHearts) < 0) return fail('SOURCE_AGGREGATE_INVALID');
    const dates = new Map<string, Date | null>();
    for (const [name, date] of Object.entries(object(row.lastHeartSent))) {
      const key = normalizeLegacyName(name);
      if (!names.includes(key) || dates.has(key)) return fail('SOURCE_DIRECTION_INVALID');
      dates.set(key, knownDate(date, true));
    }
    const content = {
      leftSourceKeyHash: sourceKey(names[0]!), rightSourceKeyHash: sourceKey(names[1]!),
      level: Number(row.level), totalHearts: BigInt(Number(row.sparkleHearts)), becameFriendsAt: knownDate(row.createdAt, false),
      leftLastHeartSentDate: dates.get(names[0]!) ?? null, rightLastHeartSentDate: dates.get(names[1]!) ?? null,
    };
    const sourcePairKeyHash = hash(['legacy-friendship-pair-v1', content.leftSourceKeyHash, content.rightSourceKeyHash]);
    const sourceFingerprint = hash({ ...content, totalHearts: content.totalHearts.toString() });
    if (facts.some(fact => fact.sourcePairKeyHash === sourcePairKeyHash)) return fail('SOURCE_PAIR_DUPLICATE');
    facts.push({ ...content, sourcePairKeyHash, sourceFingerprint });
  }
  return facts;
}

function validatedRegistration(input: RegistrationInput) {
  const owner = input.report.users.find(row => row.twitchUserId === input.ownerTwitchUserId);
  if (!owner) return fail('OWNER_PROOF_REQUIRED');
  const report = validateVerifiedTwitchReport(input.report, input.snapshot, input.now, { kind: 'CANARY', legacyLogin: owner.legacyLogin });
  if (report.conflicts.length || report.duplicates) return fail('IDENTITY_CONFLICT');
  const proof = identityProofHash(report), provenKey = sourceKey(owner.legacyLogin);
  const facts = legacyFriendshipSourceFacts(input.snapshot, owner.legacyLogin).filter(fact => !input.sourcePairKeyHash || fact.sourcePairKeyHash === input.sourcePairKeyHash);
  if (input.sourcePairKeyHash && facts.length !== 1) return fail('SOURCE_PAIR_SCOPE_INVALID');
  return { owner, proof, provenKey, facts };
}
function proofUpdate(fact: SourceFact, found: StoredFact | null, provenKey: string, twitchUserId: string, proof: string) {
  if (found) validateStoredFact(found);
  if (found && found.sourceFingerprint !== fact.sourceFingerprint || found?.status === 'BLOCKED') return fail('SOURCE_CONFLICT');
  const left = fact.leftSourceKeyHash === provenKey;
  if (!left && fact.rightSourceKeyHash !== provenKey) return fail('IDENTITY_CONFLICT');
  const previousId = left ? found?.leftTwitchUserId : found?.rightTwitchUserId;
  if (previousId && previousId !== twitchUserId) return fail('IDENTITY_CONFLICT');
  const data = left ? { leftTwitchUserId: twitchUserId, leftProofHash: proof } : { rightTwitchUserId: twitchUserId, rightProofHash: proof };
  return { data, changed: !previousId };
}

function validateStoredFact(fact: StoredFact) {
  const fingerprint = hash({ leftSourceKeyHash: fact.leftSourceKeyHash, rightSourceKeyHash: fact.rightSourceKeyHash, level: fact.level,
    totalHearts: fact.totalHearts.toString(), becameFriendsAt: fact.becameFriendsAt, leftLastHeartSentDate: fact.leftLastHeartSentDate, rightLastHeartSentDate: fact.rightLastHeartSentDate });
  if (fact.sourceFingerprint !== fingerprint || fact.sourcePairKeyHash !== hash(['legacy-friendship-pair-v1', fact.leftSourceKeyHash, fact.rightSourceKeyHash])) return fail('SOURCE_PROVENANCE_INVALID');
}

/** Register only report-proven immutable IDs. A CANARY report never guesses its peers. */
export async function registerLegacyFriendships(tx: Tx, input: RegistrationInput) {
  const { owner, proof, provenKey, facts } = validatedRegistration(input);
  for (const fact of facts) {
    const found = await tx.legacyFriendshipFact.findUnique({ where: { sourcePairKeyHash: fact.sourcePairKeyHash } });
    const update = proofUpdate(fact, found, provenKey, owner.twitchUserId, proof);
    if (!found) await tx.legacyFriendshipFact.create({ data: { ...fact, sourceSnapshotHash: input.snapshot.hash, ...update.data } });
    else if (update.changed) await tx.legacyFriendshipFact.update({ where: { id: found.id }, data: update.data });
  }
  return { registered: facts.length };
}

function relevant(twitchUserIds?: readonly string[]): Prisma.LegacyFriendshipFactWhereInput {
  return twitchUserIds ? { OR: [{ leftTwitchUserId: { in: [...twitchUserIds] } }, { rightTwitchUserId: { in: [...twitchUserIds] } }] } : {};
}
async function factsFor(tx: Tx, twitchUserIds?: readonly string[], sourcePairKeyHashes?: readonly string[]) {
  const facts = await tx.legacyFriendshipFact.findMany({ where: { ...relevant(twitchUserIds), ...(sourcePairKeyHashes ? { sourcePairKeyHash: { in: [...sourcePairKeyHashes] } } : {}) }, orderBy: { sourcePairKeyHash: 'asc' } });
  facts.forEach(validateStoredFact);
  return facts;
}

/** Called before sorted Player row locks. No player is inferred from a display name. */
export async function legacyFriendshipAffectedPlayers(tx: Tx, twitchUserIds: readonly string[]) {
  const facts = await factsFor(tx, twitchUserIds), ids = facts.flatMap(f => [f.leftTwitchUserId, f.rightTwitchUserId]).filter((id): id is string => id !== null);
  const [identities, versions] = await Promise.all([
    tx.twitchIdentity.findMany({ where: { twitchUserId: { in: ids } }, select: { playerId: true } }),
    tx.friendship.findMany({ where: { legacyFactId: { in: facts.map(f => f.id) } }, select: { playerAId: true, playerBId: true } }),
  ]);
  return [...new Set([...identities.map(i => i.playerId), ...versions.flatMap(v => [v.playerAId, v.playerBId])])].sort();
}

/** Full private inputs, for the caller's opaque consent fingerprint; never a public DTO. */
export async function legacyFriendshipDecisionEvidence(tx: Tx, twitchUserIds: readonly string[]) {
  const facts = await factsFor(tx, twitchUserIds), players = await legacyFriendshipAffectedPlayers(tx, twitchUserIds);
  const involvedIds = [...new Set(facts.flatMap(fact => [fact.leftTwitchUserId, fact.rightTwitchUserId]).filter((id): id is string => id !== null))];
  const [identities, friendships, blocks] = await Promise.all([
    tx.twitchIdentity.findMany({ where: { playerId: { in: players } }, orderBy: { twitchUserId: 'asc' } }),
    tx.friendship.findMany({ where: { OR: [{ legacyFactId: { in: facts.map(f => f.id) } }, { playerAId: { in: players }, playerBId: { in: players } }] }, include: { hearts: { orderBy: { id: 'asc' } }, legacyHeartStates: { orderBy: { senderPlayerId: 'asc' } } }, orderBy: { id: 'asc' } }),
    tx.playerBlock.findMany({ where: { OR: [{ blockerPlayerId: { in: players } }, { blockedPlayerId: { in: players } }] }, orderBy: [{ blockerPlayerId: 'asc' }, { blockedPlayerId: 'asc' }] }),
  ]);
  return { facts, identities, friendships, blocks, provenance: await importProvenance(tx, involvedIds, players) };
}

async function importProvenance(tx: Tx, twitchUserIds: readonly string[], playerIds: readonly string[]) {
  const resolutions = await tx.twitchLinkResolution.findMany({ where: { twitchUserId: { in: [...twitchUserIds] }, choice: 'WEB', completedAt: { not: null } },
    select: { id: true, twitchUserId: true, webPlayerId: true, twitchPlayerId: true, choice: true, completedAt: true }, orderBy: { id: 'asc' } });
  const importedPlayers = [...new Set([...playerIds, ...resolutions.map(row => row.twitchPlayerId)])];
  const [players, imports, migrations] = await Promise.all([
    tx.player.findMany({ where: { id: { in: [...playerIds] } }, select: { id: true, status: true }, orderBy: { id: 'asc' } }),
    tx.twitchCanaryImport.findMany({ where: { twitchUserId: { in: [...twitchUserIds] } }, select: { id: true, twitchUserId: true, playerId: true, status: true, snapshotHash: true, identityReportHash: true, backupHash: true }, orderBy: { id: 'asc' } }),
    tx.migrationRun.findMany({ where: { playerId: { in: importedPlayers } }, select: { id: true, playerId: true, status: true, source: true, snapshotHash: true, completedAt: true }, orderBy: { id: 'asc' } }),
  ]);
  return { players, imports, migrations, resolutions };
}

async function hasImportedProgression(tx: Tx, twitchUserId: string, playerId: string) {
  const canaries = await tx.twitchCanaryImport.findMany({ where: { twitchUserId, status: 'DATA_IMPORTED' }, select: { playerId: true } });
  if (canaries.some(row => row.playerId === playerId)) return true;
  if (!canaries.length && await tx.migrationRun.count({ where: { playerId, status: 'COMPLETED', source: 'STREAMERBOT_SNAPSHOT' } })) return true;
  // A WEB winner legitimately holds the Twitch identity while the import remains on its archive.
  // A pending comparison never proves that a different Player was chosen.
  const resolutions = await tx.twitchLinkResolution.findMany({ where: { twitchUserId, webPlayerId: playerId, choice: 'WEB', completedAt: { not: null } }, select: { twitchPlayerId: true } });
  if (canaries.length) return resolutions.some(row => canaries.some(imported => imported.playerId === row.twitchPlayerId));
  return resolutions.length > 0 && await tx.migrationRun.count({ where: { playerId: { in: resolutions.map(r => r.twitchPlayerId) }, status: 'COMPLETED', source: 'STREAMERBOT_SNAPSHOT' } }) > 0;
}
const latest = (...dates: (Date | null | undefined)[]) => dates.reduce<Date | null>((value, date) => date && (!value || date > value) ? date : value, null);

type RelationVersion = { id: string; playerAId: string; playerBId: string; state: string; supersededAt: Date | null; retiredByProgressionAt: Date | null };
async function assertRelationProtection(tx: Tx, leftPlayerId: string, rightPlayerId: string, versions: RelationVersion[]) {
  if (leftPlayerId === rightPlayerId) return fail('SELF_RELATION');
  const players = pair(leftPlayerId, rightPlayerId), current = versions.find(row => row.supersededAt === null);
  const collision = await tx.friendship.findFirst({ where: { ...players, supersededAt: null } });
  const blockedPairs = [players, ...versions.map(version => pair(version.playerAId, version.playerBId))];
  if (await tx.playerBlock.count({ where: { OR: blockedPairs.flatMap(p => [{ blockerPlayerId: p.playerAId, blockedPlayerId: p.playerBId }, { blockerPlayerId: p.playerBId, blockedPlayerId: p.playerAId }]) } })) return fail('BLOCKED_CONTACT');
  if (current?.state === 'ARCHIVED' && !current.retiredByProgressionAt || collision?.state === 'ARCHIVED' && !collision.retiredByProgressionAt) return fail('REVOKED_RELATION');
  if (collision && collision.id !== current?.id) return fail('EFFECTIVE_RELATION_CONFLICT');
}

type MaterializationFact = SourceFact & { id?: string; status?: string; leftTwitchUserId?: string | null; rightTwitchUserId?: string | null; leftProofHash?: string | null; rightProofHash?: string | null };
type VersionWithUsage = Prisma.FriendshipGetPayload<{ include: { hearts: true; legacyHeartStates: true } }>;
function materializationUsage(fact: SourceFact, versions: VersionWithUsage[]) {
  let leftDate = fact.leftLastHeartSentDate, rightDate = fact.rightLastHeartSentDate;
  for (const version of versions) {
    const leftAtVersion = version.legacyLeftPlayerId;
    if (!leftAtVersion || ![version.playerAId, version.playerBId].includes(leftAtVersion)) return fail('VERSION_BINDING_INVALID');
    for (const state of version.legacyHeartStates) {
      if (![version.playerAId, version.playerBId].includes(state.senderPlayerId)) return fail('VERSION_USAGE_INVALID');
      if (state.senderPlayerId === leftAtVersion) leftDate = latest(leftDate, state.lastHeartSentDate);
      else rightDate = latest(rightDate, state.lastHeartSentDate);
    }
    for (const heart of version.hearts) {
      if (heart.senderPlayerId === heart.recipientPlayerId || ![version.playerAId, version.playerBId].includes(heart.senderPlayerId)
        || ![version.playerAId, version.playerBId].includes(heart.recipientPlayerId)) return fail('VERSION_USAGE_INVALID');
      if (heart.senderPlayerId === leftAtVersion) leftDate = latest(leftDate, heart.businessDate);
      else rightDate = latest(rightDate, heart.businessDate);
    }
  }
  return { leftDate, rightDate };
}

/** Same projection for proof registration, future single-player import and actual reconciliation. */
async function planMaterialization(tx: Tx, fact: MaterializationFact, futureOwner?: { twitchUserId: string; playerId: string }) {
  if (fact.status === 'BLOCKED') return fail('SOURCE_CONFLICT');
  const twitchUserIds = [fact.leftTwitchUserId, fact.rightTwitchUserId].filter((id): id is string => Boolean(id));
  if (twitchUserIds.length === 2 && twitchUserIds[0] === twitchUserIds[1]) return fail('IDENTITY_CONFLICT');
  const identities = await tx.twitchIdentity.findMany({ where: { twitchUserId: { in: twitchUserIds } }, include: { player: { select: { status: true } } }, orderBy: { twitchUserId: 'asc' } });
  const versions = fact.id ? await tx.friendship.findMany({ where: { legacyFactId: fact.id }, include: { hearts: { orderBy: { id: 'asc' } }, legacyHeartStates: { orderBy: { senderPlayerId: 'asc' } } }, orderBy: { id: 'asc' } }) : [];
  const current = versions.find(row => row.supersededAt === null);
  const resolve = (twitchUserId: string | null | undefined) => futureOwner && twitchUserId === futureOwner.twitchUserId ? futureOwner.playerId : identities.find(row => row.twitchUserId === twitchUserId && row.player.status === 'ACTIVE')?.playerId;
  const leftPlayerId = resolve(fact.leftTwitchUserId), rightPlayerId = resolve(fact.rightTwitchUserId);
  const playerIds = [...new Set([...identities.map(row => row.playerId), ...versions.flatMap(row => [row.playerAId, row.playerBId]), ...(futureOwner ? [futureOwner.playerId] : [])])].sort();
  let status: 'DEFERRED' | 'READY' | 'RETAINED' = 'DEFERRED';
  let effective: Prisma.FriendshipGetPayload<Record<string, never>> | null = null;
  let usage: ReturnType<typeof materializationUsage> | null = null;
  if (fact.leftTwitchUserId && fact.rightTwitchUserId && fact.leftProofHash && fact.rightProofHash && leftPlayerId && rightPlayerId) {
    if (leftPlayerId === rightPlayerId) return fail('SELF_RELATION');
    const imported = async (id: string, playerId: string) => id === futureOwner?.twitchUserId || await hasImportedProgression(tx, id, playerId);
    if (await imported(fact.leftTwitchUserId, leftPlayerId) && await imported(fact.rightTwitchUserId, rightPlayerId)) {
      await assertRelationProtection(tx, leftPlayerId, rightPlayerId, versions);
      const players = pair(leftPlayerId, rightPlayerId);
      effective = await tx.friendship.findFirst({ where: { ...players, supersededAt: null } });
      status = current?.playerAId === players.playerAId && current?.playerBId === players.playerBId && current.state === 'ACTIVE' ? 'RETAINED' : 'READY';
      // Validate precisely the history that would be projected, without creating a row.
      if (status === 'READY') usage = materializationUsage(fact, versions);
    }
  }
  const blocks = await tx.playerBlock.findMany({ where: { OR: [{ blockerPlayerId: { in: playerIds } }, { blockedPlayerId: { in: playerIds } }] }, orderBy: [{ blockerPlayerId: 'asc' }, { blockedPlayerId: 'asc' }] });
  return { status, playerIds, identities, versions, current, effective, usage, blocks, provenance: await importProvenance(tx, twitchUserIds, playerIds), leftPlayerId, rightPlayerId };
}

/** Preflight one future import. Only its verified owner is projected as DATA_IMPORTED. */
export async function planLegacyFriendshipImport(tx: Tx, input: RegistrationInput & { ownerPlayerId: string }) {
  const registration = validatedRegistration(input);
  const ownerIdentity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: input.ownerTwitchUserId } });
  const ownerPlayer = await tx.player.findUnique({ where: { id: input.ownerPlayerId }, select: { status: true } });
  const occupiedIdentity = await tx.twitchIdentity.findUnique({ where: { playerId: input.ownerPlayerId } });
  if (ownerIdentity && ownerIdentity.playerId !== input.ownerPlayerId || occupiedIdentity && occupiedIdentity.twitchUserId !== input.ownerTwitchUserId
    || ownerPlayer && ownerPlayer.status !== 'ACTIVE') return fail('IDENTITY_CONFLICT');
  const projected = new Map<string, MaterializationFact>((await factsFor(tx, [input.ownerTwitchUserId])).map(fact => [fact.sourcePairKeyHash, fact]));
  const preimages: (StoredFact | null)[] = [];
  for (const source of registration.facts) {
    const found = await tx.legacyFriendshipFact.findUnique({ where: { sourcePairKeyHash: source.sourcePairKeyHash } });
    const update = proofUpdate(source, found, registration.provenKey, input.ownerTwitchUserId, registration.proof);
    preimages.push(found);
    projected.set(source.sourcePairKeyHash, { ...found, ...source, ...update.data });
  }
  const decisions = [];
  for (const fact of [...projected.values()].sort((a, b) => a.sourcePairKeyHash.localeCompare(b.sourcePairKeyHash)))
    decisions.push({ fact, result: await planMaterialization(tx, fact, { twitchUserId: input.ownerTwitchUserId, playerId: input.ownerPlayerId }) });
  const fingerprint = createHash('sha256').update(JSON.stringify({ sourceSnapshotHash: input.snapshot.hash, proof: registration.proof, ownerIdentity, ownerPlayer, occupiedIdentity, preimages, decisions },
    (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value)).digest('hex');
  return { fingerprint, registered: registration.facts.length, materialized: decisions.filter(row => row.result.status === 'READY').length,
    retained: decisions.filter(row => row.result.status === 'RETAINED').length, deferred: decisions.filter(row => row.result.status === 'DEFERRED').length,
    playerIds: [...new Set([input.ownerPlayerId, ...decisions.flatMap(row => row.result.playerIds)])].sort() };
}

/** Complete read-only dry run for one source pair and its two independently verified CANARY reports. */
export async function planLegacyFriendshipRegistration(tx: Tx, input: { snapshot: Snapshot; reports: readonly VerifiedTwitchReport[]; sourcePairKeyHash: string; now: Date }) {
  if (input.reports.length !== 2) return fail('PAIR_PROOFS_REQUIRED');
  const registrations = input.reports.map(report => {
    if (report.users.length !== 1) return fail('PAIR_PROOFS_REQUIRED');
    return validatedRegistration({ snapshot: input.snapshot, report, ownerTwitchUserId: report.users[0]!.twitchUserId, sourcePairKeyHash: input.sourcePairKeyHash, now: input.now });
  });
  if (registrations[0]!.provenKey === registrations[1]!.provenKey || registrations[0]!.owner.twitchUserId === registrations[1]!.owner.twitchUserId) return fail('IDENTITY_CONFLICT');
  const source = registrations[0]!.facts[0]!;
  if (registrations[1]!.facts[0]?.sourceFingerprint !== source.sourceFingerprint) return fail('SOURCE_CONFLICT');
  const found = await tx.legacyFriendshipFact.findUnique({ where: { sourcePairKeyHash: input.sourcePairKeyHash } });
  const updates = registrations.map(registration => proofUpdate(source, found, registration.provenKey, registration.owner.twitchUserId, registration.proof));
  const projected = { ...found, ...source, ...updates[0]!.data, ...updates[1]!.data };
  if (!projected.leftTwitchUserId || !projected.rightTwitchUserId) return fail('PAIR_PROOFS_REQUIRED');
  const result = await planMaterialization(tx, projected);
  const fingerprint = createHash('sha256').update(JSON.stringify({ sourceSnapshotHash: input.snapshot.hash, source, found, proofs: registrations.map(row => row.proof), result },
    (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value)).digest('hex');
  return { status: result.status, fingerprint, sourcePairKeyHash: source.sourcePairKeyHash, playerIds: result.playerIds, materialized: result.status === 'READY' ? 1 : 0, deferred: result.status === 'DEFERRED' ? 1 : 0, retained: result.status === 'RETAINED' ? 1 : 0 };
}

/** Hypothetical identity destination, evaluated before consent; uses the same protection as apply. */
export async function assertLegacyFriendshipResolutionReady(tx: Tx, input: { twitchUserId: string; winnerPlayerId: string; loserPlayerId: string }) {
  for (const fact of await factsFor(tx, [input.twitchUserId])) {
    if (fact.status === 'BLOCKED') return fail('SOURCE_CONFLICT');
    if (!fact.leftTwitchUserId || !fact.rightTwitchUserId || !fact.leftProofHash || !fact.rightProofHash) continue;
    const leftIdentity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: fact.leftTwitchUserId } });
    const rightIdentity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: fact.rightTwitchUserId } });
    if (!leftIdentity || !rightIdentity) continue;
    if (!await hasImportedProgression(tx, fact.leftTwitchUserId, leftIdentity.playerId) || !await hasImportedProgression(tx, fact.rightTwitchUserId, rightIdentity.playerId)) continue;
    const leftPlayerId = fact.leftTwitchUserId === input.twitchUserId ? input.winnerPlayerId : leftIdentity.playerId;
    const rightPlayerId = fact.rightTwitchUserId === input.twitchUserId ? input.winnerPlayerId : rightIdentity.playerId;
    const versions = await tx.friendship.findMany({ where: { legacyFactId: fact.id } });
    await assertRelationProtection(tx, leftPlayerId, rightPlayerId, versions);
  }
}

/** Existing TX only; caller takes Social and all affected Player locks before invoking. */
export async function reconcileLegacyFriendships(tx: Tx, input: { now: Date; twitchUserIds?: readonly string[]; sourcePairKeyHashes?: readonly string[] }) {
  if (!input.twitchUserIds?.length && !input.sourcePairKeyHashes?.length) return fail('EXPLICIT_SCOPE_REQUIRED');
  const facts = await factsFor(tx, input.twitchUserIds, input.sourcePairKeyHashes);
  let materialized = 0, deferred = 0, retained = 0;
  for (const fact of facts) {
    if (fact.status === 'BLOCKED') return fail('SOURCE_CONFLICT');
    if (!fact.leftTwitchUserId || !fact.rightTwitchUserId || !fact.leftProofHash || !fact.rightProofHash) { deferred++; continue; }
    if (fact.leftTwitchUserId === fact.rightTwitchUserId) return fail('IDENTITY_CONFLICT');
    const [left, right] = await Promise.all([
      tx.twitchIdentity.findUnique({ where: { twitchUserId: fact.leftTwitchUserId }, include: { player: { select: { status: true } } } }),
      tx.twitchIdentity.findUnique({ where: { twitchUserId: fact.rightTwitchUserId }, include: { player: { select: { status: true } } } }),
    ]);
    if (!left || !right || left.player.status !== 'ACTIVE' || right.player.status !== 'ACTIVE') { deferred++; continue; }
    if (left.playerId === right.playerId) return fail('SELF_RELATION');
    if (!await hasImportedProgression(tx, fact.leftTwitchUserId, left.playerId) || !await hasImportedProgression(tx, fact.rightTwitchUserId, right.playerId)) { deferred++; continue; }
    const players = pair(left.playerId, right.playerId);
    const versions = await tx.friendship.findMany({ where: { legacyFactId: fact.id }, include: { hearts: true, legacyHeartStates: true }, orderBy: { createdAt: 'asc' } });
    const current = versions.find(row => row.supersededAt === null);
    // A frozen legacy source never authorizes replacing an independently acquired Web relationship.
    await assertRelationProtection(tx, left.playerId, right.playerId, versions);
    if (current && current.playerAId === players.playerAId && current.playerBId === players.playerBId && current.state === 'ACTIVE') { retained++; continue; }
    // Capture only anti-double-claim dates; never carry a balance, level increment or personal counter.
    const { leftDate, rightDate } = materializationUsage(fact, versions);
    if (current) await tx.friendship.update({ where: { id: current.id }, data: { state: 'ARCHIVED', archivedAt: current.archivedAt ?? input.now, supersededAt: input.now } });
    const relation = await tx.friendship.create({ data: { ...players, state: 'ACTIVE', level: current?.level ?? fact.level, totalHearts: current?.totalHearts ?? fact.totalHearts, becameFriendsAt: fact.becameFriendsAt,
      legacyFactId: fact.id, legacyLeftPlayerId: left.playerId } });
    await tx.friendshipLegacyHeartState.createMany({ data: [
      { friendshipId: relation.id, senderPlayerId: left.playerId, lastHeartSentDate: leftDate, legacyProvenance: { source: 'R1055_LEGACY_FRIENDSHIP', factId: fact.id, sourceFingerprint: fact.sourceFingerprint } },
      { friendshipId: relation.id, senderPlayerId: right.playerId, lastHeartSentDate: rightDate, legacyProvenance: { source: 'R1055_LEGACY_FRIENDSHIP', factId: fact.id, sourceFingerprint: fact.sourceFingerprint } },
    ] });
    await tx.legacyFriendshipFact.update({ where: { id: fact.id }, data: { status: 'MATERIALIZED' } });
    materialized++;
  }
  return { materialized, deferred, retained };
}
