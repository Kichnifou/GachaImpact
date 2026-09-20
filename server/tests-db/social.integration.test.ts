import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaBoxStore } from '../src/infrastructure/database/prisma-box-store.js';
import { PrismaTeamStore } from '../src/infrastructure/database/prisma-team-store.js';
import { PrismaInventoryStore } from '../src/infrastructure/database/prisma-inventory-store.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { SocialService } from '../src/application/social/social-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { buildApp } from '../src/app.js';
import { eligibleContactRecipient } from '../src/application/social/contact-permission.js';

const fixture = isolatedBatchDatabase(), { database } = fixture;
let now = new Date('2026-09-20T12:00:00Z');
const playerStore = { findByIdentity: async (_provider: string, subject: string) => {
  const p = await database.player.findUnique({ where: { id: subject } });
  return p ? { id: p.id, displayName: p.displayName, status: p.status, elementKey: null } : null;
}, provision: async () => { throw Error('no provisioning'); } };
const getPlayer = new GetCurrentPlayer(playerStore);
const service = new SocialService(getPlayer, database, { now: () => now });
let owner: string, viewer: string, friendId: string;
let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(async () => {
  await fixture.setup();
  await database.element.createMany({ data: [{ key: 'pyro', displayName: 'Pyro', displayOrder: 1 }, { key: 'hydro', displayName: 'Hydro', displayOrder: 2 }] });
  owner = (await database.player.create({ data: { displayName: 'Éloïse Fixture', elementKey: 'pyro', progression: { create: { xp: 90n } }, gachaState: { create: { totalPulls: 12n, totalFiveStars: 2n, totalFourStars: 3n } } } })).id;
  viewer = (await database.player.create({ data: { displayName: 'Visiteur Fixture' } })).id;
  friendId = (await database.player.create({ data: { displayName: 'Ami Fixture' } })).id;
  const [playerAId, playerBId] = [owner, friendId].sort();
  await database.friendship.create({ data: { playerAId: playerAId!, playerBId: playerBId!, state: 'ACTIVE' } });
  app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async token => ({ subject: token }) }, getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore), socialService: service });
}, 60_000);
afterAll(async () => { await app?.close(); await fixture.cleanup(); }, 60_000);
const identity = (subject: string) => ({ subject });
const profile = (visitor = viewer) => service.profile(identity(visitor), owner);

describe('Social isolated PostgreSQL', () => {
  it('enforces defaults, private vs empty, owner access, active friendship and overrides without resetting other categories', async () => {
    expect((await profile()).team).toEqual({ access: 'ALLOWED', data: null });
    expect((await profile()).box).toEqual({ access: 'ALLOWED', data: [] });
    await service.privacy.save(owner, 'PRIVATE_MESSAGES', 'PRIVATE');
    await service.privacy.save(owner, 'BOX', 'FRIENDS');
    expect((await profile()).box).toEqual({ access: 'PRIVATE' });
    expect((await profile(friendId)).box.access).toBe('ALLOWED');
    await database.friendship.updateMany({ data: { state: 'ARCHIVED' } });
    expect((await profile(friendId)).box.access).toBe('PRIVATE');
    await database.friendship.updateMany({ data: { state: 'ACTIVE' } });
    await service.privacy.save(owner, 'BOX', 'PRIVATE');
    expect((await profile(friendId)).box).toEqual({ access: 'PRIVATE' });
    expect((await profile(owner)).box.access).toBe('ALLOWED');
    expect((await service.privacy.settings(owner)).settings.find(s => s.categoryKey === 'PRIVATE_MESSAGES')?.level).toBe('PRIVATE');
    expect(await database.player.count({ where: { AND: [{ id: owner }, eligibleContactRecipient(viewer)] } })).toBe(0);
  }, 30_000);
  it('never retrieves private Team/Box/Collection content and preserves GET read-only behavior', async () => {
    for (const category of ['ACTIVE_TEAM','BOX','COLLECTION','GENERAL_STATISTICS'] as const) await service.privacy.save(owner, category, 'PRIVATE');
    const before = await database.team.count();
    const boxRead = vi.spyOn(PrismaBoxStore.prototype, 'listVisiblePossessions');
    const teamRead = vi.spyOn(PrismaTeamStore.prototype, 'readActive');
    const collectionRead = vi.spyOn(PrismaInventoryStore.prototype, 'getCollection');
    const result = await profile();
    expect(boxRead).not.toHaveBeenCalled(); expect(teamRead).not.toHaveBeenCalled(); expect(collectionRead).not.toHaveBeenCalled();
    boxRead.mockRestore(); teamRead.mockRestore(); collectionRead.mockRestore();
    expect(result.team).toEqual({ access: 'PRIVATE' }); expect(result.collection).toEqual({ access: 'PRIVATE' }); expect(result.statistics).toEqual({ access: 'PRIVATE' });
    expect(JSON.stringify(result)).not.toContain('totalPulls');
    await profile(owner);
    expect(await database.team.count()).toBe(before);
    for (const category of ['ACTIVE_TEAM','BOX','COLLECTION','GENERAL_STATISTICS'] as const) await service.privacy.save(owner, category, 'PUBLIC');
    expect((await profile()).statistics).toMatchObject({ access: 'ALLOWED', data: { totalPulls: '12', totalXp: '90' } });
  }, 30_000);
  it('projects real possessions and active Team without exposing presets, Sac, currencies or detailed histories', async () => {
    const character = await database.character.create({ data: { externalKey: randomUUID(), name: 'Social character', rarity: 5, elementKey: 'pyro' } });
    await database.playerCharacter.create({ data: { playerId: owner, characterId: character.id, constellation: 2, copies: 3, firstObtainedAt: now } });
    await database.team.create({ data: { playerId: owner, displayPosition: 1, isActive: true, members: { create: { position: 1, characterId: character.id } } } });
    await database.team.create({ data: { playerId: owner, displayPosition: 2, name: 'Secret preset' } });
    const collection = await database.itemDefinition.create({ data: { externalKey: randomUUID(), displayName: 'Collection fixture', category: 'collection' } });
    const item = await database.itemDefinition.create({ data: { externalKey: randomUUID(), displayName: 'Secret Sac fixture', category: 'objects' } });
    await database.playerItem.createMany({ data: [{ playerId: owner, itemId: collection.id, quantity: 1n }, { playerId: owner, itemId: item.id, quantity: 99n }] });
    const result = await profile();
    expect(result.box).toMatchObject({ access: 'ALLOWED', data: [{ id: character.id, constellation: 2, copies: 3 }] });
    expect(result.team).toMatchObject({ access: 'ALLOWED', data: { slots: [{ position: 1, character: { id: character.id } }, { position: 2, character: null }, { position: 3, character: null }, { position: 4, character: null }] } });
    expect(result.collection).toMatchObject({ access: 'ALLOWED', data: [{ id: collection.id, quantity: '1' }] });
    for (const privateValue of ['Secret preset', 'Secret Sac fixture', '"stella"', '"favorite"', '"resources"']) expect(JSON.stringify(result)).not.toContain(privateValue);
    expect(await database.team.count({ where: { playerId: owner } })).toBe(2);
  }, 30_000);
  it('tracks per-tab heartbeats without fake activity and handles timeout, inactivity, resume and close races', async () => {
    const key = randomUUID(), second = randomUUID();
    await service.presence.touch(owner, key, true, true);
    expect((await service.connected(identity(viewer))).players.find(p => p.id === owner)?.status).toBe('ONLINE');
    now = new Date(+now + 11 * 60_000);
    await service.presence.touch(owner, key, false);
    expect((await profile()).presence).toEqual({ access: 'ALLOWED', data: 'AWAY' });
    expect((await profile()).lastActivity).toEqual({ access: 'ALLOWED', data: '2026-09-20T12:00:00.000Z' });
    await service.presence.touch(owner, second, true, true);
    await service.presence.end(owner, key);
    expect((await profile()).presence).toEqual({ access: 'ALLOWED', data: 'ONLINE' });
    now = new Date(+now + 2 * 60 * 60_000);
    await service.presence.touch(owner, second, false);
    expect((await profile()).presence).toEqual({ access: 'ALLOWED', data: 'OFFLINE' });
    await service.presence.touch(owner, second, true);
    expect((await profile()).presence).toEqual({ access: 'ALLOWED', data: 'ONLINE' });
    now = new Date(+now + 180_000);
    expect((await profile()).presence).toEqual({ access: 'ALLOWED', data: 'OFFLINE' });
    await service.presence.end(owner, second);
    await expect(service.presence.touch(owner, second, true)).rejects.toMatchObject({ code: 'PRESENCE_SESSION_ENDED' });
    const late = randomUUID(); await service.presence.end(owner, late);
    await expect(service.presence.touch(owner, late, true, true)).rejects.toMatchObject({ code: 'PRESENCE_SESSION_ENDED' });
  }, 60_000);
  it('excludes private and blocked presence in every projection without inventing offline values', async () => {
    await service.presence.touch(owner, randomUUID(), true, true);
    await service.privacy.save(owner, 'PRESENCE', 'FRIENDS');
    expect((await profile()).presence).toEqual({ access: 'PRIVATE' });
    expect((await service.connected(identity(viewer))).players.some(p => p.id === owner)).toBe(false);
    expect((await service.connected(identity(friendId))).players.some(p => p.id === owner)).toBe(true);
    for (const [blockerPlayerId, blockedPlayerId] of [[owner, friendId], [friendId, owner]]) {
      await database.playerBlock.create({ data: { blockerPlayerId: blockerPlayerId!, blockedPlayerId: blockedPlayerId! } });
      expect((await profile(friendId)).presence).toEqual({ access: 'PRIVATE' });
      expect((await profile(friendId)).lastActivity).toEqual({ access: 'PRIVATE' });
      expect((await service.connected(identity(friendId))).players.some(p => p.id === owner)).toBe(false);
      await database.playerBlock.deleteMany();
    }
    expect((await profile(owner)).presence.access).toBe('ALLOWED');
    await service.privacy.save(owner, 'PRESENCE', 'PUBLIC');
  }, 45_000);
  it('searches accented names, filters elements, paginates active Players and keeps identity visible', async () => {
    await database.player.createMany({ data: Array.from({ length: 23 }, (_, i) => ({ displayName: `Pagination ${String(i).padStart(2, '0')}`, elementKey: 'hydro' })) });
    await database.player.create({ data: { displayName: 'Pagination hidden', status: 'ARCHIVED' } });
    const query = { q: 'pagination', page: 1 };
    expect((await service.directory(identity(viewer), query)).players).toHaveLength(20);
    expect((await service.directory(identity(viewer), { ...query, page: 2 })).players).toHaveLength(3);
    const found = await service.directory(identity(viewer), { q: 'ELOISE', element: 'pyro', page: 1 });
    expect(found.players[0]).toMatchObject({ id: owner, displayName: 'Éloïse Fixture', level: 3 });
    expect((await service.directory(identity(viewer), { q: 'eloise', element: 'hydro', page: 1 })).total).toBe(0);
  }, 30_000);
  it('authenticates routes, validates UUIDs/categories/levels and ignores no client owner or timestamp', async () => {
    expect((await app.inject({ url: '/api/v1/players' })).statusCode).toBe(401);
    const headers = { authorization: `Bearer ${viewer}` };
    for (const payload of [{ categoryKey: 'BOX', level: 'ANY' }, { categoryKey: 'IDENTITY', level: 'PRIVATE' }, { categoryKey: 'BOX', level: 'PRIVATE', playerId: owner }]) expect((await app.inject({ url: '/api/v1/me/privacy', method: 'PATCH', headers, payload })).statusCode).toBe(400);
    expect((await app.inject({ url: '/api/v1/me/presence/session', method: 'POST', headers, payload: { sessionKey: randomUUID(), playerId: owner } })).statusCode).toBe(400);
    expect((await app.inject({ url: '/api/v1/players/not-uuid/profile', headers })).statusCode).toBe(400);
    const response = await app.inject({ url: `/api/v1/players/${owner}/profile`, headers });
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().player.displayName).toBe('Éloïse Fixture');
    const changed = await app.inject({ url: '/api/v1/me/privacy', method: 'PATCH', headers, payload: { categoryKey: 'BOX', level: 'PRIVATE' } });
    expect(changed.statusCode).toBe(200);
    expect((await service.privacy.settings(owner)).settings.find(s => s.categoryKey === 'BOX')?.level).toBe('PUBLIC');
  }, 30_000);
});
