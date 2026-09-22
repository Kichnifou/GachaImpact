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
  await fixture.admin.query('ALTER TABLE global_chat_mentions ENABLE ROW LEVEL SECURITY');
  await fixture.admin.query('ALTER TABLE global_chat_reports ENABLE ROW LEVEL SECURITY');
  await fixture.admin.query('REVOKE ALL ON global_chat_messages, global_chat_read_states FROM PUBLIC, anon, authenticated');
  await fixture.admin.query('REVOKE ALL ON global_chat_mentions, global_chat_reports FROM PUBLIC, anon, authenticated');
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
const migrationChecksum = (path: string) => createHash('sha256').update(readFileSync(path, 'utf8').replace(/\r\n?/gu, '\n')).digest('hex');

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

  it('orders a Chat level-up result after its PLAYER message with a fixed application clock', async () => {
    const id = await player(29n);
    const key = randomUUID();
    const sent = await service.send(as(id), 'Bonjour', key);
    expect(sent.xpGranted).toBe(1);
    const result = await db.globalChatMessage.findFirstOrThrow({ where: { replyToMessageId: sent.message.id, messageType: 'GAME_RESULT' } });
    expect(result.createdAt.getTime()).toBe(new Date(sent.message.createdAt).getTime() + 1);
    const visible = (await service.list(as(id))).messages.filter(row => row.id === sent.message.id || row.id === result.id);
    expect(visible.map(row => row.id)).toEqual([sent.message.id, result.id]);
    expect(visible[1]).toMatchObject({ authorLabel: 'GachaImpact', replyToMessageId: sent.message.id });
    expect((await service.send(as(id), 'Bonjour', key)).replayed).toBe(true);
    expect(await db.globalChatMessage.count({ where: { replyToMessageId: sent.message.id, messageType: 'GAME_RESULT' } })).toBe(1);
  });

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
  }, 20_000);

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
    expect((await service.unreadCount(as(reader))).unreadCount).toBe(3);
    const latest = await service.list(as(reader), 2);
    expect(latest.messages.map(m => m.id)).toEqual([second.message.id, third.message.id]);
    const older = await service.list(as(reader), 2, latest.nextCursor!);
    expect(older.messages.at(-1)?.id).toBe(first.message.id);
    expect((await service.markRead(as(reader), second.message.id)).changed).toBe(true);
    expect((await service.unreadCount(as(reader))).unreadCount).toBe(1);
    expect((await service.markRead(as(reader), first.message.id)).changed).toBe(false);
    expect((await service.markRead(as(reader), third.message.id)).changed).toBe(true);
    expect((await service.unreadCount(as(reader))).unreadCount).toBe(0);
    await expect(service.markRead(as(reader), randomUUID())).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
    await expect(service.deleteOwn(as(reader), first.message.id)).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
    expect((await service.deleteOwn(as(author), first.message.id)).changed).toBe(true);
    expect((await service.deleteOwn(as(author), first.message.id)).changed).toBe(false);
    expect((await service.list(as(reader))).messages.find(m => m.id === first.message.id)?.content).toBeNull();
    expect((await service.list(as(reader))).messages.find(m => m.id === second.message.id)?.replyPreview).toBe('Message supprimé');
    await expect(service.send(as(reader), 'tardive', randomUUID(), first.message.id)).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
    await expect(service.send(as(reader), 'inconnue', randomUUID(), randomUUID())).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
  }, 20_000);

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
    expect(retry.refreshScopes).toEqual(expect.arrayContaining(['bank', 'resources']));
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
    expect(first.refreshScopes).toEqual(expect.arrayContaining(['resources', 'inventory', 'dailyChallenge']));
    expect(replay.refreshScopes).toEqual(first.refreshScopes);
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

  it('persists selected mentions, projects only mentionedMe, and excludes blocked Players', async () => {
    const author = await player(), target = await player(), viewer = await player();
    const targetName = 'Céo';
    await db.player.update({ where: { id: target }, data: { displayName: targetName } });
    for (const query of ['ce', 'cé', 'CE']) {
      expect((await service.searchMentions(as(author), query)).players.map(item => item.id)).toContain(target);
    }
    const key = randomUUID();
    const sent = await service.send(as(author), `Bonjour @${targetName}`, key, null, [{ playerId: target, displayName: targetName }]);
    expect(await db.globalChatMention.count({ where: { messageId: sent.message.id, mentionedPlayerId: target } })).toBe(1);
    expect((await service.list(as(target))).messages.find(item => item.id === sent.message.id)?.mentionedMe).toBe(true);
    expect((await service.list(as(viewer))).messages.find(item => item.id === sent.message.id)?.mentionedMe).toBe(false);
    const manual = await service.send(as(author), `Salut @${targetName.toUpperCase()}`, randomUUID());
    expect(await db.globalChatMention.count({ where: { messageId: manual.message.id, mentionedPlayerId: target } })).toBe(1);
    const forged = await service.send(as(author), 'Salut sans mention', randomUUID(), null, [{ playerId: target, displayName: targetName }]);
    expect(await db.globalChatMention.count({ where: { messageId: forged.message.id } })).toBe(0);
    await db.playerBlock.create({ data: { blockerPlayerId: target, blockedPlayerId: author } });
    expect((await service.searchMentions(as(author), targetName)).players.some(item => item.id === target)).toBe(false);
    const blocked = await service.send(as(author), `Encore @${targetName}`, randomUUID(), null, [{ playerId: target, displayName: targetName }]);
    expect(await db.globalChatMention.count({ where: { messageId: blocked.message.id } })).toBe(0);
  }, 20_000);

  it('resolves whole normalized direct mentions, deduplicates, and highlights replies to the viewer', async () => {
    const author = await player(), target = await player(), other = await player();
    await db.player.update({ where: { id: target }, data: { displayName: 'Élodie' } });
    const sent = await service.send(as(author), 'Bonjour @elodie, puis @ÉLODIE ! @Élodiette', randomUUID(), null, [{ playerId: other, displayName: 'Autre' }]);
    expect(await db.globalChatMention.findMany({ where: { messageId: sent.message.id } })).toHaveLength(1);
    expect((await service.list(as(target))).messages.find(row => row.id === sent.message.id)?.mentionedMe).toBe(true);
    const own = await service.send(as(target), 'Mon message', randomUUID());
    const toMe = await service.send(as(author), 'Une réponse', randomUUID(), own.message.id);
    expect((await service.list(as(target))).messages.find(row => row.id === toMe.message.id)?.repliedToMe).toBe(true);
    const command = await service.send(as(author), '!help @Élodie', randomUUID());
    expect(await db.globalChatMention.count({ where: { messageId: command.message.id } })).toBe(0);
    const absent = await service.send(as(author), 'Salut @Introuvable', randomUUID());
    expect(await db.globalChatMention.count({ where: { messageId: absent.message.id } })).toBe(0);
    const partial = await service.send(as(author), 'Salut @Élodie.extra', randomUUID());
    expect(await db.globalChatMention.count({ where: { messageId: partial.message.id } })).toBe(0);
  }, 30_000);

  it('freezes bounded report context and retains it after author deletion', async () => {
    const author = await player(), reporter = await player();
    const base = new Date('2097-03-02T00:00:00.000Z').getTime();
    for (let index = 0; index < 12; index++) await db.globalChatMessage.create({ data: { authorPlayerId: author, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: `before-${index}`, createdAt: new Date(base + index * 1000) } });
    const target = await db.globalChatMessage.create({ data: { authorPlayerId: author, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: 'Reported text', createdAt: new Date(base + 12_000) } });
    for (let index = 0; index < 12; index++) await db.globalChatMessage.create({ data: { authorPlayerId: author, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: `after-${index}`, createdAt: new Date(base + (13 + index) * 1000) } });
    expect(await service.report(as(reporter), target.id)).toEqual({ reported: true, duplicate: false });
    expect(await service.report(as(reporter), target.id)).toEqual({ reported: true, duplicate: true });
    const row = await db.globalChatReport.findUniqueOrThrow({ where: { reporterPlayerId_messageId: { reporterPlayerId: reporter, messageId: target.id } } });
    expect((row.messageSnapshot as { content: string }).content).toBe('Reported text');
    expect(row.contextSnapshot).toHaveLength(21);
    await service.deleteOwn(as(author), target.id);
    expect((await db.globalChatReport.findUniqueOrThrow({ where: { id: row.id } })).messageSnapshot).toEqual(row.messageSnapshot);
    await expect(service.report(as(author), target.id)).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
  }, 30_000);

  it('advances the Messages challenge only for an XP-counted PLAYER message and replays once', async () => {
    const id = await player(0n);
    const definition = await db.dailyChallengeDefinition.create({ data: { externalKey: `test-messages-${id}`, type: 'messages', target: 10n, displayName: 'Messages', description: 'Dix messages', progressLabel: 'Messages', rewardPrimogems: 800n, weight: 1, isEnabled: true, isEligible: true, displayOrder: 1 } });
    const challenge = await db.playerDailyChallenge.create({ data: { playerId: id, businessDate: new Date('2097-03-01T00:00:00.000Z'), definitionId: definition.id, definitionExternalKeySnapshot: definition.externalKey, typeSnapshot: 'messages', displayNameSnapshot: 'Messages', descriptionSnapshot: 'Dix messages', progressLabelSnapshot: 'Messages', targetSnapshot: 10n, rewardPrimogemsSnapshot: 800n, progress: 9n, status: 'ACTIVE', assignedAt: now } });
    const key = randomUUID();
    const result = await service.send(as(id), 'Dixième message', key);
    expect(result).toMatchObject({ xpGranted: 1, dailyChallengeCompleted: true, refreshScopes: expect.arrayContaining(['progression', 'dailyChallenge', 'resources']) });
    expect((await db.playerDailyChallenge.findUniqueOrThrow({ where: { id: challenge.id } })).progress).toBe(10n);
    expect((await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: id, resourceKey: 'primogems' } } })).amount).toBe(800n);
    expect((await service.send(as(id), 'Dixième message', key)).dailyChallengeCompleted).toBe(true);
    expect((await service.send(as(id), 'Pendant cooldown', randomUUID())).xpGranted).toBe(0);
    expect((await service.send(as(id), '!help', randomUUID())).xpGranted).toBe(0);
    expect((await db.playerDailyChallenge.findUniqueOrThrow({ where: { id: challenge.id } })).progress).toBe(10n);
    expect((await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: id, resourceKey: 'primogems' } } })).amount).toBe(800n);
  }, 20_000);

  it('records the exact Prisma 032–035 migrations and secures their real public tables', async () => {
    const checksum = migrationChecksum('prisma/migrations/20260922070000_032_add_global_chat_foundations/migration.sql');
    const migration = await fixture.admin.query<{ checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>(
      'SELECT checksum, finished_at, rolled_back_at FROM public._prisma_migrations WHERE migration_name=$1',
      ['20260922070000_032_add_global_chat_foundations']);
    expect(migration.rows).toHaveLength(1);
    expect(migration.rows[0]).toMatchObject({ checksum, rolled_back_at: null });
    expect(migration.rows[0]?.finished_at).not.toBeNull();
    const correctionChecksum = migrationChecksum('prisma/migrations/20260922080000_033_fix_global_chat_content_check/migration.sql');
    const correction = await fixture.admin.query<{ checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>(
      'SELECT checksum, finished_at, rolled_back_at FROM public._prisma_migrations WHERE migration_name=$1',
      ['20260922080000_033_fix_global_chat_content_check']);
    expect(correction.rows).toHaveLength(1);
    expect(correction.rows[0]).toMatchObject({ checksum: correctionChecksum, rolled_back_at: null });
    expect(correction.rows[0]?.finished_at).not.toBeNull();
    const count = await fixture.admin.query<{ count: string }>('SELECT count(*)::text AS count FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
    const newChecksum = migrationChecksum('prisma/migrations/20260922090000_034_chat_mentions_reports_and_daily_messages/migration.sql');
    const newMigration = await fixture.admin.query<{ checksum: string; finished_at: Date | null }>('SELECT checksum, finished_at FROM public._prisma_migrations WHERE migration_name=$1', ['20260922090000_034_chat_mentions_reports_and_daily_messages']);
    expect(newMigration.rows).toHaveLength(1);
    expect(newMigration.rows[0]?.checksum).toBe(newChecksum);
    expect(newMigration.rows[0]?.finished_at).not.toBeNull();
    expect(count.rows[0]?.count).toBe('37');
    const clearMigration = await fixture.admin.query<{ checksum: string; finished_at: Date | null }>('SELECT checksum, finished_at FROM public._prisma_migrations WHERE migration_name=$1', ['20260922120000_035_add_global_chat_generation']);
    expect(clearMigration.rows).toHaveLength(1);
    expect(clearMigration.rows[0]?.checksum).toBe(migrationChecksum('prisma/migrations/20260922120000_035_add_global_chat_generation/migration.sql'));
    expect(clearMigration.rows[0]?.finished_at).not.toBeNull();
    const state = await fixture.admin.query<{ relrowsecurity: boolean }>("SELECT relrowsecurity FROM pg_class WHERE oid='public.global_chat_state'::regclass");
    expect(state.rows[0]?.relrowsecurity).toBe(true);
    const stateGrants = await fixture.admin.query("SELECT grantee FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name='global_chat_state' AND grantee IN ('anon','authenticated')");
    expect(stateGrants.rows).toHaveLength(0);
    const newTables = await fixture.admin.query<{ relname: string; relrowsecurity: boolean }>("SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('global_chat_mentions','global_chat_reports')");
    expect(newTables.rows).toHaveLength(2);
    expect(newTables.rows.every(row => row.relrowsecurity)).toBe(true);
    const newGrants = await fixture.admin.query("SELECT grantee FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name IN ('global_chat_mentions','global_chat_reports') AND grantee IN ('anon','authenticated')");
    expect(newGrants.rows).toHaveLength(0);
    const newConstraints = await fixture.admin.query<{ conname: string; contype: string; confdeltype: string }>("SELECT conname, contype::text, confdeltype::text FROM pg_constraint WHERE conrelid IN ('public.global_chat_mentions'::regclass, 'public.global_chat_reports'::regclass)");
    expect(newConstraints.rows.filter(row => row.contype === 'f')).toHaveLength(5);
    expect(newConstraints.rows.filter(row => row.contype === 'f').every(row => row.confdeltype === 'r')).toBe(true);
    expect(newConstraints.rows.map(row => row.conname)).toEqual(expect.arrayContaining(['global_chat_mentions_pkey', 'global_chat_reports_reporter_player_id_fkey', 'global_chat_reports_other_player_check']));
    const newIndexes = await fixture.admin.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN ('global_chat_mentions','global_chat_reports')");
    expect(newIndexes.rows.map(row => row.indexname)).toEqual(expect.arrayContaining(['global_chat_mentions_player_created_idx', 'global_chat_reports_reporter_message_key', 'global_chat_reports_message_idx', 'global_chat_reports_reported_created_idx']));
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

  it('clears only for active moderator or admin, keeps audit history, and fences player-facing operations', async () => {
    const author = await player(), moderator = await player(), admin = await player(), tester = await player(), ordinary = await player();
    await db.playerRoleAssignment.createMany({ data: [
      { playerId: moderator, role: 'MODERATOR' }, { playerId: admin, role: 'ADMIN' }, { playerId: tester, role: 'TESTER' },
    ] });
    const before = await service.send(as(author), 'Avant clear', randomUUID());
    const command = await service.send(as(author), '!help', randomUUID());
    const page = await service.list(as(author), 1);
    await expect(dispatcher.clear(as(tester), '!clear', randomUUID())).rejects.toMatchObject({ code: 'CHAT_FORBIDDEN' });
    await expect(dispatcher.clear(as(ordinary), '!clear', randomUUID())).rejects.toMatchObject({ code: 'CHAT_FORBIDDEN' });
    const key = randomUUID();
    expect(await dispatcher.clear(as(moderator), '!clear', key)).toMatchObject({ cleared: true, generation: 1, replayed: false });
    expect(await dispatcher.clear(as(moderator), '!clear', key)).toMatchObject({ generation: 1, replayed: true });
    expect(await db.globalChatMessage.findUnique({ where: { id: before.message.id } })).not.toBeNull();
    expect(await db.globalChatMessage.count({ where: { content: '!clear' } })).toBe(0);
    expect((await service.list(as(author))).messages).toHaveLength(0);
    expect(await service.list(as(author), 1, page.nextCursor ?? { createdAt: before.message.createdAt, id: before.message.id })).toMatchObject({ messages: [], nextCursor: null, generation: 1 });
    expect(await service.unreadCount(as(author))).toEqual({ unreadCount: 0, generation: 1 });
    await expect(service.markRead(as(author), before.message.id)).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
    await expect(service.deleteOwn(as(author), before.message.id)).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
    await expect(service.send(as(author), 'stale reply', randomUUID(), before.message.id)).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
    await expect(service.report(as(moderator), before.message.id)).rejects.toMatchObject({ code: 'CHAT_UNAVAILABLE' });
    await service.publishGameResult(command.message.id, 'Old answer');
    expect((await service.list(as(author))).messages).toHaveLength(0);
    const next = await service.send(as(author), 'Après clear', randomUUID());
    expect((await service.list(as(author))).messages.map(row => row.id)).toContain(next.message.id);
    expect((await service.unreadCount(as(moderator))).unreadCount).toBe(1);
    const operation = await db.businessOperation.findFirstOrThrow({ where: { operationType: 'chat.clear', idempotencyKey: key } });
    expect(operation).toMatchObject({ playerId: moderator, status: 'COMPLETED' });
    expect(operation.resultSummary).toMatchObject({ generation: 1, previousGeneration: 0 });
    const concurrent = await Promise.all([service.send(as(author), 'Concurrent', randomUUID()), dispatcher.clear(as(admin), '!clear', randomUUID())]);
    const current = await service.list(as(author));
    expect(current.messages.some(row => row.id === concurrent[0].message.id)).toBe(concurrent[0].generation === concurrent[1].generation);
    await db.playerRoleAssignment.updateMany({ where: { playerId: moderator, role: 'MODERATOR' }, data: { revokedAt: new Date() } });
    await expect(dispatcher.clear(as(moderator), '!clear', randomUUID())).rejects.toMatchObject({ code: 'CHAT_FORBIDDEN' });
  }, 60_000);

  it('discovers the first message without an anchor, orders later messages, and separates known deletions', async () => {
    const author = await player(), reader = await player(), moderator = await player();
    await db.playerRoleAssignment.create({ data: { playerId: moderator, role: 'MODERATOR' } });
    const cleared = await dispatcher.clear(as(moderator), '!clear', randomUUID());
    expect(await service.updates(as(reader), cleared.generation)).toEqual({ generation: cleared.generation, reset: false, messages: [], changes: [] });
    const key = randomUUID();
    const first = await service.send(as(author), 'Premier', key);
    const initial = await service.updates(as(author), cleared.generation);
    expect(initial.messages.map(row => row.id)).toEqual([first.message.id]);
    expect(initial.messages[0]?.clientIntentKey).toBe(key);
    expect((await service.updates(as(reader), cleared.generation)).messages[0]?.clientIntentKey).toBeNull();
    advance(1);
    const second = await service.send(as(author), 'Second', randomUUID());
    advance(1);
    const third = await service.send(as(author), 'Troisième', randomUUID());
    const anchor = { createdAt: first.message.createdAt, id: first.message.id };
    expect(await service.updates(as(reader), cleared.generation, { ...anchor, createdAt: '2000-01-01T00:00:00.000Z' })).toEqual({ generation: cleared.generation, reset: true, messages: [], changes: [] });
    const newer = await service.updates(as(reader), cleared.generation, anchor, [first.message.id]);
    expect(newer.messages.map(row => row.id)).toEqual([second.message.id, third.message.id]);
    expect(newer.changes).toEqual([]);
    await service.deleteOwn(as(author), first.message.id);
    const deleted = await service.updates(as(reader), cleared.generation, anchor, [first.message.id]);
    expect(deleted.messages.map(row => row.id)).toEqual([second.message.id, third.message.id]);
    expect(deleted.changes).toMatchObject([{ id: first.message.id, deletionState: 'AUTHOR', content: null }]);
    expect((await service.updates(as(reader), cleared.generation, anchor, [])).changes).toEqual([]);
    expect(await service.updates(as(reader), cleared.generation - 1, anchor)).toEqual({ generation: cleared.generation, reset: true, messages: [], changes: [] });
  }, 40_000);

  it('bounds every player-facing path to the latest 200 rows while retaining older database rows', async () => {
    const author = await player(), moderator = await player();
    await db.playerRoleAssignment.create({ data: { playerId: moderator, role: 'MODERATOR' } });
    const { generation } = await dispatcher.clear(as(moderator), '!clear', randomUUID());
    const oldIds = Array.from({ length: 110 }, () => randomUUID());
    await db.globalChatMessage.createMany({ data: oldIds.map((id, index) => ({ id, authorPlayerId: author, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: `ancien ${index}`, createdAt: new Date(now.getTime() + index), generation, deletedAt: now, deletionState: 'AUTHOR' })) });
    const anchor = await db.globalChatMessage.create({ data: { authorPlayerId: author, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: 'ancre', createdAt: new Date(now.getTime() + 200), generation } });
    const newIds = Array.from({ length: 101 }, () => randomUUID());
    await db.globalChatMessage.createMany({ data: newIds.map((id, index) => ({ id, authorPlayerId: author, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: `nouveau ${index}`, createdAt: new Date(now.getTime() + 300 + index), generation })) });
    const page = await service.updates(as(author), generation, { createdAt: anchor.createdAt.toISOString(), id: anchor.id }, oldIds);
    expect(page.messages).toHaveLength(100);
    expect(page.messages.map(row => row.id)).toEqual(newIds.slice(0, 100));
    expect(page.changes).toHaveLength(98);
    const last = page.messages.at(-1)!;
    const tail = await service.updates(as(author), generation, { createdAt: last.createdAt, id: last.id });
    expect(tail.messages.map(row => row.id)).toEqual(newIds.slice(100));
    expect(tail.changes).toEqual([]);
    let cursor: { createdAt: string; id: string } | undefined, visible: string[] = [];
    do { const result = await service.list(as(author), 100, cursor); visible = [...visible, ...result.messages.map(row => row.id)]; cursor = result.nextCursor ?? undefined; } while (cursor);
    expect(visible).toHaveLength(200);
    expect(await db.globalChatMessage.count({ where: { generation } })).toBe(212);
    expect(visible).not.toContain(oldIds[0]);
    expect((await service.unreadCount(as(author))).unreadCount).toBe(200);
  }, 40_000);

  it('ranks empty mention suggestions by current-generation authors, connected sessions, then name', async () => {
    const viewer = await player(), blocked = await player(), oldAuthor = await player(), moderator = await player();
    const recent1 = await player(), recent2 = await player(), connected1 = await player(), connected2 = await player();
    const alphaA = await player(), alphaB = await player();
    const names = [
      [viewer, 'Aaa Viewer'], [blocked, 'Aaa Blocked'], [oldAuthor, 'Zzz Old'],
      [recent1, 'Recent One'], [recent2, 'Recent Two'], [connected1, 'Connected One'],
      [connected2, 'Connected Two'], [alphaA, 'Aaa Alpha'], [alphaB, 'Bbb Beta'],
    ] as const;
    for (const [id, displayName] of names) await db.player.update({ where: { id }, data: { displayName } });
    await db.playerBlock.create({ data: { blockerPlayerId: blocked, blockedPlayerId: viewer } });
    await db.playerRoleAssignment.create({ data: { playerId: moderator, role: 'MODERATOR' } });
    const oldGeneration = (await db.globalChatState.findUnique({ where: { id: 1 } }))?.generation ?? 0;
    await db.globalChatMessage.create({ data: { authorPlayerId: oldAuthor, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: 'ancien', createdAt: new Date(now.getTime() + 30_000), generation: oldGeneration } });
    const { generation } = await dispatcher.clear(as(moderator), '!clear', randomUUID());
    expect(generation).toBe(oldGeneration + 1);
    await db.globalChatMessage.createMany({ data: [
      { authorPlayerId: recent1, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: 'premier', createdAt: new Date(now.getTime() + 1_000), generation },
      { authorPlayerId: recent2, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: 'dernier', createdAt: new Date(now.getTime() + 2_000), generation },
      { authorPlayerId: blocked, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: 'bloqué', createdAt: new Date(now.getTime() + 3_000), generation },
      { authorPlayerId: viewer, sourceChannel: 'INTERNAL_CHAT', messageType: 'PLAYER', content: 'moi', createdAt: new Date(now.getTime() + 4_000), generation },
    ] });
    const session = async (id: string, secondsAgo: number) => db.playerSession.create({ data: { playerId: id, sessionTokenHash: createHash('sha256').update(randomUUID()).digest('hex'), startedAt: new Date(now.getTime() - 60_000), lastHeartbeatAt: new Date(now.getTime() - secondsAgo * 1_000) } });
    const olderSession = await session(connected1, 40);
    await session(connected2, 10);
    expect((await service.searchMentions(as(viewer), '')).players.map(item => item.id)).toEqual([recent2, recent1, connected2, connected1, alphaA]);
    await db.playerSession.update({ where: { id: olderSession.id }, data: { endedAt: now } });
    expect((await service.searchMentions(as(viewer), '')).players.map(item => item.id)).toEqual([recent2, recent1, connected2, alphaA, alphaB]);
  }, 30_000);
});
