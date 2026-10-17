import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { BirthdayService } from '../src/application/birthday/birthday-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { SocialService } from '../src/application/social/social-service.js';
import { PrismaEconomyService } from '../src/infrastructure/database/prisma-economy-service.js';
import { buildApp } from '../src/app.js';
const isolated = isolatedBatchDatabase(), db = isolated.database;
let now = new Date('2026-10-17T12:00:00Z');
const clock = { now: () => now };
const playerStore = { findByIdentity: async (_provider: string, id: string) => { const p = await db.player.findUnique({ where: { id } }); return p ? { id, displayName: p.displayName, status: p.status, elementKey: p.elementKey } : null }, provision: async () => { throw Error('no provision') } };
const getPlayer = new GetCurrentPlayer(playerStore), service = new BirthdayService(getPlayer, db, clock), social = new SocialService(getPlayer, db, clock);
let app: Awaited<ReturnType<typeof buildApp>>;
beforeAll(async () => { await isolated.setup({ seedPublicCatalog: true, prismaMigrations: true }); app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, { authIdentityVerifier: { verify: async token => ({ subject: token }) }, getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore), socialService: social }); }, 180000);
afterAll(async () => { await app?.close(); await isolated.cleanup() }, 60000);
async function player() { const id = randomUUID(); await db.player.create({ data: { id, displayName: 'Anniversaire privé', elementKey: 'hydro', resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) }, economyStats: { create: {} }, gachaState: { create: {} }, progression: { create: {} } } }); return id }
const identity = (id: string) => ({ subject: id });
const register = (id: string, day: number, month: number) => service.register(identity(id), day, month);
const balances = async (id: string) => Object.fromEntries((await db.playerResourceBalance.findMany({ where: { playerId: id } })).map(r => [r.resourceKey, r.amount]));
async function expectBirthdayWallet(id: string, count: number) {
  const rows = await db.resourceMovement.findMany({ where: { playerId: id }, include: { operation: true } });
  const birthday = rows.filter(r => r.domainKey === 'birthday'), missions = rows.filter(r => r.domainKey === 'missions');
  expect(birthday).toHaveLength(count * 2);
  expect(birthday.filter(r => r.resourceKey === 'primogems').every(r => r.delta === 50000n)).toBe(true);
  expect(birthday.filter(r => r.resourceKey === 'moras').every(r => r.delta === 200000n)).toBe(true);
  expect(rows).toHaveLength(birthday.length + missions.length);
  expect(missions.every(r => r.resourceKey === 'primogems' && r.operation?.operationType === 'permanent-mission.reward')).toBe(true);
  // Existing earned-Moras Missions remain separate, authorized and separately notified.
  expect(await balances(id)).toMatchObject({ primogems: BigInt(count)*50000n + missions.reduce((n, r) => n + r.delta, 0n), moras: BigInt(count)*200000n });
}
const operations = (id: string) => db.businessOperation.findMany({ where: { playerId: id, operationType: 'birthday.grant' } });
describe('Birthday private PostgreSQL / migration087', () => {
  it('keeps registration optional, rejects impossible dates, accepts February29 and exact retries', async () => {
    now = new Date('2026-02-28T10:00:00Z'); const id = await player();
    expect(await service.read(id)).toBeNull();
    for (const [day, month] of [[31, 4], [30, 2], [0, 1], [1, 13]]) await expect(register(id, day!, month!)).rejects.toMatchObject({ code: 'BIRTHDAY_INVALID' });
    expect(await register(id, 29, 2)).toEqual({ day: 29, month: 2 });
    const initial = await db.player.findUniqueOrThrow({ where: { id } });
    expect(await register(id, 29, 2)).toEqual({ day: 29, month: 2 });
    expect((await db.player.findUniqueOrThrow({ where: { id } })).birthdayRegisteredAt).toEqual(initial.birthdayRegisteredAt);
    await expect(register(id, 28, 2)).rejects.toMatchObject({ code: 'BIRTHDAY_IMMUTABLE' });
    await service.processPlayer(id);
    await expectBirthdayWallet(id, 1);
  });
  it('serializes competing registrations; the winning date alone becomes immutable', async () => {
    now = new Date('2026-10-17T12:00:00Z'); const id = await player();
    const results = await Promise.allSettled([register(id, 18, 10), register(id, 19, 10)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'BIRTHDAY_IMMUTABLE' } });
    const record = await service.read(id); expect([18, 19]).toContain(record!.day);
    await register(id, record!.day, 10); expect(await operations(id)).toHaveLength(0);
  });
  it('grants both resources once at Paris midnight, independently of sessions, with concurrent workers', async () => {
    now = new Date('2026-10-16T22:00:00Z'); const id = await player(); await register(id, 17, 10);
    await Promise.all([service.processCurrentDate(), new BirthdayService(getPlayer, db, clock).processCurrentDate()]);
    await expectBirthdayWallet(id, 1);
    const grants = await operations(id); expect(grants).toHaveLength(1); expect(grants[0]).toMatchObject({ sourceChannel: 'SYSTEM', status: 'COMPLETED', resultSummary: { year: 2026, primogems: '50000', moras: '200000' } });
    expect(await db.resourceMovement.count({ where: { operationId: grants[0]!.id } })).toBe(2);
    expect(await db.playerSession.count({ where: { playerId: id } })).toBe(0);
    const notification = await db.notification.findFirstOrThrow({ where: { playerId: id, typeKey: 'BIRTHDAY_REWARD' } });
    await db.notification.update({ where: { id: notification.id }, data: { state: 'ARCHIVED', archivedAt: now } });
    await new BirthdayService(getPlayer, db, clock).processPlayer(id);
    expect(await operations(id)).toHaveLength(1); expect(await db.notification.count({ where: { playerId: id, typeKey: 'BIRTHDAY_REWARD' } })).toBe(1);
    expect((await db.notification.findUniqueOrThrow({ where: { id: notification.id } })).state).toBe('ARCHIVED');
  });
  it('catches up every missed eligible year but none before registration', async () => {
    now = new Date('2026-01-01T12:00:00Z'); const id = await player(); await register(id, 1, 1);
    now = new Date('2029-01-01T12:00:00Z'); await service.processCurrentDate(); await service.processCurrentDate();
    await expectBirthdayWallet(id, 4);
    expect((await operations(id)).map(o => (o.resultSummary as { year: number }).year).sort()).toEqual([2026, 2027, 2028, 2029]);
    expect((await db.player.findUniqueOrThrow({ where: { id } })).birthdayLastRewardYear).toBe(2029);
  });
  it('does not credit a birthday before registration and respects February29 in leap years', async () => {
    now = new Date('2026-03-01T12:00:00Z'); const id = await player(); await register(id, 29, 2); await service.processPlayer(id);
    expect(await operations(id)).toHaveLength(0);
    now = new Date('2027-02-28T12:00:00Z'); await service.processPlayer(id); expect(await operations(id)).toHaveLength(1);
    now = new Date('2028-02-28T12:00:00Z'); await service.processPlayer(id); expect(await operations(id)).toHaveLength(1);
    now = new Date('2028-02-29T12:00:00Z'); await service.processPlayer(id); expect(await operations(id)).toHaveLength(2);
  });
  it('rolls both credits, the receipt, notice and annual cursor back if the second credit fails', async () => {
    now = new Date('2026-10-17T12:00:00Z'); const id = await player(); await register(id, 17, 10);
    const economy = new PrismaEconomyService(() => now), original = economy.credit.bind(economy);
    vi.spyOn(economy, 'credit').mockImplementation(async (tx, input) => { if (input.resourceKey === 'moras') throw Error('Synthetic second-leg outage'); return original(tx, input) });
    await expect(new BirthdayService(getPlayer, db, clock, economy).processPlayer(id)).rejects.toThrow('Synthetic second-leg outage');
    expect(await balances(id)).toMatchObject({ primogems: 0n, moras: 0n }); expect(await operations(id)).toHaveLength(0);
    expect(await db.notification.count({ where: { playerId: id } })).toBe(0);
    expect((await db.player.findUniqueOrThrow({ where: { id } })).birthdayLastRewardYear).toBe(2025);
    await service.processPlayer(id); expect(await operations(id)).toHaveLength(1);
  });
  it('excludes archived and suspended players after registration', async () => {
    now = new Date('2026-10-17T12:00:00Z');
    for (const status of ['ARCHIVED', 'SUSPENDED'] as const) { const id = await player(); await register(id, 17, 10); await db.player.update({ where: { id }, data: { status } }); await service.processPlayer(id); expect(await operations(id)).toHaveLength(0) }
  });
  it('filters birthday DTOs server-side for friends and strangers and toggles only Public/Private', async () => {
    now = new Date('2026-10-17T12:00:00Z'); const owner = await player(), viewer = await player(); await register(owner, 18, 10);
    const [playerAId, playerBId] = [owner, viewer].sort(); await db.friendship.create({ data: { playerAId: playerAId!, playerBId: playerBId!, state: 'ACTIVE' } });
    const read = (id: string) => app.inject({ url: '/api/v1/players/' + owner + '/profile', headers: { authorization: 'Bearer ' + id } });
    expect((await read(owner)).json().birthday).toEqual({ access: 'ALLOWED', data: { day: 18, month: 10 } });
    expect((await read(viewer)).json().birthday).toEqual({ access: 'PRIVATE' });
    await social.privacy.save(owner, 'BIRTHDAY', 'PUBLIC');
    expect((await read(viewer)).json().birthday).toEqual({ access: 'ALLOWED', data: { day: 18, month: 10 } });
    await social.privacy.save(owner, 'BIRTHDAY', 'PRIVATE'); expect((await read(viewer)).json().birthday).toEqual({ access: 'PRIVATE' });
    await expect(social.privacy.save(owner, 'BIRTHDAY', 'FRIENDS')).rejects.toMatchObject({ code: 'BIRTHDAY_PRIVACY_INVALID' });
    expect(await service.read(owner)).toEqual({ day: 18, month: 10 });
    const directory = await social.directory(identity(viewer), { q: '', page: 1 }); expect(JSON.stringify(directory)).not.toContain('birthday');
  }, 30000);
  it('requires authenticated self and explicit confirmation; rejects year or target fields', async () => {
    now = new Date('2026-10-17T12:00:00Z'); const id = await player(), peer = await player();
    const post = (payload: object, authenticated = true) => app.inject({ method: 'POST', url: '/api/v1/me/birthday', ...(authenticated ? { headers: { authorization: 'Bearer ' + id } } : {}), payload });
    expect((await post({ day: 17, month: 10, confirmation: true }, false)).statusCode).toBe(401);
    for (const extra of [{}, { confirmation: false }, { confirmation: true, year: 2000 }, { confirmation: true, playerId: peer }]) expect((await post({ day: 17, month: 10, ...extra })).statusCode).toBe(400);
    expect((await post({ day: 17, month: 10, confirmation: true })).json()).toEqual({ day: 17, month: 10 });
    expect(await service.read(peer)).toBeNull();
  });
});
