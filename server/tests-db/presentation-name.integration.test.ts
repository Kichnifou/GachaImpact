import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { AppearanceService } from '../src/application/appearance/appearance-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { buildApp } from '../src/app.js';
import { SocialService } from '../src/application/social/social-service.js';
import { DirectMessageService } from '../src/application/direct-messages/direct-message-service.js';
import { hasNeutralPresentationName } from '../src/application/player/presentation-name.js';
import { isDisposableWebPlayer } from '../src/application/twitch/twitch-profile-claim.js';

const fixture = isolatedBatchDatabase();
const db = fixture.database;
let owner: string, other: string;
let service: AppearanceService;
let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(async () => {
  await fixture.setup({ prismaMigrations: true });
  expect(fixture.migrationStatus).toContain('up to date');
  owner = (await db.player.create({ data: { displayName: 'TechnicalOwner', legacyUsername: 'HistoricalOwner', webIdentity: { create: { provider: 'supabase', providerSubject: 'owner-subject' } }, twitchIdentity: { create: { twitchUserId: '987654321012345', login: 'technical_login', displayName: 'TwitchOwner' } } } })).id;
  other = (await db.player.create({ data: { displayName: 'TechnicalOther', webIdentity: { create: { provider: 'supabase', providerSubject: 'other-subject' } } } })).id;
  const store = new PrismaCurrentPlayerStore(db);
  service = new AppearanceService(db, new GetCurrentPlayer(store));
  app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async token => ({ subject: token }) }, getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(store), appearanceService: service });
}, 180_000);
afterAll(async () => { await app?.close(); await fixture.cleanup(); }, 60_000);
const rename = async (name: string, extra = {}) => app.inject({ method: 'PATCH', url: '/api/v1/me/presentation-name', headers: { authorization: 'Bearer owner-subject' }, payload: { name, expectedRevision: (await db.player.findUniqueOrThrow({ where: { id: owner } })).presentationNameRevision, ...extra } });

describe('private PostgreSQL presentation mutation', () => {
  it('keeps neutral presentation defaults and protects a personalized profile from disposable claim', async () => {
    const neutral = await db.player.findUniqueOrThrow({ where: { id: other } });
    expect(hasNeutralPresentationName(neutral)).toBe(true);
    // Other unknown historical columns remain fail-closed; this lot does not widen their allowlist.
    expect(await db.$transaction(tx => isDisposableWebPlayer(tx, other))).toBe(false);
    await db.player.update({ where: { id: other }, data: { presentationName: 'Preserved presentation', presentationNameRevision: 1 } });
    const custom = await db.player.findUniqueOrThrow({ where: { id: other } });
    expect(hasNeutralPresentationName(custom)).toBe(false);
    expect(await db.$transaction(tx => isDisposableWebPlayer(tx, other))).toBe(false);
    await db.player.update({ where: { id: other }, data: { presentationName: null, presentationNameRevision: 0 } });
  });
  it('authenticates self, rejects client target IDs and invalid names', async () => {
    expect((await app.inject({ method: 'PATCH', url: '/api/v1/me/presentation-name', payload: { name: 'No auth' } })).statusCode).toBe(401);
    expect((await rename('Forged', { playerId: other })).statusCode).toBe(400);
    for (const name of ['', ' ', 'a'.repeat(41), 'x\ny', 'x\u202ey']) expect((await rename(name)).statusCode).toBe(400);
    expect((await db.player.findUniqueOrThrow({ where: { id: owner } })).presentationName).toBeNull();
  });
  it('changes only presentation, preserves account links and makes duplicates a no-op', async () => {
    const before = await db.player.findUniqueOrThrow({ where: { id: owner }, include: { webIdentity: true, twitchIdentity: true } });
    expect((await rename('  Étoile 月 🌙  ')).json()).toEqual({ id: owner, displayName: 'Étoile 月 🌙', revision: 1 });
    const after = await db.player.findUniqueOrThrow({ where: { id: owner }, include: { webIdentity: true, twitchIdentity: true } });
    expect({ ...after, presentationName: before.presentationName, presentationNameRevision: before.presentationNameRevision, updatedAt: before.updatedAt }).toEqual(before);
    await rename('Étoile 月 🌙');
    expect((await db.player.findUniqueOrThrow({ where: { id: owner } })).updatedAt).toEqual(after.updatedAt);
    const me = await app.inject({ url: '/api/v1/me', headers: { authorization: 'Bearer owner-subject' } });
    expect(me.json()).toMatchObject({ id: owner, displayName: 'Étoile 月 🌙' });
    expect((await db.player.findUniqueOrThrow({ where: { id: other } })).presentationName).toBeNull();
  });
  it('serializes concurrent edits and permits homonyms without changing identity', async () => {
    const expected = (await db.player.findUniqueOrThrow({ where: { id: owner } })).presentationNameRevision;
    const results = await Promise.allSettled([service.renamePresentation({ subject: 'owner-subject' }, 'First', expected), service.renamePresentation({ subject: 'owner-subject' }, 'Second', expected)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'PRESENTATION_NAME_CONFLICT' } });
    const row = await db.player.findUniqueOrThrow({ where: { id: owner } });
    expect(['First', 'Second']).toContain(row.presentationName);
    await service.renamePresentation({ subject: 'other-subject' }, row.presentationName!, 0);
    expect(await db.player.count({ where: { presentationName: row.presentationName } })).toBe(2);
    await db.twitchIdentity.update({ where: { playerId: owner }, data: { login: 'new_login', displayName: 'NewTwitchName' } });
    expect((await db.player.findUniqueOrThrow({ where: { id: owner } })).presentationName).toBe(row.presentationName);
    expect((await new PrismaCurrentPlayerStore(db).findByIdentity('supabase', 'owner-subject'))?.id).toBe(owner);
  });
  it('searches current aliases in directory and MP while retaining stable IDs', async () => {
    await service.renamePresentation({ subject: 'other-subject' }, 'Lune privée', 1);
    const getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)), clock = { now: () => new Date() };
    const social = new SocialService(getPlayer, db, clock);
    const page = await social.directory({ subject: 'owner-subject' }, { q: 'Lune', page: 1 });
    expect(page.players.map(player => ({ id: player.id, name: player.displayName }))).toEqual([{ id: other, name: 'Lune privée' }]);
    const technical = await social.directory({ subject: 'owner-subject' }, { q: 'TechnicalOther', page: 1 });
    expect(technical.players.map(player => player.id)).toEqual([other]);
    const mp = await new DirectMessageService(db, getPlayer, clock).searchPlayers({ subject: 'owner-subject' }, 'Lune');
    expect(mp.players).toEqual(expect.arrayContaining([expect.objectContaining({ id: other, displayName: 'Lune privée' })]));
  });
  it('refuses a delayed old intention even after an ABA change, and safely replays its confirmed duplicate', async () => {
    const before = await db.player.findUniqueOrThrow({ where: { id: owner } });
    const first = await service.renamePresentation({ subject: 'owner-subject' }, 'New intention', before.presentationNameRevision);
    const duplicate = await service.renamePresentation({ subject: 'owner-subject' }, 'New intention', before.presentationNameRevision);
    expect(duplicate).toEqual(first);
    await expect(service.renamePresentation({ subject: 'owner-subject' }, 'Delayed old intention', before.presentationNameRevision)).rejects.toMatchObject({ code: 'PRESENTATION_NAME_CONFLICT' });
    await service.renamePresentation({ subject: 'owner-subject' }, before.presentationName!, first.revision);
    await expect(service.renamePresentation({ subject: 'owner-subject' }, 'Delayed ABA', before.presentationNameRevision)).rejects.toMatchObject({ code: 'PRESENTATION_NAME_CONFLICT' });
    expect((await db.player.findUniqueOrThrow({ where: { id: owner } })).presentationName).toBe(before.presentationName);
  });
  it('rechecks ACTIVE state inside the write transaction', async () => {
    await db.player.update({ where: { id: other }, data: { status: 'ARCHIVED' } });
    await expect(service.renamePresentation({ subject: 'other-subject' }, 'Forbidden', 2)).rejects.toMatchObject({ code: 'PLAYER_INACTIVE' });
  });
});
