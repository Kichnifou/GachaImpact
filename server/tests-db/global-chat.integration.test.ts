import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import { ChatCommandDispatcher, type ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';
import { GetCurrentPlayerBank, TransferPlayerBank } from '../src/application/banking/banking-services.js';
import { PrismaBankingStore } from '../src/infrastructure/database/prisma-banking-store.js';
import { ConvertPersonalParticles } from '../src/application/daily-challenge/daily-challenge-services.js';
import { PrismaDailyChallengeStore } from '../src/infrastructure/database/prisma-daily-challenge-store.js';
import { SocialService } from '../src/application/social/social-service.js';
import { SourceChannel } from '../generated/prisma/client.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PlayerActivityRecorder } from '../src/application/player/player-activity-recorder.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { elementKeys, resourceKeys } from '../src/domain/economy/resources.js';

const fixture = isolatedBatchDatabase();
const db = fixture.database;
let now = new Date('2097-03-01T12:00:00.000Z');
const clock = { now: () => now };
const random = { nextInt: () => 0 };
const getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db));
const service = new GlobalChatService(db, getPlayer, clock, random);
const bankStore = new PrismaBankingStore(db);
const commandServices = {
  getCurrentPlayerBank: new GetCurrentPlayerBank(getPlayer, bankStore, clock),
  depositPlayerBankChat: new TransferPlayerBank('deposit', getPlayer, bankStore, clock, 'CHAT'),
  withdrawPlayerBankChat: new TransferPlayerBank('withdraw', getPlayer, bankStore, clock, 'CHAT'),
  convertPersonalParticlesChat: new ConvertPersonalParticles(getPlayer, new PrismaDailyChallengeStore(db), clock, SourceChannel.INTERNAL_CHAT),
  socialService: new SocialService(getPlayer, db, clock),
} as unknown as ChatCommandServices;
const dispatcher = new ChatCommandDispatcher(service, commandServices);
const as = (subject: string) => ({ subject });
const advance = (ms: number) => { now = new Date(now.getTime() + ms); };

beforeAll(async () => {
  await fixture.setup();
  await db.element.createMany({ data: elementKeys.map((key, index) => ({ key, displayName: key, displayOrder: index + 1 })) });
  await db.resourceDefinition.createMany({ data: resourceKeys.map(key => ({ key, displayName: key, category: 'test', elementKey: key.startsWith('particles_') ? key.slice(10) : null })) });
  await fixture.admin.query('ALTER TABLE global_chat_messages ENABLE ROW LEVEL SECURITY');
  await fixture.admin.query('ALTER TABLE global_chat_read_states ENABLE ROW LEVEL SECURITY');
  await fixture.admin.query('REVOKE ALL ON global_chat_messages, global_chat_read_states FROM PUBLIC, anon, authenticated');
}, 60_000);
afterAll(async () => fixture.cleanup(), 60_000);
let testNumber = 0;
beforeEach(() => { now = new Date(Date.parse('2097-03-01T12:00:00.000Z') + testNumber++ * 60_000); });

async function player(xp = 60n, elementKey: string | null = 'pyro') {
  const id = randomUUID();
  await db.player.create({ data: {
    id, displayName: `Chat ${id.slice(0, 8)}`, elementKey,
    webIdentity: { create: { provider: 'supabase', providerSubject: id } },
    progression: { create: { xp } }, economyStats: { create: {} },
    resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) },
  } });
  return id;
}
const progress = (id: string) => db.playerProgression.findUniqueOrThrow({ where: { playerId: id } });

describe('Global Chat foundation on isolated PostgreSQL', () => {
  it('validates Unicode length and lines, classifies commands, and awards XP only to eligible PLAYER messages', async () => {
    const id = await player(0n);
    await expect(service.send(as(id), '  ', randomUUID())).rejects.toMatchObject({ code: 'CHAT_INVALID' });
    await expect(service.send(as(id), 'a\nb', randomUUID())).rejects.toMatchObject({ code: 'CHAT_INVALID' });
    await expect(service.send(as(id), 'a'.repeat(501), randomUUID())).rejects.toMatchObject({ code: 'CHAT_INVALID' });
    const first = await service.send(as(id), '  😀  ', randomUUID());
    expect(first.message).toMatchObject({ content: '😀', messageType: 'PLAYER' });
    expect(first.xpGranted).toBe(1);
    expect(await progress(id)).toMatchObject({ xp: 1n, totalMessages: 1n, countedMessages: 1n, lastXpMessageAt: now });
    expect((await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: id, resourceKey: 'primogems' } } })).amount).toBe(0n);
    expect((await db.playerActivityState.findUniqueOrThrow({ where: { playerId: id } })).lastInternalChatAt).toEqual(now);
    advance(2_000);
    expect((await service.send(as(id), 'a'.repeat(101), randomUUID())).xpGranted).toBe(2);
    advance(2_000);
    expect((await service.send(as(id), 'a'.repeat(201), randomUUID())).xpGranted).toBe(3);
    advance(2_000);
    expect((await service.send(as(id), ' !help ', randomUUID())).message.messageType).toBe('COMMAND');
    expect(await progress(id)).toMatchObject({ xp: 6n, totalMessages: 4n, countedMessages: 3n, lastXpMessageAt: new Date(now.getTime() - 2_000) });
    const newcomer = await player(0n, null);
    expect((await service.send(as(newcomer), 'bonjour', randomUUID())).xpGranted).toBe(0);
    expect(await progress(newcomer)).toMatchObject({ xp: 0n, totalMessages: 1n, countedMessages: 0n });
  }, 30_000);

  it('replays exactly once and rejects a changed payload or another Player on the same key', async () => {
    const id = await player(), other = await player(); const key = randomUUID();
    const sent = await service.send(as(id), 'bonjour', key);
    const activity = await db.playerActivityState.findUniqueOrThrow({ where: { playerId: id } });
    advance(5_000);
    expect(await service.send(as(id), ' bonjour ', key)).toMatchObject({ message: { id: sent.message.id }, xpGranted: 1, replayed: true });
    expect((await db.playerActivityState.findUniqueOrThrow({ where: { playerId: id } })).lastInternalChatAt).toEqual(activity.lastInternalChatAt);
    await expect(service.send(as(id), 'autre', key)).rejects.toMatchObject({ code: 'CHAT_IDEMPOTENCY_CONFLICT' });
    await expect(service.send(as(other), 'bonjour', key)).rejects.toMatchObject({ code: 'CHAT_IDEMPOTENCY_CONFLICT' });
    expect(await progress(id)).toMatchObject({ xp: 61n, totalMessages: 1n, countedMessages: 1n });
    expect(await db.globalChatMessage.count({ where: { authorPlayerId: id } })).toBe(1);
  });

  it('shares a serialized two second XP cooldown and limits both PLAYER and COMMAND to ten sends in ten seconds', async () => {
    const id = await player();
    const pair = await Promise.all([service.send(as(id), 'premier', randomUUID()), service.send(as(id), 'deuxième', randomUUID())]);
    expect(pair.map(result => result.xpGranted).sort()).toEqual([0, 1]);
    const firstPage = await service.list(as(id), 1);
    const secondPage = await service.list(as(id), 1, firstPage.nextCursor!);
    expect(new Set([firstPage.messages[0]?.id, secondPage.messages[0]?.id])).toEqual(new Set(pair.map(result => result.message.id)));
    expect(await progress(id)).toMatchObject({ totalMessages: 2n, countedMessages: 1n, xp: 61n });
    const keys = Array.from({ length: 8 }, () => randomUUID());
    for (const key of keys) await service.send(as(id), '!help', key);
    await expect(service.send(as(id), 'onzième', randomUUID())).rejects.toMatchObject({ code: 'CHAT_RATE_LIMIT' });
    expect((await service.send(as(id), '!help', keys[0]!)).replayed).toBe(true);
    expect(await progress(id)).toMatchObject({ totalMessages: 10n, countedMessages: 1n });
    advance(10_001);
    expect((await service.send(as(id), 'repris', randomUUID())).xpGranted).toBe(1);
  }, 60_000);

  it('keeps replies relational, tombstones author deletion, paginates and advances read cursor monotonically', async () => {
    const author = await player(), reader = await player();
    const previous = await db.globalChatMessage.findFirst({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    if (previous) await service.markRead(as(reader), previous.id);
    const first = await service.send(as(author), 'origine', randomUUID()); advance(1);
    const second = await service.send(as(reader), 'réponse', randomUUID(), first.message.id); advance(1);
    const third = await service.send(as(author), 'suivant', randomUUID());
    expect(await service.unreadCount(as(reader))).toBe(3);
    const latest = await service.list(as(reader), 2);
    expect(latest.messages.map(m => m.id)).toEqual([second.message.id, third.message.id]);
    const older = await service.list(as(reader), 2, latest.nextCursor!);
    expect(older.messages.at(-1)?.id).toBe(first.message.id);
    expect((await service.markRead(as(reader), second.message.id)).changed).toBe(true);
    expect(await service.unreadCount(as(reader))).toBe(1);
    expect((await service.markRead(as(reader), first.message.id)).changed).toBe(false);
    expect((await service.markRead(as(reader), third.message.id)).changed).toBe(true);
    expect(await service.unreadCount(as(reader))).toBe(0);
    await expect(service.markRead(as(reader), randomUUID())).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
    await expect(service.deleteOwn(as(reader), first.message.id)).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
    expect((await service.deleteOwn(as(author), first.message.id)).changed).toBe(true);
    expect((await service.deleteOwn(as(author), first.message.id)).changed).toBe(false);
    expect((await service.list(as(reader))).messages.find(m => m.id === first.message.id)?.content).toBeNull();
    expect((await service.list(as(reader))).messages.find(m => m.id === second.message.id)?.replyPreview).toBe('Message supprimé');
    await expect(service.send(as(reader), 'tardive', randomUUID(), first.message.id)).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
    await expect(service.send(as(reader), 'inconnue', randomUUID(), randomUUID())).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
  });

  it('rolls back message, XP, operation and counters when activity fails', async () => {
    const id = await player();
    const broken = new GlobalChatService(db, new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)), clock, random,
      undefined, { record: async () => { throw new Error('activity failure'); } } as PlayerActivityRecorder);
    await expect(broken.send(as(id), 'rollback', randomUUID())).rejects.toThrow('activity failure');
    expect(await db.globalChatMessage.count({ where: { authorPlayerId: id } })).toBe(0);
    expect(await db.businessOperation.count({ where: { playerId: id, operationType: 'chat.send' } })).toBe(0);
    expect(await progress(id)).toMatchObject({ xp: 60n, totalMessages: 0n, countedMessages: 0n });
  });

  it('enforces operation/external uniqueness and reply foreign keys in PostgreSQL', async () => {
    const id = await player();
    const sent = await service.send(as(id), 'unique', randomUUID());
    const operation = await db.globalChatMessage.findUniqueOrThrow({ where: { id: sent.message.id }, select: { operationId: true } });
    await expect(db.globalChatMessage.create({ data: { authorPlayerId: id, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: 'duplicate', operationId: operation.operationId } })).rejects.toThrow();
    const external = randomUUID();
    await db.globalChatMessage.create({ data: { sourceChannel: 'SYSTEM', messageType: 'SYSTEM', content: 'service', externalMessageId: external } });
    await expect(db.globalChatMessage.create({ data: { sourceChannel: 'SYSTEM', messageType: 'SYSTEM', content: 'duplicate', externalMessageId: external } })).rejects.toThrow();
    await expect(db.globalChatMessage.create({ data: { sourceChannel: 'SYSTEM', messageType: 'SYSTEM', content: 'orphan', replyToMessageId: randomUUID() } })).rejects.toThrow();
  });

  it('has UUID keys, useful indexes, foreign keys, RLS and no direct browser grants', async () => {
    const schema = fixture.schema;
    const tables = await fixture.admin.query<{ relname: string; relrowsecurity: boolean }>(
      'SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname IN ($2,$3)',
      [schema, 'global_chat_messages', 'global_chat_read_states']);
    expect(tables.rows).toHaveLength(2);
    expect(tables.rows.every(row => row.relrowsecurity)).toBe(true);
    const grants = await fixture.admin.query('SELECT grantee FROM information_schema.role_table_grants WHERE table_schema=$1 AND table_name IN ($2,$3) AND grantee IN ($4,$5)',
      [schema, 'global_chat_messages', 'global_chat_read_states', 'anon', 'authenticated']);
    expect(grants.rows).toHaveLength(0);
    const indexes = await fixture.admin.query<{ indexname: string }>('SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND tablename IN ($2,$3)',
      [schema, 'global_chat_messages', 'global_chat_read_states']);
    expect(indexes.rows.map(row => row.indexname)).toEqual(expect.arrayContaining(['global_chat_messages_operation_id_key', 'global_chat_messages_created_id_idx', 'global_chat_messages_author_created_idx', 'global_chat_messages_reply_to_idx', 'global_chat_read_states_pkey']));
    const foreignKeys = await fixture.admin.query<{ conname: string }>('SELECT c.conname FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname=$1 AND c.contype=$2 AND c.conrelid IN ($3::regclass,$4::regclass)',
      [schema, 'f', `${schema}.global_chat_messages`, `${schema}.global_chat_read_states`]);
    expect(foreignKeys.rows).toHaveLength(5);
  });

  it('persists public command answers once, with no reply XP, counters or activity', async () => {
    const id = await player(0n);
    const key = randomUUID();
    const first = await dispatcher.send(as(id), ' !HeLp ', key);
    expect(first.message).toMatchObject({ messageType: 'COMMAND', content: '!HeLp' });
    expect(first.result).toMatchObject({ messageType: 'GAME_RESULT', sourceChannel: 'SYSTEM', author: null, authorLabel: 'GachaImpact', replyToMessageId: first.message.id });
    expect(first.result?.content).toContain('progression');
    expect(await progress(id)).toMatchObject({ xp: 0n, totalMessages: 1n, countedMessages: 0n });
    const activity = await db.playerActivityState.findUniqueOrThrow({ where: { playerId: id } });
    advance(5_000);
    const replay = await dispatcher.send(as(id), '!HeLp', key);
    expect(replay.result?.id).toBe(first.result?.id);
    expect(await db.globalChatMessage.count({ where: { replyToMessageId: first.message.id, messageType: 'GAME_RESULT' } })).toBe(1);
    expect(await progress(id)).toMatchObject({ xp: 0n, totalMessages: 1n, countedMessages: 0n });
    expect((await db.playerActivityState.findUniqueOrThrow({ where: { playerId: id } })).lastInternalChatAt).toEqual(activity.lastInternalChatAt);
    expect((await dispatcher.send(as(id), '!inconnue', randomUUID())).result?.content).toBe('Commande inconnue. Utilise !help.');
    expect((await dispatcher.send(as(id), '!banque deposer non', randomUUID())).result?.content).toBe('Syntaxe : !banque [deposer|retirer <montant|max>].');
    expect((await dispatcher.send(as(id), '!wish', randomUUID())).result?.content).toBe('Cette commande est réservée à Twitch.');
  }, 30_000);

  it('publishes every part of a long game result atomically and replays the same ordered messages', async () => {
    const id = await player(0n);
    const sent = await service.send(as(id), '!help', randomUUID());
    const content = Array.from({ length: 140 }, (_, index) => `Résultat${index}`).join(' ');
    const first = await service.publishGameResult(sent.message.id, content);
    expect(first.messages.length).toBeGreaterThan(1);
    expect(first.messages.every(message => Array.from(message.content ?? '').length <= 500)).toBe(true);
    expect(first.messages.map(message => message.content).join(' ')).toBe(content);
    const replay = await service.publishGameResult(sent.message.id, content);
    expect(replay.replayed).toBe(true);
    expect(replay.messages.map(message => message.id)).toEqual(first.messages.map(message => message.id));
    expect(await db.globalChatMessage.count({ where: { replyToMessageId: sent.message.id, messageType: 'GAME_RESULT' } })).toBe(first.messages.length);
    expect(await progress(id)).toMatchObject({ xp: 0n, totalMessages: 1n, countedMessages: 0n });
  });

  it('replays a confirmed bank transfer after result publication fails, without a second debit', async () => {
    const id = await player();
    await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: id, resourceKey: 'moras' } }, data: { amount: 1_000n } });
    const key = randomUUID();
    const publish = vi.spyOn(service, 'publishGameResult').mockRejectedValueOnce(new Error('delivery failed'));
    try {
      await expect(dispatcher.send(as(id), '!banque deposer 100', key)).rejects.toThrow('delivery failed');
    } finally { publish.mockRestore(); }
    expect((await commandServices.getCurrentPlayerBank.execute(as(id))).bankMoras).toBe(100n);
    const retry = await dispatcher.send(as(id), '!banque deposer 100', key);
    expect(retry.result?.content).toContain('Banque : 100 Moras');
    expect((await commandServices.getCurrentPlayerBank.execute(as(id))).walletMoras).toBe(900n);
    expect(await db.bankTransaction.count({ where: { playerId: id, transactionType: 'DEPOSIT' } })).toBe(1);
    expect(await db.businessOperation.count({ where: { playerId: id, operationType: 'bank.deposit', sourceChannel: 'INTERNAL_CHAT' } })).toBe(1);
    expect(await progress(id)).toMatchObject({ totalMessages: 1n, countedMessages: 0n, xp: 60n });
  });

  it('uses the resource conversion owner and keeps its Chat source and intent idempotent', async () => {
    const id = await player();
    await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: id, resourceKey: 'particles_pyro' } }, data: { amount: 50n } });
    const key = randomUUID();
    const first = await dispatcher.send(as(id), '!convertir 20', key);
    const replay = await dispatcher.send(as(id), '!convertir 20', key);
    expect(replay.result?.id).toBe(first.result?.id);
    const balances = await db.playerResourceBalance.findMany({ where: { playerId: id, resourceKey: { in: ['particles_pyro', 'primogems'] } } });
    expect(Object.fromEntries(balances.map(balance => [balance.resourceKey, balance.amount]))).toMatchObject({ particles_pyro: 30n, primogems: 20n });
    expect(await db.businessOperation.count({ where: { playerId: id, operationType: 'particles.convert', sourceChannel: 'INTERNAL_CHAT' } })).toBe(1);
    expect(await progress(id)).toMatchObject({ totalMessages: 1n, countedMessages: 0n, xp: 60n });
  });

  it('omits private profile sections in a public infos answer', async () => {
    const viewer = await player();
    const target = await player();
    await db.privacySetting.createMany({ data: ['BOX', 'ACTIVE_TEAM', 'GENERAL_STATISTICS'].map(categoryKey => ({ playerId: target, categoryKey, level: 'PRIVATE' as const })) });
    const name = (await db.player.findUniqueOrThrow({ where: { id: target } })).displayName;
    const answer = (await dispatcher.send(as(viewer), `!infos ${name}`, randomUUID())).result?.content ?? '';
    expect(answer).toContain(name);
    expect(answer).not.toContain('personnages');
    expect(answer).not.toContain('Pulls');
    expect(answer).not.toContain('Team');
  });

  it('records the exact Prisma 032 and 033 migrations and secures their real public tables', async () => {
    const sql = readFileSync('prisma/migrations/20260922070000_032_add_global_chat_foundations/migration.sql');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const migration = await fixture.admin.query<{ checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>(
      'SELECT checksum, finished_at, rolled_back_at FROM public._prisma_migrations WHERE migration_name=$1',
      ['20260922070000_032_add_global_chat_foundations']);
    expect(migration.rows).toHaveLength(1);
    expect(migration.rows[0]).toMatchObject({ checksum, rolled_back_at: null });
    expect(migration.rows[0]?.finished_at).not.toBeNull();
    const correctionSql = readFileSync('prisma/migrations/20260922080000_033_fix_global_chat_content_check/migration.sql');
    const correctionChecksum = createHash('sha256').update(correctionSql).digest('hex');
    const correction = await fixture.admin.query<{ checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>(
      'SELECT checksum, finished_at, rolled_back_at FROM public._prisma_migrations WHERE migration_name=$1',
      ['20260922080000_033_fix_global_chat_content_check']);
    expect(correction.rows).toHaveLength(1);
    expect(correction.rows[0]).toMatchObject({ checksum: correctionChecksum, rolled_back_at: null });
    expect(correction.rows[0]?.finished_at).not.toBeNull();
    const count = await fixture.admin.query<{ count: string }>('SELECT count(*)::text AS count FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
    expect(count.rows[0]?.count).toBe('33');
    const tables = await fixture.admin.query<{ relname: string; relrowsecurity: boolean }>(
      "SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('global_chat_messages','global_chat_read_states')");
    expect(tables.rows).toHaveLength(2);
    expect(tables.rows.every(row => row.relrowsecurity)).toBe(true);
    const grants = await fixture.admin.query("SELECT grantee FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name IN ('global_chat_messages','global_chat_read_states') AND grantee IN ('anon','authenticated')");
    expect(grants.rows).toHaveLength(0);
    const checks = await fixture.admin.query<{ conname: string }>("SELECT conname FROM pg_constraint WHERE connamespace='public'::regnamespace AND conname LIKE 'global_chat_messages_%_check'");
    expect(checks.rows.map(row => row.conname)).toEqual(expect.arrayContaining(['global_chat_messages_deletion_check', 'global_chat_messages_player_check', 'global_chat_messages_internal_content_check']));
    const definition = await fixture.admin.query<{ definition: string }>("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace AND conname='global_chat_messages_internal_content_check'");
    expect(definition.rows).toHaveLength(1);
    expect(definition.rows[0]?.definition).toContain('chr(13)');
    await fixture.admin.query('CREATE TEMP TABLE global_chat_content_check_probe (source_channel public.source_channel NOT NULL, message_type public.global_chat_message_type NOT NULL, content text NOT NULL)');
    await fixture.admin.query(`ALTER TABLE global_chat_content_check_probe ADD CONSTRAINT global_chat_content_check_probe_check ${definition.rows[0]!.definition}`);
    for (const content of ['bonjour', 'r', 'n', '😀', 'a'.repeat(500)]) {
      await expect(fixture.admin.query("INSERT INTO global_chat_content_check_probe (source_channel, message_type, content) VALUES ('INTERNAL_CHAT', 'PLAYER', $1)", [content])).resolves.toBeDefined();
    }
    for (const content of ['', 'a'.repeat(501), 'a\nb', 'a\rb', 'a\u2028b', 'a\u2029b']) {
      await expect(fixture.admin.query("INSERT INTO global_chat_content_check_probe (source_channel, message_type, content) VALUES ('INTERNAL_CHAT', 'PLAYER', $1)", [content])).rejects.toThrow();
    }
  });
});
