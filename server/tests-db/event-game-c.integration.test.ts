import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, afterEach, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { EventService } from '../src/application/event/event-service.js';
import { ChatCommandDispatcher, type ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';
import { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import { EventMessageNotificationReconciler } from '../src/application/notification/event-message-notifications.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Event Game C DB tests.');
const isolated = isolatedBatchDatabase();
const database = isolated.database;
beforeAll(() => isolated.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => isolated.cleanup(), 60_000);
const store = new PrismaCurrentPlayerStore(database);
const provision = new GetOrProvisionCurrentPlayer(store);
const getPlayer = new GetCurrentPlayer(store);
const playerIds: string[] = [];
const editionIds: string[] = [];
const cosmeticIds: string[] = [];
let year = 2190;
let now = new Date(`${year}-09-15T12:00:00.000Z`);
const service = new EventService(getPlayer, database, { now: () => now }, { nextInt: () => 0 });

async function fixture(name = 'Game C') {
  const identity = { subject: `codex-game-c-${randomUUID()}` };
  const created = await provision.execute(identity, `${name} ${randomUUID().slice(0, 8)}`);
  playerIds.push(created.player.id);
  return { identity, playerId: created.player.id, displayName: created.player.displayName };
}
async function view(player: Awaited<ReturnType<typeof fixture>>) {
  const result = await service.getCurrent(player.identity);
  if (!editionIds.includes(result.edition.id)) editionIds.push(result.edition.id);
  return result;
}
async function join(player: Awaited<ReturnType<typeof fixture>>) { await view(player); return service.join(player.identity, randomUUID()); }
async function send(sender: Awaited<ReturnType<typeof fixture>>, recipient: Awaited<ReturnType<typeof fixture>>, message = 'Un panier pour toi', key = randomUUID()) {
  return service.sendGameC(sender.identity, recipient.playerId, message, key);
}

afterEach(async () => {
  if (editionIds.length) {
    const ids = editionIds.splice(0);
    await database.eventSocialMessage.deleteMany({ where: { eventEditionId: { in: ids } } });
    await database.eventGameBDailyState.deleteMany({ where: { eventEditionId: { in: ids } } });
    await database.eventDailyPlayerState.deleteMany({ where: { eventEditionId: { in: ids } } });
    await database.eventParticipant.deleteMany({ where: { eventEditionId: { in: ids } } });
    await database.eventEdition.deleteMany({ where: { id: { in: ids } } });
  }
  if (playerIds.length) {
    const ids = playerIds.splice(0);
    const commands = await database.globalChatMessage.findMany({ where: { authorPlayerId: { in: ids } }, select: { id: true } });
    const commandIds = commands.map(command => command.id);
    if (commandIds.length) {
      await database.globalChatMessage.deleteMany({ where: { replyToMessageId: { in: commandIds } } });
      await database.globalChatMessage.deleteMany({ where: { id: { in: commandIds } } });
    }
    await database.notification.deleteMany({ where: { playerId: { in: ids }, typeKey: 'EVENT_MESSAGES_PENDING' } });
    await database.friendship.deleteMany({ where: { OR: [{ playerAId: { in: ids } }, { playerBId: { in: ids } }] } });
    await database.playerBlock.deleteMany({ where: { OR: [{ blockerPlayerId: { in: ids } }, { blockedPlayerId: { in: ids } }] } });
    await database.playerEventCurrencyBalance.deleteMany({ where: { playerId: { in: ids } } });
    await database.businessOperation.deleteMany({ where: { playerId: { in: ids }, OR: [{ operationType: { startsWith: 'event.' } }, { operationType: 'chat.send' }] } });
    await database.webIdentity.deleteMany({ where: { playerId: { in: ids } } });
    await database.player.deleteMany({ where: { id: { in: ids } } });
  }
  if (cosmeticIds.length) await database.cosmeticDefinition.deleteMany({ where: { id: { in: cosmeticIds.splice(0) } } });
  year += 1;
  now = new Date(`${year}-09-15T12:00:00.000Z`);
});
afterAll(async () => database.$disconnect());

describe('Event Game C with isolated future editions and fixture Players', () => {
  it('projects a recipient equipped avatar in the same candidate query', async () => {
    const sender = await fixture('Sender'); const recipient = await fixture('Recipient');
    await join(sender);
    const cosmetic = await database.cosmeticDefinition.create({ data: { externalKey: `test-event-avatar-${randomUUID()}`, type: 'AVATAR', displayName: 'Fixture avatar', assetPath: '/assets/fixture/event.png' } });
    cosmeticIds.push(cosmetic.id);
    await database.playerCosmetic.create({ data: { playerId: recipient.playerId, cosmeticId: cosmetic.id, unlockSource: 'TEST' } });
    await database.player.update({ where: { id: recipient.playerId }, data: { equippedAvatarCosmeticId: cosmetic.id } });
    const result = await service.searchGameCRecipients(sender.identity, { q: recipient.displayName, sort: 'name', direction: 'asc', page: 1 });
    expect(result.recipients.find(candidate => candidate.playerId === recipient.playerId)).toMatchObject({ avatarAssetPath: '/assets/fixture/event.png' });
  }, 30_000);
  it('runs Game C through public Chat and the same Event state, with exact text, replay and business refusal', async () => {
    const sender = await fixture('Sender'); const recipient = await fixture('Recipient');
    await join(sender); await view(recipient);
    const theme = (await view(sender)).gameC.theme.label;
    const chat = new GlobalChatService(database, getPlayer, { now: () => now }, { nextInt: () => 0 });
    const dispatcher = new ChatCommandDispatcher(chat, { eventService: service } as unknown as ChatCommandServices);
    const content = `!event ${theme} ${recipient.displayName} "Message exact du Jeu C"`;
    const key = randomUUID();
    const first = await dispatcher.send(sender.identity, content, key);
    expect(first.message).toMatchObject({ messageType: 'COMMAND', content, author: { id: sender.playerId } });
    expect(first.xpGranted).toBe(0);
    expect(first.result).toMatchObject({ messageType: 'GAME_RESULT', sourceChannel: 'SYSTEM', replyToMessageId: first.message.id });
    expect(first.result?.content).toContain(`${theme} envoyé à ${recipient.displayName}`);
    const eventMessage = await database.eventSocialMessage.findFirstOrThrow({ where: { senderPlayerId: sender.playerId, recipientPlayerId: recipient.playerId } });
    expect(eventMessage.content).toBe('Message exact du Jeu C');
    expect((await view(recipient)).gameC.receivedMessages).toEqual(expect.arrayContaining([expect.objectContaining({ message: 'Message exact du Jeu C' })]));
    const operation = await database.businessOperation.findFirstOrThrow({ where: { playerId: sender.playerId, operationType: 'event.game-c.send', idempotencyKey: first.message.id } });
    expect(operation.status).toBe('COMPLETED');
    const replay = await dispatcher.send(sender.identity, content, key);
    expect(replay.message.id).toBe(first.message.id);
    expect(replay.result?.id).toBe(first.result?.id);
    expect(await database.eventSocialMessage.count({ where: { senderPlayerId: sender.playerId } })).toBe(1);
    now = new Date(now.getTime() + 1_000);
    const refused = await dispatcher.send(sender.identity, `!event ${theme} ${recipient.displayName} "Deuxième message"`, randomUUID());
    expect(refused.result).toMatchObject({ messageType: 'GAME_RESULT', sourceChannel: 'SYSTEM' });
    expect(refused.result?.content).toContain('déjà');
    expect(await database.eventSocialMessage.count({ where: { senderPlayerId: sender.playerId } })).toBe(1);
    expect(await database.businessOperation.count({ where: { playerId: sender.playerId, operationType: 'event.game-c.send' } })).toBe(1);
  }, 30_000);

  it('sends to an unregistered recipient, rewards only the sender, and replays the same operation once', async () => {
    const sender = await fixture('Sender'); const recipient = await fixture('Recipient');
    await join(sender); await view(recipient);
    const key = randomUUID();
    const result = await send(sender, recipient, '  Bonjour !  ', key);
    expect(result.gameC).toMatchObject({ sentToday: true, canSend: false });
    expect(result.participation.points).toBe(1);
    expect(result.currency.amount).toBe('2');
    expect((await view(recipient)).gameC).toMatchObject({ available: true, unviewedCount: 1, receivedMessages: [{ sender: { id: sender.playerId }, message: 'Bonjour !', viewed: false }] });
    expect((await view(recipient)).participation.points).toBe(0);
    expect((await view(recipient)).currency.amount).toBe('0');
    expect((await send(sender, recipient, 'Bonjour !', key)).operation).toEqual({ id: result.operation.id, alreadyProcessed: true });
    expect(await database.eventSocialMessage.count({ where: { eventEditionId: result.edition.id } })).toBe(1);
    await expect(send(sender, recipient, 'Autre message', key)).rejects.toMatchObject({ code: 'EVENT_GAME_C_IDEMPOTENCY_CONFLICT' });
    await expect(send(sender, recipient)).rejects.toMatchObject({ code: 'EVENT_GAME_C_ALREADY_SENT' });
  }, 30_000);

  it('rejects invalid targets and text without consuming the daily action', async () => {
    const sender = await fixture('Sender'); const recipient = await fixture('Recipient');
    await join(sender);
    await expect(service.sendGameC(sender.identity, sender.playerId, 'bonjour', randomUUID())).rejects.toMatchObject({ code: 'EVENT_GAME_C_CONTACT_UNAVAILABLE' });
    await expect(service.sendGameC(sender.identity, randomUUID(), 'bonjour', randomUUID())).rejects.toMatchObject({ code: 'EVENT_GAME_C_CONTACT_UNAVAILABLE' });
    await expect(send(sender, recipient, '   ')).rejects.toMatchObject({ code: 'EVENT_GAME_C_INVALID_MESSAGE' });
    expect((await view(sender)).gameC.sentToday).toBe(false);
    expect((await send(sender, recipient)).gameC.sentToday).toBe(true);
    const nonParticipant = await fixture('Other');
    await expect(send(nonParticipant, recipient)).rejects.toMatchObject({ code: 'EVENT_NOT_JOINED' });
  }, 30_000);

  it('applies both block directions, Public/Friends/Private and moderation to search and send', async () => {
    const sender = await fixture('Sender'); const recipient = await fixture('Recipient');
    await join(sender);
    const search = () => service.searchGameCRecipients(sender.identity, { q: recipient.displayName.slice(0, 8), sort: 'name', direction: 'asc', page: 1 });
    expect((await search()).recipients.map(({ playerId }) => playerId)).toContain(recipient.playerId);
    await database.playerBlock.create({ data: { blockerPlayerId: sender.playerId, blockedPlayerId: recipient.playerId } });
    expect((await search()).recipients).toHaveLength(0);
    await expect(send(sender, recipient)).rejects.toMatchObject({ code: 'EVENT_GAME_C_CONTACT_UNAVAILABLE' });
    await database.playerBlock.deleteMany({ where: { blockerPlayerId: sender.playerId } });
    await database.playerBlock.create({ data: { blockerPlayerId: recipient.playerId, blockedPlayerId: sender.playerId } });
    expect((await search()).recipients).toHaveLength(0);
    await database.playerBlock.deleteMany({ where: { blockerPlayerId: recipient.playerId } });
    await database.privacySetting.update({ where: { playerId_categoryKey: { playerId: recipient.playerId, categoryKey: 'PRIVATE_MESSAGES' } }, data: { level: 'PRIVATE' } });
    expect((await search()).recipients).toHaveLength(0);
    await database.privacySetting.update({ where: { playerId_categoryKey: { playerId: recipient.playerId, categoryKey: 'PRIVATE_MESSAGES' } }, data: { level: 'FRIENDS' } });
    expect((await search()).recipients).toHaveLength(0);
    const [playerAId, playerBId] = sender.playerId < recipient.playerId ? [sender.playerId, recipient.playerId] : [recipient.playerId, sender.playerId];
    await database.friendship.create({ data: { playerAId, playerBId, state: 'ACTIVE' } });
    expect((await search()).recipients.map(({ playerId }) => playerId)).toContain(recipient.playerId);
    await database.player.update({ where: { id: recipient.playerId }, data: { status: 'SUSPENDED' } });
    expect((await search()).recipients).toHaveLength(0);
    await expect(send(sender, recipient)).rejects.toMatchObject({ code: 'EVENT_GAME_C_CONTACT_UNAVAILABLE' });
    await database.player.update({ where: { id: recipient.playerId }, data: { status: 'ACTIVE' } });
    await database.player.update({ where: { id: sender.playerId }, data: { status: 'SUSPENDED' } });
    expect((await view(sender)).gameC.canSend).toBe(false);
    await expect(send(sender, recipient)).rejects.toMatchObject({ code: 'EVENT_GAME_C_CONTACT_UNAVAILABLE' });
    expect((await view(sender)).gameC.sentToday).toBe(false);
  }, 30_000);

  it('allows one concurrent send per sender and private daily inbox consultation', async () => {
    const sender = await fixture('Sender'); const first = await fixture('First'); const second = await fixture('Second');
    await join(sender); await view(first); await view(second);
    const outcomes = await Promise.allSettled([send(sender, first), send(sender, second)]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(await database.eventSocialMessage.count({ where: { senderPlayerId: sender.playerId } })).toBe(1);
    const winner = (await view(first)).gameC.receivedMessages.length ? first : second;
    const loser = winner.playerId === first.playerId ? second : first;
    expect((await view(loser)).gameC.receivedMessages).toHaveLength(0);
    expect((await service.consultGameCMessages(winner.identity)).gameC.unviewedCount).toBe(0);
    expect((await view(winner)).gameC.receivedMessages[0]?.viewed).toBe(true);
    now = new Date(`${year}-09-16T12:00:00.000Z`);
    expect((await view(winner)).gameC.receivedMessages).toHaveLength(0);
    expect((await view(sender)).gameC.sentToday).toBe(false);
  }, 30_000);

  it('keeps five messages in one aggregate, resolves on consultation and reactivates on a later message', async () => {
    const recipient = await fixture('Recipient');
    const senders = [];
    for (let index = 0; index < 6; index += 1) senders.push(await fixture(`Sender ${index}`));
    for (const sender of senders) await join(sender);
    for (const sender of senders.slice(0, 5)) await send(sender, recipient);
    const edition = await view(recipient);
    const aggregate = await database.notification.findMany({ where: { playerId: recipient.playerId, typeKey: 'EVENT_MESSAGES_PENDING', state: { in: ['UNREAD', 'READ'] } } });
    expect(aggregate).toHaveLength(1);
    expect(aggregate[0]?.payload).toMatchObject({ count: 5 });
    expect(edition.gameC.unviewedCount).toBe(5);
    await database.notification.update({ where: { id: aggregate[0]!.id }, data: { state: 'READ', readAt: now } });
    await new EventMessageNotificationReconciler(database).reconcileNotificationsForPlayer(recipient.playerId, now);
    expect(await database.notification.findUnique({ where: { id: aggregate[0]!.id } })).toMatchObject({ state: 'READ', resolvedAt: null, archivedAt: null });
    await service.consultGameCMessages(recipient.identity);
    const consulted = await database.notification.findUnique({ where: { id: aggregate[0]!.id } });
    expect(consulted).toMatchObject({ state: 'RESOLVED', archivedAt: null });
    expect(consulted?.resolvedAt).not.toBeNull();
    await send(senders[5]!, recipient);
    const revived = await database.notification.findMany({ where: { playerId: recipient.playerId, typeKey: 'EVENT_MESSAGES_PENDING', state: { in: ['UNREAD', 'READ'] } } });
    expect(revived).toHaveLength(1);
    expect(revived[0]).toMatchObject({ id: aggregate[0]!.id, state: 'UNREAD', resolvedAt: null, archivedAt: null });
    expect(revived[0]?.payload).toMatchObject({ count: 1 });
    await database.notification.update({ where: { id: aggregate[0]!.id }, data: { state: 'ARCHIVED', archivedAt: now } });
    await new EventMessageNotificationReconciler(database).reconcileNotificationsForPlayer(recipient.playerId, now);
    expect(await database.notification.findUnique({ where: { id: aggregate[0]!.id } })).toMatchObject({ state: 'UNREAD', resolvedAt: null, archivedAt: null });
    now = new Date(`${year}-09-16T12:00:00.000Z`);
    await new EventMessageNotificationReconciler(database).reconcileNotificationsForPlayer(recipient.playerId, now);
    const afterRollover = await database.notification.findUnique({ where: { id: aggregate[0]!.id } });
    expect(afterRollover).toMatchObject({ state: 'RESOLVED', archivedAt: null });
    expect(afterRollover?.resolvedAt).not.toBeNull();
    await database.notification.update({ where: { id: aggregate[0]!.id }, data: { state: 'ARCHIVED', archivedAt: now } });
    await new EventMessageNotificationReconciler(database).reconcileNotificationsForPlayer(recipient.playerId, now);
    expect((await database.notification.findUnique({ where: { id: aggregate[0]!.id } }))?.state).toBe('ARCHIVED');
  }, 60_000);

  it('serializes two senders to one recipient without duplicate active notifications', async () => {
    const first = await fixture('First'); const second = await fixture('Second'); const recipient = await fixture('Recipient');
    await join(first); await join(second);
    const results = await Promise.allSettled([send(first, recipient), send(second, recipient)]);
    expect(results.map(({ status }) => status)).toEqual(['fulfilled', 'fulfilled']);
    expect((await view(recipient)).gameC.unviewedCount).toBe(2);
    const active = await database.notification.findMany({ where: { playerId: recipient.playerId, typeKey: 'EVENT_MESSAGES_PENDING', state: { in: ['UNREAD', 'READ'] } } });
    expect(active).toHaveLength(1);
    expect(active[0]?.payload).toMatchObject({ count: 2 });
  }, 45_000);

});
