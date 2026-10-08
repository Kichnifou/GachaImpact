import { createHash } from 'node:crypto';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { Snapshot } from './streamerbot-snapshot.js';
import type { VerifiedTwitchReport } from './verified-twitch-report.js';
import { legacyFriendshipSourceFacts } from './legacy-friendship-reconciliation.js';
import { assertTargetedDeletionSafe, deleteTargetedRows, rowGraphHash, rowGraphIdentifier as ident, targetedRowMetadata, type RowGraph } from './targeted-player-rows.js';

type Tx = Prisma.TransactionClient;
const tables = ['legacy_friendship_facts', 'friendships', 'friend_hearts', 'friendship_legacy_heart_state'] as const;
type Table = typeof tables[number];
type Rows = Record<Table, string[]>;
export type LegacyFriendshipBackup = { version: 1; schema: string; sourcePairKeyHashes: string[]; playerIds: string[]; rows: Rows; hash: string };
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const keys = (table: Table) => table === 'friendship_legacy_heart_state' ? ['friendship_id', 'sender_player_id'] : ['id'];
const rowKey = (table: Table, image: string) => { const row = JSON.parse(image) as Record<string, unknown>; return JSON.stringify(keys(table).map(key => row[key])); };
const records = (schema: string, table: string) => `json_populate_recordset(NULL::${ident(schema)}.${ident(table)},$1::json)`;
const rowsJson = (rows: string[]) => `[${rows.join(',')}]`;

async function capture(tx: Tx, schema: string, sourcePairKeyHashes: string[]): Promise<Rows> {
  const currentSchema = (await tx.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`)[0]?.schema;
  if (schema !== currentSchema || schema !== 'public' && !/^batch_test_[0-9a-f]{32}$/.test(schema)) throw new Error('LEGACY_FRIENDSHIP_BACKUP_SCHEMA_MISMATCH');
  const facts = await tx.$queryRawUnsafe<{ row: string }[]>(`SELECT row_to_json(f)::text row FROM ${ident(schema)}.legacy_friendship_facts f WHERE f.source_pair_key_hash=ANY($1::text[]) ORDER BY f.id`, sourcePairKeyHashes);
  const friendshipWhere = `SELECT r.id FROM ${ident(schema)}.friendships r JOIN ${ident(schema)}.legacy_friendship_facts f ON f.id=r.legacy_fact_id WHERE f.source_pair_key_hash=ANY($1::text[])`;
  const friendships = await tx.$queryRawUnsafe<{ row: string }[]>(`SELECT row_to_json(r)::text row FROM ${ident(schema)}.friendships r WHERE r.id IN (${friendshipWhere}) ORDER BY r.id`, sourcePairKeyHashes);
  const hearts = await tx.$queryRawUnsafe<{ row: string }[]>(`SELECT row_to_json(h)::text row FROM ${ident(schema)}.friend_hearts h WHERE h.friendship_id IN (${friendshipWhere}) ORDER BY h.id`, sourcePairKeyHashes);
  const carryovers = await tx.$queryRawUnsafe<{ row: string }[]>(`SELECT row_to_json(h)::text row FROM ${ident(schema)}.friendship_legacy_heart_state h WHERE h.friendship_id IN (${friendshipWhere}) ORDER BY h.friendship_id,h.sender_player_id`, sourcePairKeyHashes);
  return { legacy_friendship_facts: facts.map(row => row.row), friendships: friendships.map(row => row.row), friend_hearts: hearts.map(row => row.row), friendship_legacy_heart_state: carryovers.map(row => row.row) };
}

/** Registering a formerly absent fact is included through immutable source-pair scope keys. */
export async function captureLegacyFriendshipBackup(tx: Tx, input: { snapshot: Snapshot; report: VerifiedTwitchReport; ownerTwitchUserId: string; ownerPlayerId: string; sourcePairKeyHash?: string }): Promise<LegacyFriendshipBackup> {
  const owner = input.report.users.find(row => row.twitchUserId === input.ownerTwitchUserId);
  if (!owner) throw new Error('LEGACY_FRIENDSHIP_OWNER_PROOF_REQUIRED');
  const source = legacyFriendshipSourceFacts(input.snapshot, owner.legacyLogin).filter(fact => !input.sourcePairKeyHash || fact.sourcePairKeyHash === input.sourcePairKeyHash);
  if (input.sourcePairKeyHash && source.length !== 1) throw new Error('LEGACY_FRIENDSHIP_SOURCE_PAIR_SCOPE_INVALID');
  const existing = await tx.legacyFriendshipFact.findMany({ where: { ...(input.sourcePairKeyHash ? { sourcePairKeyHash: input.sourcePairKeyHash } : {}), OR: [{ sourcePairKeyHash: { in: source.map(row => row.sourcePairKeyHash) } }, { leftTwitchUserId: input.ownerTwitchUserId }, { rightTwitchUserId: input.ownerTwitchUserId }] } });
  const sourcePairKeyHashes = [...new Set([...source.map(row => row.sourcePairKeyHash), ...existing.map(row => row.sourcePairKeyHash)])].sort();
  const proofIds = [...new Set([input.ownerTwitchUserId, ...existing.flatMap(row => [row.leftTwitchUserId, row.rightTwitchUserId]).filter((id): id is string => id !== null)])];
  const identities = await tx.twitchIdentity.findMany({ where: { twitchUserId: { in: proofIds } }, select: { playerId: true } });
  const versions = await tx.friendship.findMany({ where: { legacyFactId: { in: existing.map(row => row.id) } }, select: { playerAId: true, playerBId: true } });
  const playerIds = [...new Set([input.ownerPlayerId, ...identities.map(row => row.playerId), ...versions.flatMap(row => [row.playerAId, row.playerBId])])].sort();
  const { schema } = await targetedRowMetadata(tx), rows = await capture(tx, schema, sourcePairKeyHashes);
  const body = { version: 1 as const, schema, sourcePairKeyHashes, playerIds, rows };
  return { ...body, hash: hash(body) };
}

function validate(backup: LegacyFriendshipBackup) {
  const { hash: expected, ...body } = backup;
  if (backup.version !== 1 || hash(body) !== expected || JSON.stringify(Object.keys(backup.rows).sort()) !== JSON.stringify([...tables].sort())
    || backup.sourcePairKeyHashes.some(key => !/^[a-f0-9]{64}$/.test(key))) throw new Error('LEGACY_FRIENDSHIP_BACKUP_INVALID');
}
export async function legacyFriendshipBackupPostHash(tx: Tx, backup: LegacyFriendshipBackup) {
  validate(backup);
  return hash(await capture(tx, backup.schema, backup.sourcePairKeyHashes));
}

/** Restore only this operation's social preimage; refusal is atomic if any later write/reference exists. */
export async function restoreLegacyFriendshipBackup(tx: Tx, backup: LegacyFriendshipBackup, expectedPostHash: string) {
  validate(backup);
  const current = await capture(tx, backup.schema, backup.sourcePairKeyHashes);
  if (hash(current) !== expectedPostHash) throw new Error('LEGACY_FRIENDSHIP_POSTIMAGE_CHANGED');
  const removed = Object.fromEntries(tables.map(table => {
    const originalKeys = new Set(backup.rows[table].map(row => rowKey(table, row)));
    return [table, current[table].filter(row => !originalKeys.has(rowKey(table, row)))];
  })) as Rows;
  const deleting = new Set<string>(tables), order = ['friend_hearts', 'friendship_legacy_heart_state', 'friendships', 'legacy_friendship_facts'];
  const graph: RowGraph = { schema: backup.schema, playerIds: backup.playerIds, tables: removed, order, hash: rowGraphHash(removed) };
  // Same-schema unknown references are handled by the canonical FK guard; cross-schema references also fail closed.
  const external = await tx.$queryRawUnsafe<{ count: string }[]>(`SELECT count(*)::text count FROM pg_constraint fk JOIN pg_class p ON p.oid=fk.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace JOIN pg_class c ON c.oid=fk.conrelid JOIN pg_namespace cn ON cn.oid=c.relnamespace WHERE fk.contype='f' AND pn.nspname=$1 AND p.relname=ANY($2::text[]) AND cn.nspname<>$1`, backup.schema, [...tables]);
  if (external[0]?.count !== '0') throw new Error('LEGACY_FRIENDSHIP_EXTERNAL_REFERENCE');
  await assertTargetedDeletionSafe(tx, graph, deleting);
  await deleteTargetedRows(tx, graph, deleting);
  // Existing facts/versions remain in place; old heart receipts are never deleted or reauthored.
  for (const table of tables) {
    const currentByKey = new Map(current[table].map(row => [rowKey(table, row), row]));
    const changed = backup.rows[table].filter(row => currentByKey.get(rowKey(table, row)) !== row);
    if (!changed.length) continue;
    if (table === 'friend_hearts') throw new Error('LEGACY_FRIENDSHIP_HISTORICAL_HEART_CHANGED');
    const columns = await tx.$queryRawUnsafe<{ column_name: string }[]>('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position', backup.schema, table);
    const updates = columns.map(row => row.column_name).filter(column => !keys(table).includes(column)).map(column => `${ident(column)}=EXCLUDED.${ident(column)}`).join(',');
    await tx.$executeRawUnsafe(`INSERT INTO ${ident(backup.schema)}.${ident(table)} SELECT * FROM ${records(backup.schema, table)} ON CONFLICT (${keys(table).map(ident).join(',')}) DO UPDATE SET ${updates}`, rowsJson(changed));
  }
  if (hash(await capture(tx, backup.schema, backup.sourcePairKeyHashes)) !== hash(backup.rows)) throw new Error('LEGACY_FRIENDSHIP_EXACT_PREIMAGE_MISMATCH');
  return { mode: 'EXACT_PREIMAGE' as const };
}
