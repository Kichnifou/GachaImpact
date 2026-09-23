import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DirectMessageService } from '../src/application/direct-messages/direct-message-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase();
const db = fixture.database;
let now = new Date('2097-09-22T12:00:00.000Z');
const clock = { now: () => now };
const getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db));
const service = new DirectMessageService(db, getPlayer, clock);
const as = (subject: string) => ({ subject });
const advance = (milliseconds = 10_001) => { now = new Date(now.getTime() + milliseconds); };

async function player(label: string) {
  const id = randomUUID();
  await db.player.create({ data: { id, displayName: label, webIdentity: { create: { provider: 'supabase', providerSubject: id } } } });
  return id;
}

beforeAll(async () => fixture.setup(), 60_000);
afterAll(async () => fixture.cleanup(), 60_000);

describe('Direct-message foundations on isolated PostgreSQL', () => {
  it('searches active recipients by normalized name without exposing self and caps the lightweight result', async () => {
    const viewer = await player('Search Viewer');
    const matching = await player('Éléa 02');
    await player('Elea 10');
    const inactive = await player('Elea inactive');
    await db.player.update({ where: { id: inactive }, data: { status: 'SUSPENDED' } });
    for (let index = 0; index < 20; index += 1) await player(`Elea ${String(index + 20).padStart(2, '0')}`);

    const result = await service.searchPlayers(as(viewer), '  eleA  ');

    expect(result.players).toHaveLength(20);
    expect(result.players[0]).toMatchObject({ id: matching, displayName: 'Éléa 02', elementKey: null });
    expect(result.players.some(candidate => candidate.id === viewer || candidate.id === inactive)).toBe(false);
    expect(Object.keys(result.players[0]!).sort()).toEqual(['displayName', 'elementKey', 'id']);
  }, 30_000);

  it('creates one pending first message, resolves it, pages, counts unread and keeps read receipts private when disabled', async () => {
    const alice = await player('Alice MP'), bob = await player('Bob MP');
    const key = randomUUID();
    const concurrent = await Promise.all([
      service.initiate(as(alice), bob, 'Bonjour Bob', key),
      service.initiate(as(alice), bob, 'Bonjour Bob', key),
    ]);
    const initiated = concurrent.find(result => !result.replayed)!;
    expect(concurrent.map(result => result.replayed).sort()).toEqual([false, true]);
    expect(concurrent[0]!.messageId).toBe(concurrent[1]!.messageId);
    expect(initiated).toMatchObject({ state: 'PENDING', replayed: false });
    expect(await service.initiate(as(alice), bob, 'Bonjour Bob', key)).toMatchObject({ messageId: initiated.messageId, replayed: true });
    await expect(service.send(as(alice), initiated.conversationId as string, 'Deuxième', randomUUID())).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_UNAVAILABLE' });
    expect(await service.list(as(bob))).toMatchObject({ conversations: [{ unreadCount: 1, request: { state: 'PENDING', senderPlayerId: alice } }] });

    const accepted = await service.resolve(as(bob), initiated.conversationId as string, initiated.requestId as string, 'ACCEPT', randomUUID());
    expect(accepted.state).toBe('ACCEPTED');
    advance();
    const sendKey = randomUUID();
    const sent = await service.send(as(alice), initiated.conversationId as string, 'Après accord', sendKey);
    expect(await service.send(as(alice), initiated.conversationId as string, 'Après accord', sendKey)).toMatchObject({ messageId: sent.messageId, replayed: true });
    const page = await service.messages(as(bob), initiated.conversationId as string, 1);
    expect(page.messages).toHaveLength(1);
    expect(page.messages[0]?.clientIntentKey).toBeNull();
    expect(page.nextCursor).not.toBeNull();
    const older = await service.messages(as(bob), initiated.conversationId as string, 1, page.nextCursor!);
    expect(older.messages).toHaveLength(1);
    expect((await service.unread(as(bob))).unreadCount).toBe(2);

    expect(await service.markRead(as(bob), initiated.conversationId as string, page.messages[0]!.id)).toMatchObject({ changed: true, lastReadMessageId: page.messages[0]!.id });
    const firstShared = (await service.messages(as(alice), initiated.conversationId as string)).messages.at(-1);
    expect(firstShared?.clientIntentKey).toBe(sendKey);
    expect(firstShared?.readByOther).toBe(true);
    expect(firstShared?.readByOtherAt).toBe(now.toISOString());
    expect(await service.markRead(as(bob), initiated.conversationId as string, older.messages[0]!.id)).toMatchObject({ changed: false, lastReadMessageId: page.messages[0]!.id });
    await service.setReadReceipts(as(bob), initiated.conversationId as string, false);
    expect((await service.messages(as(alice), initiated.conversationId as string)).messages.find(message => message.id === sent.messageId)?.readByOther).toBe(true);
    advance();
    const privateMessage = await service.send(as(alice), initiated.conversationId as string, 'Lecture interne seulement', randomUUID());
    const privateRead = await service.messages(as(bob), initiated.conversationId as string, 1);
    expect((await service.unread(as(bob))).unreadCount).toBe(1);
    await service.markRead(as(bob), initiated.conversationId as string, privateRead.messages[0]!.id);
    expect((await service.unread(as(bob))).unreadCount).toBe(0);
    let projected = (await service.messages(as(alice), initiated.conversationId as string)).messages;
    expect(projected.find(message => message.id === sent.messageId)?.readByOther).toBe(true);
    expect(projected.find(message => message.id === privateMessage.messageId)?.readByOther).toBe(false);
    await service.setReadReceipts(as(bob), initiated.conversationId as string, true);
    projected = (await service.messages(as(alice), initiated.conversationId as string)).messages;
    expect(projected.find(message => message.id === privateMessage.messageId)?.readByOther).toBe(false);
    expect(projected.find(message => message.id === privateMessage.messageId)?.readByOtherAt).toBeNull();
    advance();
    const resumedMessage = await service.send(as(alice), initiated.conversationId as string, 'Lecture partagée à nouveau', randomUUID());
    const resumedRead = await service.messages(as(bob), initiated.conversationId as string, 1);
    await service.markRead(as(bob), initiated.conversationId as string, resumedRead.messages[0]!.id);
    projected = (await service.messages(as(alice), initiated.conversationId as string)).messages;
    expect(projected.find(message => message.id === resumedMessage.messageId)?.readByOther).toBe(true);
    expect(projected.find(message => message.id === resumedMessage.messageId)?.readByOtherAt).toBe(now.toISOString());
    const outsider = await player('MP Outsider');
    await expect(service.messages(as(outsider), initiated.conversationId as string)).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_UNAVAILABLE' });
  }, 30_000);

  it('enforces PUBLIC/FRIENDS/PRIVATE, refusal cooldown, individual archive and reactivation on a new message', async () => {
    const sender = await player('Sender MP'), receiver = await player('Receiver MP');
    await db.privacySetting.create({ data: { playerId: receiver, categoryKey: 'PRIVATE_MESSAGES', level: 'FRIENDS' } });
    await expect(service.initiate(as(sender), receiver, 'Refusé', randomUUID())).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_FORBIDDEN' });
    const ids = [sender, receiver].sort();
    await db.friendship.create({ data: { playerAId: ids[0]!, playerBId: ids[1]!, state: 'ACTIVE' } });
    const direct = await service.initiate(as(sender), receiver, 'Entre amis', randomUUID());
    expect(direct.state).toBe('ACCEPTED');
    expect((await service.list(as(sender))).conversations[0]?.canSend).toBe(true);
    await service.archive(as(sender), direct.conversationId as string, true);
    expect((await service.list(as(sender), true)).conversations).toHaveLength(1);
    expect((await service.list(as(receiver))).conversations[0]?.archived).toBe(false);
    advance();
    await service.send(as(receiver), direct.conversationId as string, 'Réactivation', randomUUID());
    expect((await service.list(as(sender))).conversations[0]?.archived).toBe(false);
    await db.friendship.update({ where: { playerAId_playerBId: { playerAId: ids[0]!, playerBId: ids[1]! } }, data: { state: 'ARCHIVED', archivedAt: now } });
    expect((await service.messages(as(sender), direct.conversationId as string)).messages.length).toBeGreaterThan(0);
    expect((await service.list(as(sender))).conversations[0]?.canSend).toBe(false);
    advance();
    await expect(service.send(as(sender), direct.conversationId as string, 'Plus amis', randomUUID())).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_FORBIDDEN' });
    await db.friendship.update({ where: { playerAId_playerBId: { playerAId: ids[0]!, playerBId: ids[1]! } }, data: { state: 'ACTIVE', archivedAt: null } });
    await db.privacySetting.update({ where: { playerId_categoryKey: { playerId: receiver, categoryKey: 'PRIVATE_MESSAGES' } }, data: { level: 'PRIVATE' } });
    expect((await service.list(as(sender))).conversations[0]?.canSend).toBe(false);
    advance();
    await expect(service.send(as(sender), direct.conversationId as string, 'Privé', randomUUID())).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_FORBIDDEN' });
    await db.privacySetting.update({ where: { playerId_categoryKey: { playerId: receiver, categoryKey: 'PRIVATE_MESSAGES' } }, data: { level: 'PUBLIC' } });
    expect((await service.list(as(sender))).conversations[0]?.canSend).toBe(true);
  }, 30_000);

  it('refuses a repeated public request for 24 hours and lets the recipient block through the Social owner', async () => {
    const sender = await player('Request Sender'), receiver = await player('Request Receiver');
    const request = await service.initiate(as(sender), receiver, 'Demande', randomUUID());
    await service.resolve(as(receiver), request.conversationId as string, request.requestId as string, 'IGNORE', randomUUID());
    const refusedAt = now;
    const ids = [sender, receiver].sort();
    await db.friendship.create({ data: { playerAId: ids[0]!, playerBId: ids[1]!, state: 'ACTIVE' } });
    now = new Date(refusedAt.getTime() + 86_400_000 - 1);
    await expect(service.initiate(as(sender), receiver, 'Trop tôt', randomUUID())).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_RETRY_LATER' });
    now = new Date(refusedAt.getTime() + 86_400_000);
    const retry = await service.initiate(as(sender), receiver, 'Nouvelle demande', randomUUID());
    expect(retry).toMatchObject({ state: 'ACCEPTED', requestId: null });
    expect(await service.block(as(receiver), retry.conversationId as string, randomUUID())).toMatchObject({ blocked: true, changed: true });
    expect(await db.playerBlock.count({ where: { blockerPlayerId: receiver, blockedPlayerId: sender } })).toBe(1);
    expect((await db.friendship.findUniqueOrThrow({ where: { playerAId_playerBId: { playerAId: ids[0]!, playerBId: ids[1]! } } })).state).toBe('ARCHIVED');
    const archivedParticipants = await db.directConversationParticipant.findMany({ where: { conversationId: retry.conversationId as string }, select: { archivedAt: true } });
    expect(archivedParticipants.every(participant => participant.archivedAt !== null)).toBe(true);
    expect((await service.list(as(receiver), true)).conversations[0]).toMatchObject({ archived: true, blockedByMe: true, canSend: false });
    expect((await service.list(as(sender), true)).conversations[0]).toMatchObject({ archived: true, blockedByMe: false, canSend: false });
    await expect(service.send(as(sender), retry.conversationId as string, 'Bloqué', randomUUID())).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_FORBIDDEN', message: 'Ce message ne peut pas être envoyé.' });
    expect(await service.unblock(as(receiver), retry.conversationId as string, randomUUID())).toMatchObject({ blocked: false, changed: true });
    expect(await db.playerBlock.count({ where: { blockerPlayerId: receiver, blockedPlayerId: sender } })).toBe(0);
    expect((await db.friendship.findUniqueOrThrow({ where: { playerAId_playerBId: { playerAId: ids[0]!, playerBId: ids[1]! } } })).state).toBe('ARCHIVED');
    expect((await service.list(as(receiver), true)).conversations[0]).toMatchObject({ archived: true, blockedByMe: false });
    expect((await service.list(as(sender), true)).conversations[0]).toMatchObject({ archived: true, blockedByMe: false });
    await db.friendship.update({ where: { playerAId_playerBId: { playerAId: ids[0]!, playerBId: ids[1]! } }, data: { state: 'ACTIVE', archivedAt: null } });
    advance();
    await service.send(as(sender), retry.conversationId as string, 'Nouvelle activité autorisée', randomUUID());
    expect((await service.list(as(sender))).conversations[0]?.archived).toBe(false);
    expect((await service.list(as(receiver))).conversations[0]?.archived).toBe(false);
  }, 30_000);

  it('serializes opposite requests and lets only one concurrent request transition win', async () => {
    const alice = await player('Opposite Alice'), bob = await player('Opposite Bob');
    const attempts = await Promise.allSettled([
      service.initiate(as(alice), bob, 'Depuis Alice', randomUUID()),
      service.initiate(as(bob), alice, 'Depuis Bob', randomUUID()),
    ]);
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter(result => result.status === 'rejected')).toHaveLength(1);
    const winner = attempts.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof service.initiate>>> => result.status === 'fulfilled')!.value;
    expect(await db.directConversation.count({ where: { id: winner.conversationId as string } })).toBe(1);
    expect(await db.directConversationRequest.count({ where: { conversationId: winner.conversationId as string, state: 'PENDING' } })).toBe(1);
    expect(await db.directMessage.count({ where: { conversationId: winner.conversationId as string } })).toBe(1);
    const recipient = (await db.directConversationRequest.findUniqueOrThrow({ where: { id: winner.requestId as string } })).recipientPlayerId;
    const transitions = await Promise.allSettled([
      service.resolve(as(recipient), winner.conversationId as string, winner.requestId as string, 'ACCEPT', randomUUID()),
      service.resolve(as(recipient), winner.conversationId as string, winner.requestId as string, 'IGNORE', randomUUID()),
    ]);
    expect(transitions.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(transitions.filter(result => result.status === 'rejected')).toHaveLength(1);
  }, 30_000);

  it('rejects inactive recipients, preserves multiline text up to 1,000 characters and enforces blocks in both directions', async () => {
    const sender = await player('Validation Sender'), inactive = await player('Inactive Receiver');
    await db.player.update({ where: { id: inactive }, data: { status: 'SUSPENDED' } });
    await expect(service.initiate(as(sender), inactive, 'Impossible', randomUUID())).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_FORBIDDEN' });

    const receiver = await player('Validation Receiver');
    const ids = [sender, receiver].sort();
    await db.friendship.create({ data: { playerAId: ids[0]!, playerBId: ids[1]!, state: 'ACTIVE' } });
    const content = `${'a'.repeat(499)}\n${'b'.repeat(500)}`;
    const direct = await service.initiate(as(sender), receiver, content, randomUUID());
    expect((await db.directMessage.findUniqueOrThrow({ where: { id: direct.messageId as string } })).content).toBe(content);
    await expect(service.send(as(sender), direct.conversationId as string, 'x'.repeat(1001), randomUUID())).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_INVALID' });
    await service.block(as(sender), direct.conversationId as string, randomUUID());
    advance();
    await expect(service.send(as(receiver), direct.conversationId as string, 'Blocage émetteur', randomUUID())).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_FORBIDDEN', message: 'Ce message ne peut pas être envoyé.' });
  }, 30_000);

  it('limits direct sends to ten in ten seconds and keeps durable rows beyond the 500-message projection window', async () => {
    const sender = await player('Rate Sender'), receiver = await player('Rate Receiver');
    const ids = [sender, receiver].sort();
    await db.friendship.create({ data: { playerAId: ids[0]!, playerBId: ids[1]!, state: 'ACTIVE' } });
    const direct = await service.initiate(as(sender), receiver, '0', randomUUID());
    for (let index = 1; index < 10; index += 1) await service.send(as(sender), direct.conversationId as string, String(index), randomUUID());
    await expect(service.send(as(sender), direct.conversationId as string, '10', randomUUID())).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_RATE_LIMIT' });
    advance();
    expect((await service.send(as(sender), direct.conversationId as string, 'repris', randomUUID())).replayed).toBe(false);
    const bulk = Array.from({ length: 501 }, (_, index) => ({ id: randomUUID(), messageId: randomUUID(), createdAt: new Date(now.getTime() + index + 1), content: `persisté-${index}` }));
    await db.businessOperation.createMany({ data: bulk.map(row => ({ id: row.id, playerId: sender, sourceChannel: 'UI', operationType: 'direct-message.fixture', status: 'COMPLETED', startedAt: row.createdAt, completedAt: row.createdAt, resultSummary: {} })) });
    await db.directMessage.createMany({ data: bulk.map(row => ({ id: row.messageId, conversationId: direct.conversationId as string, authorPlayerId: sender, content: row.content, operationId: row.id, createdAt: row.createdAt })) });
    expect(await db.directMessage.count({ where: { conversationId: direct.conversationId as string } })).toBe(512);
    let cursor: { id: string; createdAt: string } | undefined, visible = 0;
    do { const page = await service.messages(as(receiver), direct.conversationId as string, 100, cursor); visible += page.messages.length; cursor = page.nextCursor ?? undefined; } while (cursor);
    expect(visible).toBe(500);
  }, 90_000);

  it('keeps reservation order when private message A commits after B', async () => {
    const alice = await player('Ordered Alice'), bob = await player('Ordered Bob');
    const ids = [alice, bob].sort();
    await db.friendship.create({ data: { playerAId: ids[0]!, playerBId: ids[1]!, state: 'ACTIVE' } });
    const conversation = await service.initiate(as(alice), bob, 'Initial', randomUUID());
    advance();
    let releaseA!: () => void, announceA!: () => void;
    const aReserved = new Promise<void>(resolve => { announceA = resolve; });
    const aGate = new Promise<void>(resolve => { releaseA = resolve; });
    let reservations = 0;
    const controlled = new DirectMessageService(db, getPlayer, clock, undefined, async () => {
      reservations += 1;
      if (reservations === 1) { announceA(); await aGate; }
    });
    const pendingA = controlled.send(as(alice), conversation.conversationId as string, 'A réservé en premier', randomUUID());
    await aReserved;
    const sentB = await controlled.send(as(bob), conversation.conversationId as string, 'B validé en premier', randomUUID());
    releaseA();
    const sentA = await pendingA;
    const rows = await db.directMessage.findMany({ where: { id: { in: [sentA.messageId, sentB.messageId] } }, orderBy: { submissionOrder: 'asc' } });
    expect(rows.map(row => row.id)).toEqual([sentA.messageId, sentB.messageId]);
    const visible = (await service.messages(as(alice), conversation.conversationId as string)).messages.filter(message => [sentA.messageId, sentB.messageId].includes(message.id));
    expect(visible.map(message => message.id)).toEqual([sentA.messageId, sentB.messageId]);
    expect((await service.list(as(alice))).conversations[0]?.lastMessage?.id).toBe(sentB.messageId);
  }, 30_000);

  it('rolls back the message, conversation and durable operation when activity recording fails', async () => {
    const sender = await player('Rollback Sender'), receiver = await player('Rollback Receiver');
    const key = randomUUID();
    const failing = new DirectMessageService(db, new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)), clock, {
      record: async () => { throw new Error('activity unavailable'); },
    } as never);

    await expect(failing.initiate(as(sender), receiver, 'Tout doit revenir en arrière', key)).rejects.toThrow('activity unavailable');
    expect(await db.directConversation.count({ where: { OR: [{ playerAId: sender, playerBId: receiver }, { playerAId: receiver, playerBId: sender }] } })).toBe(0);
    expect(await db.directMessage.count({ where: { authorPlayerId: sender } })).toBe(0);
    expect(await db.businessOperation.count({ where: { sourceChannel: 'UI', idempotencyKey: key } })).toBe(0);
  }, 30_000);
});
