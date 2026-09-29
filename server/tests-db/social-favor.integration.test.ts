import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { SocialService } from '../src/application/social/social-service.js';
import { FavorService } from '../src/application/favor/favor-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import { ChatCommandDispatcher, type ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';
import { resourceKeys } from '../src/domain/economy/resources.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const clock = { now: () => new Date('2099-09-10T12:00:00Z') };
const getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db));
const social = new SocialService(getPlayer, db, clock);
const favor = new FavorService(db, clock);
let owner: string, friend: string, stranger: string;
const identity = (subject: string) => ({ subject });
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const create = async (name: string) => {
    const id = randomUUID();
    await db.player.create({ data: { id, displayName: name, elementKey: 'pyro',
      webIdentity: { create: { provider: 'supabase', providerSubject: id } },
      progression: { create: { xp: 0n } }, economyStats: { create: {} },
      resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) },
    } });
    await db.playerPermanentMissionState.create({ data: { playerId: id, initializedAt: clock.now(), standaloneCatchupCompletedAt: clock.now() } });
    return id;
  };
  owner = await create('Favor Owner'); friend = await create('Favor Friend'); stranger = await create('Favor Stranger');
  const [playerAId, playerBId] = [owner, friend].sort();
  await db.friendship.create({ data: { playerAId: playerAId!, playerBId: playerBId!, state: 'ACTIVE' } });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);
const proofs = async () => ({
  claims: await db.favorDailyClaim.count(), grants: await db.favorGrant.count(),
  operations: await db.businessOperation.count({ where: { operationType: { startsWith: 'favor.' } } }),
  movements: await db.resourceMovement.count(),
  wallet: (await db.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId: owner, resourceKey: 'primogems' } } })).amount,
});

it('shares owner inactive/available/claimed state with Profile without any economic read effects', async () => {
  const initial = await proofs();
  expect(await social.favor(identity(owner), owner)).toEqual({ access: 'ALLOWED', data: { active: false, daysRemaining: 0, maxDays: 180, dailyPrimogems: '800', claimedToday: false, claimStatus: 'UNAVAILABLE' } });
  expect(await proofs()).toEqual(initial);
  await db.playerFavorState.create({ data: { playerId: owner, activeFromDate: new Date('2099-09-10'), activeUntilDate: new Date('2099-10-09') } });
  const available = await social.favor(identity(owner), owner);
  expect(available).toMatchObject({ access: 'ALLOWED', data: { active: true, daysRemaining: 30, dailyPrimogems: '800', claimedToday: false, claimStatus: 'AVAILABLE' } });
  expect((await social.profile(identity(owner), owner)).favor).toEqual(available);
  expect(await proofs()).toEqual(initial);
  await favor.claimToday(owner, 'UI');
  const paid = await proofs();
  expect((await social.profile(identity(owner), owner)).favor).toMatchObject({ access: 'ALLOWED', data: { claimedToday: true, claimStatus: 'CLAIMED' } });
  await social.favor(identity(owner), owner);
  expect(await proofs()).toEqual(paid);
});

it('enforces only FAVOR privacy and removes every personal field from third-party responses', async () => {
  const before = await proofs();
  await social.privacy.save(owner, 'GENERAL_STATISTICS', 'PRIVATE');
  await social.privacy.save(owner, 'PRESENCE', 'PRIVATE');
  for (const level of ['PUBLIC', 'FRIENDS', 'PRIVATE'] as const) {
    await social.privacy.save(owner, 'FAVOR', level);
    for (const viewer of [owner, friend, stranger]) {
      const view = await social.favor(identity(viewer), owner);
      expect((await social.profile(identity(viewer), owner)).favor).toEqual(view);
      if (viewer === owner) expect(view).toMatchObject({ access: 'ALLOWED', data: { claimedToday: true } });
      else if (level === 'PUBLIC' || level === 'FRIENDS' && viewer === friend) expect(view).toEqual({ access: 'ALLOWED', data: { active: true, daysRemaining: 30, maxDays: 180 } });
      else expect(view).toEqual({ access: 'PRIVATE' });
    }
  }
  const read = vi.spyOn(FavorService.prototype, 'getCurrent');
  try { await social.favor(identity(stranger), owner); expect(read).not.toHaveBeenCalled(); } finally { read.mockRestore(); }
  const [playerAId, playerBId] = [owner, friend].sort();
  await social.privacy.save(owner, 'FAVOR', 'FRIENDS');
  await db.friendship.update({ where: { playerAId_playerBId: { playerAId: playerAId!, playerBId: playerBId! } }, data: { state: 'ARCHIVED' } });
  expect(await social.favor(identity(friend), owner)).toEqual({ access: 'PRIVATE' });
  await social.privacy.save(owner, 'FAVOR', 'PUBLIC');
  await db.playerFavorState.update({ where: { playerId: owner }, data: { activeFromDate: null, activeUntilDate: null } });
  expect(await social.favor(identity(stranger), owner)).toEqual({ access: 'ALLOWED', data: { active: false, daysRemaining: 0, maxDays: 180 } });
  expect(await proofs()).toEqual(before);
});

it('sends COMMAND plus GAME_RESULT through real Chat with no Favor grant/claim/ledger/wallet effects', async () => {
  const chat = new GlobalChatService(db, getPlayer, clock, { nextInt: () => 0 });
  const dispatcher = new ChatCommandDispatcher(chat, { socialService: social } as unknown as ChatCommandServices);
  const before = await proofs(), reads = vi.spyOn(FavorService.prototype, 'claimToday');
  try {
    const key = randomUUID();
    const first = await dispatcher.send(identity(owner), '!faveur', key);
    expect(first.message.messageType).toBe('COMMAND');
    expect(first.result).toMatchObject({ messageType: 'GAME_RESULT', content: 'Faveur de l’Astre : inactive.' });
    expect(first.refreshScopes).not.toContain('resources');
    await dispatcher.send(identity(owner), '!faveur', key);
    expect(await db.globalChatMessage.count()).toBe(2);
    expect(await proofs()).toEqual(before); expect(reads).not.toHaveBeenCalled();
  } finally { reads.mockRestore(); }
});

it('applies the same public/friend/private projection to real Chat target and @multi-word references', async () => {
  let chatTime = +clock.now();
  const chat = new GlobalChatService(db, getPlayer, { now: () => new Date(chatTime) }, { nextInt: () => 0 });
  const dispatcher = new ChatCommandDispatcher(chat, { socialService: social } as unknown as ChatCommandServices);
  const [playerAId, playerBId] = [owner, friend].sort();
  await db.friendship.update({ where: { playerAId_playerBId: { playerAId: playerAId!, playerBId: playerBId! } }, data: { state: 'ACTIVE' } });
  await db.playerFavorState.update({ where: { playerId: owner }, data: { activeFromDate: new Date('2099-09-10'), activeUntilDate: new Date('2099-10-09') } });
  const before = await proofs();
  for (const level of ['PUBLIC', 'FRIENDS', 'PRIVATE'] as const) {
    await social.privacy.save(owner, 'FAVOR', level);
    for (const viewer of [friend, stranger]) {
      for (const reference of ['Favor Owner', '@Favor Owner']) {
        chatTime += 5_000;
        const result = await dispatcher.send(identity(viewer), `!faveur ${reference}`, randomUUID());
        const visible = level === 'PUBLIC' || level === 'FRIENDS' && viewer === friend;
        expect(result.result?.content).toBe(visible ? 'Favor Owner : Faveur active · 30 jours restants.' : 'La Faveur de Favor Owner est privée.');
        expect(result.refreshScopes).not.toContain('resources');
      }
    }
  }
  expect(await proofs()).toEqual(before);
});
