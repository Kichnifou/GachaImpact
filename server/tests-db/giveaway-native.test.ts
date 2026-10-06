import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { GiveawayService } from '../src/application/giveaway/giveaway-service.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { TwitchGiveawayCredentialCipher } from '../src/infrastructure/twitch/twitch-giveaway-credential-cipher.js';
import { TwitchGiveawaySendError } from '../src/infrastructure/twitch/twitch-giveaway-chat-client.js';
import { TwitchGiveawayManager } from '../src/application/twitch/twitch-giveaway-manager.js';
import { TwitchGiveawayConsumer } from '../src/application/twitch/twitch-giveaway-consumer.js';
import type { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';
import { giftConfig, giftKey } from '../tests/helpers/twitch-gift-fixture.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
let active = true;
const bridge = { assertActive: async () => { if (!active) throw new Error('bridge off'); },
  status: async () => ({ available: true, authorized: true, enabled: true, active, pending: false }) };
const service = new GiveawayService(db, bridge, () => new Date(), () => 0);
let adminId: string;
let adminTwitchId: string;
let twitchId = 1000;
beforeAll(async () => {
  await fixture.setup({ prismaMigrations: true });
  const admin = await player('Giveaway Admin', 'hydro', 'ADMIN'); adminId = admin.id; adminTwitchId = admin.twitchUserId;
  const encryptedRefreshToken = new TwitchGiveawayCredentialCipher(giftKey).encrypt('private-refresh', admin.id, adminTwitchId);
  await db.twitchGiveawayCredential.create({ data: { playerId: admin.id, twitchUserId: adminTwitchId, encryptedRefreshToken,
    scopes: ['openid', 'user:read:chat', 'user:bot', 'channel:bot', 'user:write:chat'], enabled: true } });
}, 180_000);
afterAll(() => fixture.cleanup(), 60_000);

async function player(displayName: string, elementKey: string | null = 'pyro', role?: 'ADMIN' | 'MODERATOR' | 'TESTER', status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE') {
  const created = await db.player.create({ data: { displayName, elementKey, status, progression: { create: { xp: 0n } },
    economyStats: { create: {} }, resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) } } });
  if (role) await db.playerRoleAssignment.create({ data: { playerId: created.id, role, source: 'private-giveaway-test' } });
  const playerTwitchId = String(++twitchId);
  await db.twitchIdentity.create({ data: { playerId: created.id, twitchUserId: playerTwitchId, login: displayName.toLowerCase().replaceAll(' ', '_') } });
  return { ...created, twitchUserId: playerTwitchId };
}
const message = (twitchUserId: string, twitchMessageId = randomUUID()) => service.countMessage({ twitchUserId, twitchMessageId, observedAt: new Date(Date.now() + 1000) });
const close = (sessionId: string) => service.close(adminId, 'ADMIN', sessionId, `admin:${randomUUID()}`);

describe('Giveaway native runtime, private PostgreSQL schema', () => {
  it('tracks exactly the repository migrations, RLS/revoke and one OPEN constraint', async () => {
    const migrations = await fixture.admin.query('SELECT migration_name FROM _prisma_migrations ORDER BY migration_name');
    const expected = readdirSync(new URL('../prisma/migrations/', import.meta.url), { withFileTypes: true })
      .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
    expect(migrations.rows.map(row => row.migration_name)).toEqual(expected);
    expect(expected.some(name => name.includes('_056_'))).toBe(true);
    expect(fixture.migrationStatus).toContain('Database schema is up to date');
    for (const table of ['twitch_giveaway_credentials', 'giveaway_counted_messages', 'giveaway_deferred_messages', 'giveaway_rewards', 'giveaway_announcements', 'giveaway_command_receipts']) {
      const qualified = `${fixture.schema}.${table}`;
      expect((await fixture.admin.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass', [qualified])).rows[0].relrowsecurity).toBe(true);
      for (const role of ['anon', 'authenticated']) expect((await fixture.admin.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, qualified, 'SELECT'])).rows[0].allowed).toBe(false);
    }
    const first = await service.open(adminId, 'ADMIN', `admin:${randomUUID()}`);
    await expect(db.giveawaySession.create({ data: { status: 'OPEN', origin: 'NATIVE', openedByPlayerId: adminId, openedAt: new Date() } })).rejects.toMatchObject({ code: 'P2002' });
    await close(first.sessionId!);
  });
  it('blocks inactive bridge, duplicate open and TESTER only; records one opening', async () => {
    const tester = await player('Giveaway Tester', 'pyro', 'TESTER');
    active = false; await expect(service.open(adminId, 'ADMIN')).rejects.toThrow(); active = true;
    await expect(service.open(tester.id, 'ADMIN')).rejects.toMatchObject({ code: 'GIVEAWAY_FORBIDDEN' });
    const key = `admin:${randomUUID()}`, opened = await service.open(adminId, 'ADMIN', key);
    expect(await service.open(adminId, 'ADMIN', key)).toMatchObject({ sessionId: opened.sessionId, duplicate: true });
    await expect(service.open(adminId, 'ADMIN')).rejects.toMatchObject({ code: 'GIVEAWAY_ALREADY_OPEN' });
    await close(opened.sessionId!);
  });
  it.each(['ADMIN', 'MODERATOR'] as const)('allows an active %s to open and close through the authoritative Player role', async role => {
    const actor = await player(`Authorized ${role}`, 'hydro', role);
    const opened = await service.open(actor.id, 'TWITCH', `twitch:${randomUUID()}`);
    expect((await db.giveawaySession.findUniqueOrThrow({ where: { id: opened.sessionId! } })).status).toBe('OPEN');
    const announcement = await db.giveawayAnnouncement.findFirstOrThrow({ where: { sessionId: opened.sessionId!, kind: 'OPEN' } });
    expect(announcement.text).toBe('🎁 Un cadeau venu de Célestia est apparu ! Utilisez !wish pour tenter votre chance de remporter 1 600 primos à la fin du live.');
    await service.close(actor.id, 'TWITCH', opened.sessionId!, `twitch:${randomUUID()}`);
    expect((await db.giveawaySession.findUniqueOrThrow({ where: { id: opened.sessionId! } })).status).toBe('CLOSED');
  });
  it('refuses normal Players for open and close without changing sessions, rewards or receipts', async () => {
    const actor = await player('No moderation role');
    const before = await db.giveawaySession.count();
    await expect(service.open(actor.id, 'TWITCH', `twitch:${randomUUID()}`)).rejects.toMatchObject({ code: 'GIVEAWAY_FORBIDDEN' });
    expect(await db.giveawaySession.count()).toBe(before);
    const opened = await service.open(adminId, 'ADMIN');
    const receipts = await db.giveawayCommandReceipt.count(), rewards = await db.giveawayReward.count(), announcements = await db.giveawayAnnouncement.count();
    await expect(service.close(actor.id, 'TWITCH', opened.sessionId!, `twitch:${randomUUID()}`)).rejects.toMatchObject({ code: 'GIVEAWAY_FORBIDDEN' });
    expect((await db.giveawaySession.findUniqueOrThrow({ where: { id: opened.sessionId! } })).status).toBe('OPEN');
    expect(await db.giveawayReward.count()).toBe(rewards);
    expect(await db.giveawayCommandReceipt.count()).toBe(receipts);
    expect(await db.giveawayAnnouncement.count()).toBe(announcements);
    expect(await service.publicStats()).toBe('🎁 Giveaway ouvert | 👥 0 participant(s) | Commande : !wish');
    expect((await service.wish(actor.twitchUserId, `twitch:${randomUUID()}`)).outcome).toBe('JOINED');
    await close(opened.sessionId!);
    expect(await service.publicStats()).toBe('🎁 Giveaway fermé | 👥 1 participant(s) | 🏆 Dernier gagnant : No moderation role');
  });
  it('requires a linked active Player and element, deduplicates wish and counts normal messages separately', async () => {
    const opened = await service.open(adminId, 'ADMIN');
    const valid = await player('Wish Valid'); const noElement = await player('Wish No Element', null);
    const inactive = await player('Wish Inactive', 'cryo', undefined, 'ARCHIVED');
    expect((await service.wish('999999999', `twitch:${randomUUID()}`)).outcome).toBe('NO_IDENTITY');
    expect((await service.wish(noElement.twitchUserId, `twitch:${randomUUID()}`)).outcome).toBe('NO_ELEMENT');
    expect((await service.wish(inactive.twitchUserId, `twitch:${randomUUID()}`)).outcome).toBe('INACTIVE');
    const key = `twitch:${randomUUID()}`;
    expect((await service.wish(valid.twitchUserId, key)).outcome).toBe('JOINED');
    expect((await service.wish(valid.twitchUserId, key)).duplicate).toBe(true);
    expect((await service.wish(valid.twitchUserId, `twitch:${randomUUID()}`)).outcome).toBe('ALREADY_JOINED');
    const id = randomUUID(); expect(await message(valid.twitchUserId, id)).toBe(true);
    expect(await message(valid.twitchUserId, id)).toBe(false);
    expect((await service.state()).session).toMatchObject({ participantCount: 1, chatterCount: 1,
      top: [{ messageCount: '1', rank: 1 }] });
    await close(opened.sessionId!);
  });
  it('counts a real broadcaster message but holds and excludes backend outbound IDs', async () => {
    const opened = await service.open(adminId, 'ADMIN');
    const announcement = await db.giveawayAnnouncement.findFirstOrThrow({ where: { sessionId: opened.sessionId!, kind: 'OPEN' } });
    const outboundId = randomUUID();
    await db.giveawayAnnouncement.update({ where: { id: announcement.id }, data: { state: 'RESERVED' } });
    expect(await message(adminTwitchId, outboundId)).toBe(false);
    expect(await db.giveawayDeferredMessage.count({ where: { sessionId: opened.sessionId! } })).toBe(1);
    await db.giveawayAnnouncement.update({ where: { id: announcement.id }, data: { state: 'SENT', twitchMessageId: outboundId } });
    expect(await service.settleDeferred()).toBe(0);
    expect(await message(adminTwitchId)).toBe(true);
    expect((await db.giveawayChatStat.findFirstOrThrow({ where: { sessionId: opened.sessionId!, playerId: adminId } })).messageCount).toBe(1n);
    await close(opened.sessionId!);
  });
  it('recognizes an in-flight outbound by its exact text without holding a different human message', async () => {
    const opened = await service.open(adminId, 'ADMIN');
    const announcement = await db.giveawayAnnouncement.findFirstOrThrow({ where: { sessionId: opened.sessionId!, kind: 'OPEN' } });
    await db.giveawayAnnouncement.update({ where: { id: announcement.id }, data: { state: 'AMBIGUOUS' } });
    const outboundId = randomUUID();
    expect(await service.isOutboundMessage({ twitchUserId: adminTwitchId, twitchMessageId: outboundId, text: announcement.text })).toBe(true);
    expect(await db.giveawayAnnouncement.findUniqueOrThrow({ where: { id: announcement.id } })).toMatchObject({ state: 'SENT', twitchMessageId: outboundId });
    await db.giveawayAnnouncement.create({ data: { sessionId: opened.sessionId!, sourceEventId: randomUUID(), kind: 'STATS', text: 'Autre annonce', state: 'AMBIGUOUS' } });
    const humanId = randomUUID();
    expect(await service.isOutboundMessage({ twitchUserId: adminTwitchId, twitchMessageId: humanId, text: 'Vrai message humain' })).toBe(false);
    expect(await service.countMessage({ twitchUserId: adminTwitchId, twitchMessageId: humanId, text: 'Vrai message humain', observedAt: new Date() })).toBe(true);
    await close(opened.sessionId!);
  });
  it('uses competition ranks, credits both populations and aggregates the winner notification', async () => {
    const opened = await service.open(adminId, 'ADMIN');
    const rows = await Promise.all(['Alice', 'Bob', 'Chloe', 'David'].map(name => player(`Ranking ${name}`, 'cryo')));
    await service.wish(rows[0]!.twitchUserId, `twitch:${randomUUID()}`);
    await service.wish(rows[1]!.twitchUserId, `twitch:${randomUUID()}`);
    for (const [index, count] of [3, 3, 2, 1].entries()) for (let n = 0; n < count; n++) expect(await message(rows[index]!.twitchUserId)).toBe(true);
    expect((await db.giveawayChatStat.findMany({ where: { sessionId: opened.sessionId! } })).map(row => row.messageCount).sort())
      .toEqual([1n, 2n, 3n, 3n]);
    const result = await close(opened.sessionId!); expect(result.duplicate).toBe(false);
    const rewards = await db.giveawayReward.findMany({ where: { sessionId: opened.sessionId! }, orderBy: [{ playerId: 'asc' }, { kind: 'asc' }] });
    expect(rewards.filter(row => row.kind === 'CHAT').map(row => [row.rank, row.amount]).sort((a, b) => Number(a[0]) - Number(b[0])))
      .toEqual([[1, 2000n], [1, 2000n], [3, 1000n], [4, 500n]]);
    expect(rewards.filter(row => row.kind === 'DRAW')).toHaveLength(1);
    const winner = await db.giveawaySession.findUniqueOrThrow({ where: { id: opened.sessionId! } });
    expect([rows[0]!.id, rows[1]!.id]).toContain(winner.winnerPlayerId);
    const winnerPlayerId = winner.winnerPlayerId!;
    const winnerWallet = await db.playerResourceBalance.findMany({ where: { playerId: winnerPlayerId } });
    expect(winnerWallet.find(row => row.resourceKey === 'primogems')?.amount).toBe(1600n);
    expect(winnerWallet.find(row => row.resourceKey === 'particles_cryo')?.amount).toBe(2000n);
    expect(await db.playerEconomyStats.findUniqueOrThrow({ where: { playerId: winnerPlayerId } })).toMatchObject({ totalPrimosEarned: 1600n, totalMainElementParticlesEarned: 2000n });
    const notifications = await db.notification.findMany({ where: { playerId: winnerPlayerId, domainKey: 'giveaway' } });
    expect(notifications).toHaveLength(1); expect(notifications[0]?.payload).toMatchObject({ message: expect.stringContaining('Primogemmes') });
    expect(await db.giveawayWin.count({ where: { sessionId: opened.sessionId!, origin: 'NATIVE' } })).toBe(1);
    expect((await db.giveawayAnnouncement.findMany({ where: { sessionId: opened.sessionId!, kind: { in: ['OPEN', 'RANKING', 'RESULT'] } } })).map(row => row.kind).sort()).toEqual(['OPEN', 'RANKING', 'RESULT']);
    expect(await close(opened.sessionId!)).toMatchObject({ duplicate: true });
    expect(await db.giveawayReward.count({ where: { sessionId: opened.sessionId! } })).toBe(5);
  });
  it('closes without wish or chat and rolls back all effects on a notification failure', async () => {
    const empty = await service.open(adminId, 'ADMIN'); await close(empty.sessionId!);
    expect(await db.giveawayReward.count({ where: { sessionId: empty.sessionId! } })).toBe(0);
    const next = await service.open(adminId, 'ADMIN'); const chatter = await player('Rollback Chatter'); await message(chatter.twitchUserId);
    await fixture.admin.query(`ALTER TABLE "${fixture.schema}".notifications ADD CONSTRAINT private_giveaway_notification_failure CHECK (false) NOT VALID`);
    try { await expect(close(next.sessionId!)).rejects.toThrow(); }
    finally { await fixture.admin.query(`ALTER TABLE "${fixture.schema}".notifications DROP CONSTRAINT private_giveaway_notification_failure`); }
    expect((await db.giveawaySession.findUniqueOrThrow({ where: { id: next.sessionId! } })).status).toBe('OPEN');
    expect(await db.giveawayReward.count({ where: { sessionId: next.sessionId! } })).toBe(0);
    await close(next.sessionId!);
    expect(await db.giveawayReward.count({ where: { sessionId: next.sessionId! } })).toBe(1);
  });
  it('serializes concurrent count, wish and close without double rewards', async () => {
    const opened = await service.open(adminId, 'ADMIN'); const p = await player('Concurrent Giveaway'); const key = `twitch:${randomUUID()}`;
    const wishes = await Promise.all([service.wish(p.twitchUserId, key), service.wish(p.twitchUserId, key)]);
    expect(wishes.some(row => row.outcome === 'JOINED')).toBe(true);
    expect(await db.giveawayParticipant.count({ where: { sessionId: opened.sessionId! } })).toBe(1);
    const id = randomUUID(); await Promise.all([message(p.twitchUserId, id), message(p.twitchUserId, id)]);
    expect(await db.giveawayCountedMessage.count({ where: { sessionId: opened.sessionId! } })).toBe(1);
    await Promise.all([close(opened.sessionId!), close(opened.sessionId!)]);
    expect(await db.giveawayReward.count({ where: { sessionId: opened.sessionId! } })).toBe(2);
    expect(await db.notification.count({ where: { playerId: p.id, domainKey: 'giveaway' } })).toBe(1);
  });
  it('retries only a certainly failed result and never resends the ranking', async () => {
    const opened = await service.open(adminId, 'ADMIN');
    await db.giveawayAnnouncement.updateMany({ where: { sessionId: opened.sessionId!, kind: 'OPEN' }, data: { state: 'SENT', twitchMessageId: randomUUID() } });
    await close(opened.sessionId!);
    const subscriptions = { activationAvailable: true, inspectPilotChatSubscription: vi.fn().mockResolvedValue('ACTIVE') };
    const manager = new TwitchGiveawayManager(db, giftConfig, subscriptions as unknown as TwitchEventSubSubscriptionManager);
    vi.spyOn(manager.tokens!, 'getToken').mockResolvedValue('token');
    const send = vi.spyOn(manager.chat!, 'send').mockRejectedValueOnce(new TwitchGiveawaySendError('CERTAIN', 'HTTP_403'))
      .mockResolvedValueOnce('ranking-out').mockResolvedValueOnce('result-out');
    await manager.sendSessionMilestones(opened.sessionId!);
    const result = await db.giveawayAnnouncement.findFirstOrThrow({ where: { sessionId: opened.sessionId!, kind: 'RESULT' } });
    const ranking = await db.giveawayAnnouncement.findFirstOrThrow({ where: { sessionId: opened.sessionId!, kind: 'RANKING' } });
    expect(result).toMatchObject({ state: 'FAILED', errorCode: 'HTTP_403', attempts: 1 });
    expect(ranking).toMatchObject({ state: 'SENT', twitchMessageId: 'ranking-out', attempts: 1 });
    expect(await manager.sendAnnouncement(result.id, true)).toMatchObject({ state: 'SENT', messageId: 'result-out' });
    expect((await db.giveawayAnnouncement.findUniqueOrThrow({ where: { id: result.id } })).attempts).toBe(2);
    expect((await db.giveawayAnnouncement.findUniqueOrThrow({ where: { id: ranking.id } })).attempts).toBe(1);
    expect(send).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
  });
  it('keeps all specialized commands silent for an absent or disabled credential', async () => {
    const manager = new TwitchGiveawayManager(db, giftConfig);
    const send = vi.spyOn(manager, 'sendAnnouncement');
    const consumer = new TwitchGiveawayConsumer(db, service, manager);
    const receipts = await db.giveawayCommandReceipt.count(), announcements = await db.giveawayAnnouncement.count();
    await db.twitchGiveawayCredential.update({ where: { playerId: adminId }, data: { enabled: false } });
    try {
      for (const broadcasterUserId of [adminTwitchId, 'absent-broadcaster']) for (const text of ['!giveaway stats', '!ga stat', '!giveaway open', '!ga ouvrir', '!giveaway close', '!ga fermer', '!wish']) {
        expect(await consumer.consume({ broadcasterUserId, chatterUserId: adminTwitchId, messageId: randomUUID(), text, messageType: 'text', observedAt: new Date() })).toBe(false);
      }
      expect(await db.giveawayCommandReceipt.count()).toBe(receipts); expect(await db.giveawayAnnouncement.count()).toBe(announcements);
      expect(send).not.toHaveBeenCalled();
    } finally { await db.twitchGiveawayCredential.update({ where: { playerId: adminId }, data: { enabled: true } }); vi.restoreAllMocks(); }
  });
  it('uses active stats/open/close aliases and the same session as the Admin panel', async () => {
    const subscriptions = { activationAvailable: true, inspectPilotChatSubscription: vi.fn().mockResolvedValue('ACTIVE') };
    const manager = new TwitchGiveawayManager(db, giftConfig, subscriptions as unknown as TwitchEventSubSubscriptionManager);
    vi.spyOn(manager.tokens!, 'getToken').mockResolvedValue('private-token');
    const send = vi.spyOn(manager.chat!, 'send').mockImplementation(async () => randomUUID());
    const consumer = new TwitchGiveawayConsumer(db, service, manager);
    const consume = (text: string, messageId = randomUUID()) => consumer.consume({ broadcasterUserId: adminTwitchId, chatterUserId: adminTwitchId, messageId, text, messageType: 'text', observedAt: new Date() });
    try {
      for (const text of ['!giveaway stats', '!giveaway stat', '!ga stats', '!ga stat']) await consume(text);
      const open = ['!giveaway open', '!giveaway ouvrir', '!ga open', '!ga ouvrir'], shut = ['!giveaway close', '!giveaway fermer', '!ga close', '!ga fermer'];
      for (let index = 0; index < open.length; index++) {
        await consume(open[index]!);
        const state = await service.state(); expect(state.session?.status).toBe('OPEN');
        await consume(shut[index]!);
        expect((await db.giveawaySession.findUniqueOrThrow({ where: { id: state.session!.id } })).status).toBe('CLOSED');
      }
      const before = send.mock.calls.length, receipts = await db.giveawayCommandReceipt.count();
      for (const text of ['!ga', '!giveaway', '!ga xxx', '!giveaway xxx', '!ga reroll', '!giveaway reroll', '!ga open extra']) {
        const id = randomUUID(); await consume(text, id);
        expect(send.mock.calls.at(-1)![2]).toBe('ℹ️ Commandes giveaway : !giveaway open | !giveaway close | !giveaway stats | Participation : !wish');
        const sent = send.mock.calls.length; await consume(text, id); expect(send).toHaveBeenCalledTimes(sent);
      }
      expect(send).toHaveBeenCalledTimes(before + 7); expect(await db.giveawayCommandReceipt.count()).toBe(receipts);
      for (const text of ['!foo', '!giveawayx', '!wish extra']) await consume(text);
      expect(send).toHaveBeenCalledTimes(before + 7);
    } finally { vi.restoreAllMocks(); }
  });
  it('freezes Wish atomically with its receipt, replays after name/count changes, and excludes outbound echoes', async () => {
    const subscriptions = { activationAvailable: true, inspectPilotChatSubscription: vi.fn().mockResolvedValue('ACTIVE') };
    const manager = new TwitchGiveawayManager(db, giftConfig, subscriptions as unknown as TwitchEventSubSubscriptionManager);
    vi.spyOn(manager.tokens!, 'getToken').mockResolvedValue('private-token');
    const send = vi.spyOn(manager.chat!, 'send').mockImplementation(async () => randomUUID());
    const consumer = new TwitchGiveawayConsumer(db, service, manager);
    const consume = (chatterUserId: string, messageId = randomUUID(), text = '!wish') => consumer.consume({ broadcasterUserId: adminTwitchId, chatterUserId, messageId, text, messageType: 'text', observedAt: new Date() });
    try {
      const valid = await player('Wish Presentation'), noElement = await player('Wish Empty Element', null), inactive = await player('Wish Archived', 'pyro', undefined, 'ARCHIVED');
      const noOpenId = randomUUID(); await consume(valid.twitchUserId, noOpenId);
      expect((await db.giveawayAnnouncement.findUniqueOrThrow({ where: { sourceEventId: `twitch:${noOpenId}` } })).text).toContain('Aucun Giveaway');
      const opened = await service.open(adminId, 'ADMIN');
      for (const chatter of ['unlinked', noElement.twitchUserId, inactive.twitchUserId]) await consume(chatter);
      expect(await db.giveawayParticipant.count({ where: { sessionId: opened.sessionId! } })).toBe(0);
      const messageId = randomUUID(); await consume(valid.twitchUserId, messageId);
      const saved = await db.giveawayAnnouncement.findUniqueOrThrow({ where: { sourceEventId: `twitch:${messageId}` } });
      expect(saved).toMatchObject({ state: 'SENT', attempts: 1, text: '🌠 Wish Presentation formule un vœu auprès de Célestia... | 🎁 1 participant(s)' });
      await db.player.update({ where: { id: valid.id }, data: { displayName: 'Wish Renamed' } });
      const another = await player('Wish Second'); await service.wish(another.twitchUserId, `twitch:${randomUUID()}`);
      const sent = send.mock.calls.length; await consume(valid.twitchUserId, messageId); await consume(valid.twitchUserId, noOpenId);
      expect(send).toHaveBeenCalledTimes(sent);
      expect((await db.giveawayAnnouncement.findUniqueOrThrow({ where: { id: saved.id } })).text).toBe(saved.text);
      expect(await db.giveawayParticipant.count({ where: { sessionId: opened.sessionId! } })).toBe(2);
      // A pre-corrective receipt may lack its announcement; use the immutable Twitch identity once.
      const oldId = randomUUID();
      await db.giveawayCommandReceipt.create({ data: { commandId: `twitch:${oldId}`, action: 'WISH', outcome: 'JOINED', sessionId: opened.sessionId! } });
      await consume(another.twitchUserId, oldId);
      const oldReply = await db.giveawayAnnouncement.findUniqueOrThrow({ where: { sourceEventId: `twitch:${oldId}` } });
      expect(oldReply.text).toBe('🌠 Wish Second formule un vœu auprès de Célestia... | 🎁 2 participant(s)');
      const sentAfterOld = send.mock.calls.length; await consume(another.twitchUserId, oldId); expect(send).toHaveBeenCalledTimes(sentAfterOld);
      await consume(valid.twitchUserId); expect(send.mock.calls.at(-1)![2]).toContain('tu participes déjà');
      expect(await consumer.consume({ broadcasterUserId: adminTwitchId, chatterUserId: adminTwitchId, messageId: saved.twitchMessageId!, text: saved.text, messageType: 'text', observedAt: new Date() })).toBe(true);
      expect(await db.giveawayCountedMessage.count({ where: { twitchMessageId: saved.twitchMessageId! } })).toBe(0);
      await close(opened.sessionId!);
    } finally { vi.restoreAllMocks(); }
  });
});
