import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { communityRecord, requireCommunityMutationGates } from '../src/application/migration/legacy-community-proof.js';
import { receiptSafety, receiptSafetyCandidates } from '../src/application/twitch/twitch-operations-in-flight.js';

if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env['DATABASE_URL'] ?? 'http://missing').hostname)) throw Error('Community gate tests require loopback PostgreSQL');
const fixture = isolatedBatchDatabase(), db = fixture.database;
const now = new Date('2026-10-09T15:00:00Z');
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: false, globalEnabled: false },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
let operatorId: string;
type Receipt = Prisma.TwitchEventReceiptGetPayload<Record<string, never>>;
type Scenario = { name: string; data?: Partial<Prisma.TwitchEventReceiptCreateManyInput>; blocksReceived: boolean; blocksTerminal?: boolean };
const scenarios: Scenario[] = [
  { name: 'passive SQL null payload', blocksReceived: false },
  { name: 'passive JSON null payload', data: { payloadMinimal: Prisma.JsonNull }, blocksReceived: false },
  ...[{}, [], 'malformed scalar', 0, false, { unrelated: { arbitrary: true } }].map((payloadMinimal, index) => ({
    name: `passive non-reserved payload ${index}`, data: { payloadMinimal }, blocksReceived: false,
  })),
  { name: 'chat with processedAt already present', data: { processedAt: now }, blocksReceived: true },
  { name: 'subscription without payload', data: { eventType: 'channel.subscribe' }, blocksReceived: true },
  { name: 'redemption without payload', data: { eventType: 'channel.channel_points_custom_reward_redemption.add' }, blocksReceived: true },
  { name: 'unknown event without payload', data: { eventType: 'synthetic.unknown' }, blocksReceived: true },
  ...['', 'message-native:', 'message-native:synthetic:reserved', 'message-native', 'xmessage-native:synthetic', 'command-pilot:synthetic', 'other:synthetic'].map(externalReference => ({
    name: `reference ${externalReference || '(empty)'}`, data: { externalReference }, blocksReceived: true,
  })),
  ...(['commandPilot', 'messageActivity'] as const).flatMap(key => [null, {}, [], false, 'malformed'].map((value, index) => ({
    name: `own ${key} property ${index}`, data: { payloadMinimal: { [key]: value } }, blocksReceived: true,
  }))),
  { name: 'command EXECUTING without responses', data: { payloadMinimal: { commandPilot: { stage: 'EXECUTING' } } }, blocksReceived: true, blocksTerminal: true },
  { name: 'command EXECUTING with all responses sent', data: { payloadMinimal: { commandPilot: { stage: 'EXECUTING', responses: [{ status: 'SENT' }] } } }, blocksReceived: true, blocksTerminal: true },
  ...['PENDING', 'SENDING', 'AMBIGUOUS', 'SENT', 'FAILED', 'pending', 'UNKNOWN'].map(status => ({
    name: `response ${status} with additional fields`, data: { payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [
      { status, text: 'Synthetic full response', messageId: 'synthetic-outbound', attempt: 2, extra: { retained: true } },
    ] } } }, blocksReceived: true, blocksTerminal: ['PENDING', 'SENDING', 'AMBIGUOUS'].includes(status),
  })),
  ...['PENDING', 'SENDING', 'AMBIGUOUS'].map(status => ({
    name: `late ${status} among many outbound entries`, data: { payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [
      ...Array.from({ length: 11 }, (_, index) => ({ status: index % 2 ? 'SENT' : 'FAILED', text: `Synthetic segment ${index}` })),
      { status, text: 'Unresolved final segment', extra: { nested: ['proof'] } },
    ] } } }, blocksReceived: true, blocksTerminal: true,
  })),
  ...[null, {}, { status: 'PENDING' }, 'PENDING', 4, [null, false, 'PENDING', {}, { status: null }], [[{ status: 'SENDING' }]]].map((responses, index) => ({
    name: `malformed response container or entries ${index}`, data: { payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses } } }, blocksReceived: true,
  })),
  { name: 'pilot array is not a command object', data: { payloadMinimal: { commandPilot: [{ stage: 'EXECUTING', responses: [{ status: 'AMBIGUOUS' }] }] } }, blocksReceived: true },
  { name: 'root array is not a reserved payload', data: { payloadMinimal: [{ commandPilot: { stage: 'EXECUTING' } }] }, blocksReceived: false },
  { name: 'response-like activity metadata is not command outbound', data: { payloadMinimal: { messageActivity: { responses: [{ status: 'SENDING' }] } } }, blocksReceived: true },
];
const matrix = scenarios.flatMap(scenario => ['RECEIVED', 'PROCESSED', 'FAILED'].map(state => ({ ...scenario, state,
  blocked: state === 'RECEIVED' ? scenario.blocksReceived : scenario.blocksTerminal === true })));

/** The complete pre-optimization decision is the oracle. It does not use the SQL predicate. */
function completeDecision(row: Receipt) {
  const responses = communityRecord(communityRecord(row.payloadMinimal).commandPilot).responses;
  return receiptSafety(row).blocking || Array.isArray(responses) && responses.some(value => communityRecord(value).status === 'PENDING');
}
function receipt(data: Partial<Prisma.TwitchEventReceiptCreateManyInput> = {}): Prisma.TwitchEventReceiptCreateManyInput {
  return { externalEventId: randomUUID(), eventType: 'channel.chat.message', state: 'RECEIVED', processedAt: null,
    externalReference: null, payloadMinimal: Prisma.DbNull, ...data };
}
async function gate(client: PrismaClient = db) {
  return client.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await requireCommunityMutationGates(tx, config, { operatorPlayerId: operatorId, expectedRevision: 17 });
  }, { isolationLevel: 'RepeatableRead', timeout: 30_000 });
}
async function compareCandidateDecisions() {
  const all = await db.twitchEventReceipt.findMany({ orderBy: { id: 'asc' } });
  const candidates = await db.twitchEventReceipt.findMany({ where: receiptSafetyCandidates(), orderBy: { id: 'asc' } });
  expect(candidates.filter(completeDecision).map(row => row.id)).toEqual(all.filter(completeDecision).map(row => row.id));
  // The social gate intentionally uses receiptSafety only, whereas the community gate also blocks PENDING responses.
  expect(candidates.filter(row => receiptSafety(row).blocking).map(row => row.id)).toEqual(all.filter(row => receiptSafety(row).blocking).map(row => row.id));
  return { all, candidates };
}
async function payloadBytes(ids?: string[]) {
  if (ids?.length === 0) return 0;
  const where = ids ? Prisma.sql`WHERE id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})` : Prisma.empty;
  const rows = await db.$queryRaw<{ bytes: bigint }[]>(Prisma.sql`SELECT COALESCE(SUM(octet_length(payload_minimal::text)),0)::bigint AS bytes FROM twitch_event_receipts ${where}`);
  return Number(rows[0]!.bytes);
}
async function measureGate(label: string, extra: Record<string, string | number> = {}) {
  const { all, candidates } = await compareCandidateDecisions();
  const reads: { rows: number; serializedBytes: number }[] = [];
  const measured = db.$extends({ query: { twitchEventReceipt: { async findMany({ args, query }) {
    const result = await query(args); reads.push({ rows: result.length, serializedBytes: Buffer.byteLength(JSON.stringify(result)) }); return result;
  } } } });
  const started = performance.now();
  if (all.some(completeDecision)) await expect(gate(measured as unknown as PrismaClient)).rejects.toThrow('COMMUNITY_OUTBOUND_IN_FLIGHT');
  else await gate(measured as unknown as PrismaClient);
  const elapsedMs = Math.round(performance.now() - started);
  expect(reads).toHaveLength(1); expect(reads[0]!.rows).toBe(candidates.length);
  const result = { label, ...extra, rows: all.length, candidates: candidates.length, blockers: all.filter(completeDecision).length,
    socialBlockers: all.filter(row => receiptSafety(row).blocking).length, totalPayloadBytes: await payloadBytes(),
    candidatePayloadBytes: await payloadBytes(candidates.map(row => row.id)), gateReadBytes: reads[0]!.serializedBytes, elapsedMs };
  process.stdout.write(`receipt-candidates-private-measure ${JSON.stringify(result)}\n`);
  return result;
}

beforeAll(async () => {
  await fixture.setup({ prismaMigrations: true });
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Synthetic gate operator', twitchIdentity: {
    twitchUserId: '975520000000', login: 'kichnifou', displayName: 'Synthetic operator', firstSeenAt: now } }, now));
  operatorId = operator.id; config.twitch.pilotPlayerIds.push(operatorId);
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'synthetic-gate' } });
  await db.twitchNativeAuthority.create({ data: { id: 'twitch-commands', desiredMode: 'OFF', revision: 17, operatorPlayerId: operatorId } });
}, 180_000);
afterEach(async () => {
  await db.twitchEventReceipt.deleteMany(); await db.giveawayAnnouncement.deleteMany(); await db.businessOperation.deleteMany();
});
afterAll(async () => {
  await fixture.cleanup(); const pool = fixture.poolSnapshot(); expect(pool).toMatchObject({ total: 0, idle: 0, waiting: 0 }); expect(pool.closed).toBe(pool.opened);
}, 60_000);

describe('conservative community receipt candidates on private PostgreSQL', () => {
  it('preserves every exhaustive matrix decision in one PostgreSQL batch, including malformed and passive receipts', async () => {
    const data = matrix.map(scenario => receipt({ ...scenario.data, state: scenario.state }));
    const expected = new Map(data.map((row, index) => [row.externalEventId, matrix[index]!]));
    await db.twitchEventReceipt.createMany({ data });
    const { all } = await compareCandidateDecisions(); expect(all).toHaveLength(matrix.length);
    for (const row of all) {
      const scenario = expected.get(row.externalEventId)!;
      expect(completeDecision(row), `${scenario.name} [${scenario.state}]`).toBe(scenario.blocked);
    }
    await expect(gate()).rejects.toThrow('COMMUNITY_OUTBOUND_IN_FLIGHT');
    await db.twitchEventReceipt.deleteMany({ where: { id: { in: all.filter(completeDecision).map(row => row.id) } } });
    await compareCandidateDecisions(); await gate();
    expect(await db.twitchEventReceipt.findMany({ orderBy: { id: 'asc' } })).toEqual(all.filter(row => !completeDecision(row)));
    process.stdout.write(`receipt-candidates-private-matrix ${JSON.stringify({ cases: matrix.length, blockers: all.filter(completeDecision).length, safe: all.filter(row => !completeDecision(row)).length })}\n`);
  });

  it.each([
    receipt({ payloadMinimal: { messageActivity: null } }),
    receipt({ payloadMinimal: { commandPilot: null } }),
    receipt({ state: 'PROCESSED', payloadMinimal: { commandPilot: { stage: 'EXECUTING', responses: [{ status: 'SENT' }] } } }),
    receipt({ state: 'FAILED', payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'PENDING', text: 'Synthetic retained text' }] } } }),
  ])('blocks an isolated reservation or terminal unresolved command %#', async data => {
    await db.twitchEventReceipt.createMany({ data: [data] });
    await expect(gate()).rejects.toThrow('COMMUNITY_OUTBOUND_IN_FLIGHT');
  });

  it('rechecks a late unresolved outbound in a terminal receipt and permits only its resolved successor', async () => {
    const row = await db.twitchEventReceipt.create({ data: receipt({ state: 'PROCESSED', processedAt: now,
      payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'SENT', text: 'First' }, { status: 'SENT', text: 'Last' }] } } }) });
    await gate();
    for (const status of ['PENDING', 'SENDING', 'AMBIGUOUS']) {
      await db.twitchEventReceipt.update({ where: { id: row.id }, data: { payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [
        { status: 'SENT', text: 'First', messageId: 'synthetic-first' }, { status, text: 'Last', retainedExtra: true },
      ] } } } });
      await compareCandidateDecisions(); await expect(gate()).rejects.toThrow('COMMUNITY_OUTBOUND_IN_FLIGHT');
    }
    await db.twitchEventReceipt.update({ where: { id: row.id }, data: { payloadMinimal: { commandPilot: { stage: 'RESPONSES', responses: [{ status: 'SENT' }, { status: 'FAILED' }] } } } });
    await compareCandidateDecisions(); await gate();
  });

  it('still refuses global pending business operations independently of receipts', async () => {
    const row = await db.businessOperation.create({ data: { operationType: 'synthetic.gate.pending', sourceChannel: 'SYSTEM', status: 'PENDING', idempotencyKey: randomUUID() } });
    await expect(gate()).rejects.toThrow('COMMUNITY_OPERATION_IN_FLIGHT');
    await db.businessOperation.update({ where: { id: row.id }, data: { status: 'COMPLETED', completedAt: now } });
    await gate();
  });

  it.each(['PENDING', 'RESERVED', 'AMBIGUOUS', 'SENT', 'FAILED'])('keeps Giveaway announcement safety for %s', async state => {
    await db.giveawayAnnouncement.create({ data: { kind: 'COMMAND', text: 'Synthetic announcement', state } });
    if (state === 'RESERVED' || state === 'AMBIGUOUS') await expect(gate()).rejects.toThrow('COMMUNITY_OUTBOUND_IN_FLIGHT');
    else await gate();
  });

  it('does not materialize 169 healthy terminal receipts of about three MB at the owner gate', async () => {
    const large = 'x'.repeat(18_600);
    await db.twitchEventReceipt.createMany({ data: Array.from({ length: 169 }, (_, index) => receipt({ state: index % 2 ? 'PROCESSED' : 'FAILED', processedAt: now,
      externalReference: `command-pilot:synthetic-terminal:${index}`, payloadMinimal: { commandPilot: { stage: 'RESPONSES',
        responses: [{ status: 'SENT', text: large, fullText: 'Synthetic retained proof' }, { status: 'FAILED', error: 'Synthetic terminal failure' }] } } })) });
    await db.twitchEventReceipt.createMany({ data: Array.from({ length: 41 }, () => receipt({ payloadMinimal: { contentHash: 'a'.repeat(64) } })) });
    const measured = await measureGate('synthetic-210');
    expect(measured).toMatchObject({ rows: 210, candidates: 41, blockers: 0, socialBlockers: 0 });
    expect(measured.totalPayloadBytes).toBeGreaterThan(3_000_000); expect(measured.totalPayloadBytes).toBeLessThan(3_500_000);
    expect(measured.gateReadBytes).toBeLessThan(30_000); expect(measured.candidatePayloadBytes).toBeLessThan(30_000);
  });

  it.skipIf(!process.env['LEGACY_RECEIPT_CAPTURE_PATH'])('compares the complete optional private capture with real PostgreSQL candidates without publishing raw data', async () => {
    const bytes = await readFile(process.env['LEGACY_RECEIPT_CAPTURE_PATH']!), capture = JSON.parse(bytes.toString('utf8')) as { tables: { twitch_event_receipts: string[] } };
    const rows = capture.tables.twitch_event_receipts; expect(Array.isArray(rows)).toBe(true); expect(rows.length).toBeGreaterThan(0);
    const data = rows.map(raw => {
      const row = JSON.parse(raw) as { event_type: string; state: string; processed_at: string | null; external_reference: string | null; payload_minimal: Prisma.InputJsonValue | null };
      return receipt({ eventType: row.event_type, state: row.state, processedAt: row.processed_at, externalReference: row.external_reference,
        payloadMinimal: row.payload_minimal === null ? Prisma.DbNull : row.payload_minimal });
    });
    await db.twitchEventReceipt.createMany({ data });
    const measured = await measureGate('private-capture', { captureSha256: createHash('sha256').update(bytes).digest('hex') });
    expect(measured.rows).toBe(rows.length);
  });
});
