import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { SharedInvocations } from '../src/application/gacha/shared-invocations.js';
import { PerformGachaPull, SetGachaTarget } from '../src/application/gacha/gacha-services.js';
const isolated = isolatedBatchDatabase(), db = isolated.database;
const players = new PrismaCurrentPlayerStore(db), getPlayer = new GetCurrentPlayer(players), store = new PrismaGachaStore(db);
let now = new Date();
const clock = { now: () => now };
const shared = new SharedInvocations(db, getPlayer, store, clock);
const random = { nextInt: (max: number) => max === 10000 ? 9999 : 0 };
const perform = new PerformGachaPull(getPlayer, store, clock, random);
beforeAll(async () => {
    await isolated.setup({ seedPublicCatalog: true, prismaMigrations: true });
}, 180000);
afterAll(() => isolated.cleanup(), 60000);
async function player() {
    const identity = { subject: `shared-private-${randomUUID()}` };
    const p = (await new GetOrProvisionCurrentPlayer(players).execute(identity, 'Diffusion privée')).player;
    await db.player.update({ where: { id: p.id }, data: { elementKey: 'hydro' } });
    await db.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: p.id, resourceKey: 'primogems' } }, data: { amount: 20000n } });
    const current = await store.getCurrent(p.id);
    if (!current)
        throw Error('Private reference banner absent');
    now = new Date((current.banner.startsAt.getTime() + current.banner.endsAt.getTime()) / 2);
    await db.playerGachaState.update({ where: { playerId: p.id }, data: { selectedBannerCharacterId: current.banner.featuredFiveStars[0]!.id } });
    return { identity, id: p.id, tab: randomUUID() };
}
async function pair() {
    const host = await player(), viewer = await player();
    const started = await shared.start(host.identity, host.tab);
    await shared.watch(viewer.identity, viewer.tab, started.broadcasting!.id);
    return { host, viewer, session: started.broadcasting! };
}
describe('private shared invocation PostgreSQL contract', () => {
    it('recovers the exact receipt banner and target after rotation, then prevents target mutation during presentation', async () => {
        const { host, viewer } = await pair(), key = randomUUID(), before = (await store.getCurrent(host.id))!, receiptTarget = before.playerState.selectedBannerCharacterId!;
        await shared.preparePull(host.identity, host.tab, key, 10);
        const committed = await perform.execute(host.identity, 10, key, host.tab);
        const movements = await db.resourceMovement.count({ where: { playerId: host.id } }), features = await db.bannerFeaturedCharacter.findMany({ where: { bannerRotationId: before.banner.id } });
        const replacement = await db.$transaction(async (tx) => {
            await tx.bannerRotation.update({ where: { id: before.banner.id }, data: { status: 'ENDED' } });
            return tx.bannerRotation.create({ data: { status: 'ACTIVE', startsAt: new Date(now.getTime() + 1), endsAt: new Date(now.getTime() + 7 * 86400000), featuredCharacters: { create: features.map(f => ({ characterId: f.characterId, rarity: f.rarity, slot: f.slot, selectionSource: f.selectionSource })) } } });
        });
        try {
            const changedTarget = before.banner.featuredFiveStars.find(c => c.id !== receiptTarget)!.id, target = new SetGachaTarget(getPlayer, store, clock);
            await target.execute(host.identity, changedTarget, undefined, undefined, host.tab);
            expect((await store.getCurrent(host.id))!.banner.id).toBe(replacement.id);
            const recovered = (await new SharedInvocations(db, getPlayer, store, clock).state(viewer.identity, viewer.tab)).watching!;
            expect(recovered.snapshot.gacha.banner.id).toBe(before.banner.id);
            expect(recovered.snapshot.gacha.playerState.selectedBannerCharacterId).toBe(receiptTarget);
            expect(recovered.snapshot.presentation.pull?.operation.id).toBe(committed.operation.id);
            await expect(target.execute(host.identity, changedTarget, undefined, undefined, host.tab)).rejects.toMatchObject({ code: 'SHARED_PRESENTATION_PENDING' });
            expect((await shared.state(viewer.identity, viewer.tab)).watching?.snapshot.gacha.banner.id).toBe(before.banner.id);
            expect(await db.pullOperation.count({ where: { playerId: host.id } })).toBe(1);
            expect(await db.resourceMovement.count({ where: { playerId: host.id } })).toBe(movements);
            expect(JSON.stringify(recovered.snapshot.gacha.banner)).not.toMatch(/legacyProvenance|generationVoteSnapshot|supersededAt/);
            const owner = (await shared.state(host.identity, host.tab)).broadcasting!;
            const summary = (await shared.control(host.identity, host.tab, 'skip', 'invocation', owner.seq)).broadcasting!;
            const closed = (await shared.control(host.identity, host.tab, 'close', 'invocation', summary.seq)).broadcasting!;
            expect(closed.snapshot.presentation).toEqual({ phase: 'idle', index: 0, pull: null });
            expect(closed.snapshot.gacha.banner.id).toBe(replacement.id);
            expect(closed.snapshot.gacha.playerState.selectedBannerCharacterId).toBe(changedTarget);
            expect((await shared.state(viewer.identity, viewer.tab)).watching?.snapshot.gacha).toEqual(closed.snapshot.gacha);
            expect(await db.pullOperation.count({ where: { playerId: host.id } })).toBe(1);
            expect(await db.resourceMovement.count({ where: { playerId: host.id } })).toBe(movements);
        }
        finally {
            await db.$transaction(async (tx) => {
                await tx.bannerRotation.update({ where: { id: replacement.id }, data: { status: 'ENDED' } });
                await tx.bannerRotation.update({ where: { id: before.banner.id }, data: { status: 'ACTIVE' } });
            });
        }
    }, 60000);
    it('rehearses normal Prisma migration and server-only RLS permissions', async () => {
        expect(isolated.migrationStatus).toContain('up to date');
        const result = await isolated.admin.query(`SELECT c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT') a,has_table_privilege('authenticated',c.oid,'SELECT') u FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=ANY($2)`, [isolated.schema, ['shared_invocation_sessions', 'shared_invocation_members']]);
        expect(result.rows).toHaveLength(2);
        for (const row of result.rows) {
            expect(row.relrowsecurity).toBe(true);
            expect(row.a).toBe(false);
            expect(row.u).toBe(false);
        }
    });
    it('invalidates an idle cursor after rotation and refreshes the minimal scene without activity or economic writes', async () => {
        const { host, viewer } = await pair(), before = (await shared.state(viewer.identity, viewer.tab)), current = (await store.getCurrent(host.id))!;
        const fields = await db.bannerFeaturedCharacter.findMany({ where: { bannerRotationId: current.banner.id } });
        const timing = await db.$queryRaw<{ last_gesture_at: Date; lease_until: Date }[]>`SELECT last_gesture_at,lease_until FROM shared_invocation_sessions WHERE owner_id=${host.id}::uuid`;
        const replacement = await db.$transaction(async tx => {
            await tx.bannerRotation.update({ where: { id: current.banner.id }, data: { status: 'ENDED' } });
            await tx.playerGachaState.update({ where: { playerId: host.id }, data: { selectedBannerCharacterId: null, pity4: 6, pity5: 51 } });
            return tx.bannerRotation.create({ data: { status: 'ACTIVE', startsAt: new Date(now.getTime() + 2), endsAt: new Date(now.getTime() + 7 * 86400000), featuredCharacters: { create: fields.map(f => ({ characterId: f.characterId, rarity: f.rarity, slot: f.slot, selectionSource: f.selectionSource })) } } });
        });
        try {
            const fresh = await shared.state(viewer.identity, viewer.tab, before.cursor);
            expect(fresh.unchanged).toBe(false);
            expect(fresh.watching?.seq).toBe(before.watching!.seq + 1);
            expect(fresh.watching?.snapshot.gacha.banner.id).toBe(replacement.id);
            expect(fresh.watching?.snapshot.gacha.playerState).toMatchObject({ selectedBannerCharacterId: null, pity4: 6, pity5: 51 });
            expect((await shared.state(host.identity, host.tab)).broadcasting?.snapshot.gacha).toEqual(fresh.watching!.snapshot.gacha);
            expect(await shared.state(viewer.identity, viewer.tab, fresh.cursor)).toMatchObject({ unchanged: true, cursor: fresh.cursor });
            expect(await db.$queryRaw`SELECT last_gesture_at,lease_until FROM shared_invocation_sessions WHERE owner_id=${host.id}::uuid`).toEqual(timing);
            expect(await db.pullOperation.count({ where: { playerId: host.id } })).toBe(0);
            expect(await db.resourceMovement.count({ where: { playerId: host.id } })).toBe(0);
        } finally {
            await db.$transaction(async tx => {
                await tx.bannerRotation.update({ where: { id: replacement.id }, data: { status: 'ENDED' } });
                await tx.bannerRotation.update({ where: { id: current.banner.id }, data: { status: 'ACTIVE' } });
            });
        }
    }, 60000);
    it('is opt-in, exclusive and binds one authoritative tab', async () => {
        const host = await player(), viewer = await player();
        expect((await shared.state(host.identity, host.tab)).broadcasting).toBeNull();
        const session = (await shared.start(host.identity, host.tab)).broadcasting!;
        await expect(shared.start(host.identity, randomUUID())).rejects.toMatchObject({ code: 'SHARED_AUTHORITY_REQUIRED' });
        await shared.watch(viewer.identity, viewer.tab, session.id);
        await expect(shared.start(viewer.identity, viewer.tab)).rejects.toMatchObject({ code: 'SHARED_MODE_CONFLICT' });
        await expect(shared.watch(host.identity, host.tab, session.id)).rejects.toMatchObject({ code: 'SHARED_MODE_CONFLICT' });
        await expect(shared.control(viewer.identity, viewer.tab, 'skip', 'invocation', session.seq)).rejects.toMatchObject({ code: 'SHARED_AUTHORITY_REQUIRED' });
        expect((await shared.state(host.identity, randomUUID())).broadcasting?.authoritative).toBe(false);
    });
    it('blocks spectator economic pulls and wrong-tab pulls inside the existing engine transaction', async () => {
        const { host, viewer } = await pair();
        await expect(perform.execute(viewer.identity, 1, randomUUID(), viewer.tab)).rejects.toMatchObject({ code: 'SHARED_SPECTATOR_READ_ONLY' });
        await expect(perform.execute(host.identity, 1, randomUUID(), randomUUID())).rejects.toMatchObject({ code: 'SHARED_AUTHORITY_REQUIRED' });
        expect(await db.pullOperation.count({ where: { playerId: { in: [host.id, viewer.id] } } })).toBe(0);
    });
    it('commits target and its public projection atomically, excluding spectators and other tabs', async () => {
        const { host, viewer } = await pair(), target = new SetGachaTarget(getPlayer, store, clock), current = await store.getCurrent(host.id), next = current!.banner.featuredFiveStars[1]!.id;
        await expect(target.execute(viewer.identity, next, undefined, undefined, viewer.tab)).rejects.toMatchObject({ code: 'SHARED_SPECTATOR_READ_ONLY' });
        await expect(target.execute(host.identity, next, undefined, undefined, randomUUID())).rejects.toMatchObject({ code: 'SHARED_AUTHORITY_REQUIRED' });
        await target.execute(host.identity, next, undefined, undefined, host.tab);
        const row = await db.$queryRaw<{
            snapshot: {
                gacha: {
                    playerState: {
                        selectedBannerCharacterId: string;
                    };
                };
            };
        }[]> `SELECT snapshot FROM shared_invocation_sessions WHERE owner_id=${host.id}::uuid`;
        expect(row[0]!.snapshot.gacha.playerState.selectedBannerCharacterId).toBe(next);
        expect((await shared.state(viewer.identity, viewer.tab)).watching?.snapshot.gacha.playerState.selectedBannerCharacterId).toBe(next);
    });
    it('keeps a durable pull intent when broadcast starts between preparation and the economic commit', async () => {
        const host = await player(), key = randomUUID();
        await shared.preparePull(host.identity, host.tab, key, 1);
        await shared.start(host.identity, host.tab);
        const committed = await perform.execute(host.identity, 1, key, host.tab);
        const restarted = new SharedInvocations(db, getPlayer, store, clock);
        expect((await restarted.state(host.identity, host.tab)).broadcasting?.snapshot.presentation.pull?.operation.id).toBe(committed.operation.id);
        expect(await db.pullOperation.count({ where: { playerId: host.id } })).toBe(1);
    });
    it('returns a small unchanged cursor and invalidates it on stop without extending inactivity', async () => {
        const { host, viewer } = await pair(), first = await shared.state(viewer.identity, viewer.tab);
        const before = await db.$queryRaw<{
            last_gesture_at: Date;
        }[]> `SELECT last_gesture_at FROM shared_invocation_sessions WHERE owner_id=${host.id}::uuid`;
        expect(await shared.state(viewer.identity, viewer.tab, first.cursor)).toMatchObject({ broadcasting: null, watching: null, unchanged: true, cursor: first.cursor });
        const after = await db.$queryRaw<{
            last_gesture_at: Date;
        }[]> `SELECT last_gesture_at FROM shared_invocation_sessions WHERE owner_id=${host.id}::uuid`;
        expect(after[0]!.last_gesture_at).toEqual(before[0]!.last_gesture_at);
        await shared.control(host.identity, host.tab, 'stop', 'invocation');
        expect(await shared.state(viewer.identity, viewer.tab, first.cursor)).toMatchObject({ watching: null, unchanged: false, cursor: 'idle' });
    });
    it('recovers an interrupted precommit intent only for the owner and reuses its original key', async () => {
        const { host, viewer } = await pair(), key = randomUUID();
        await shared.preparePull(host.identity, host.tab, key, 1);
        const restarted = new SharedInvocations(db, getPlayer, store, clock), owner = await restarted.state(host.identity, host.tab);
        expect(owner.broadcasting?.pendingPull).toEqual({ key, count: 1 });
        expect((await restarted.state(viewer.identity, viewer.tab)).watching).not.toHaveProperty('pendingPull');
        await expect(shared.preparePull(host.identity, host.tab, randomUUID(), 1)).rejects.toMatchObject({ code: 'SHARED_PULL_PENDING' });
        await shared.preparePull(host.identity, host.tab, key, 1);
        const committed = await perform.execute(host.identity, 1, key, host.tab);
        await shared.publishPull(host.identity);
        expect((await restarted.state(host.identity, host.tab)).broadcasting?.snapshot.presentation.pull?.operation.id).toBe(committed.operation.id);
        expect(await db.pullOperation.count({ where: { playerId: host.id } })).toBe(1);
    });
    it('ignores presence that arrives out of order and does not revive an earlier broadcast', async () => {
        const { host } = await pair(), session = (await shared.state(host.identity, host.tab)).broadcasting!;
        await shared.control(host.identity, host.tab, 'presence', 'other', undefined, 20, session.id);
        expect((await shared.control(host.identity, host.tab, 'presence', 'invocation', undefined, 19, session.id)).broadcasting?.status).toBe('PAUSED');
        await shared.control(host.identity, host.tab, 'stop', 'other');
        const next = (await shared.start(host.identity, host.tab)).broadcasting!;
        expect(next.id).not.toBe(session.id);
        expect((await shared.control(host.identity, host.tab, 'presence', 'other', undefined, 21, session.id)).broadcasting?.status).toBe('ACTIVE');
    });
    it('starts three players concurrently using the bounded pool without acquiring extra connections inside transactions', async () => {
        const owners = [await player(), await player(), await player()];
        const result = await Promise.all(owners.map(p => shared.start(p.identity, p.tab)));
        expect(result.every(r => r.broadcasting?.authoritative)).toBe(true);
        expect(isolated.poolSnapshot().waiting).toBe(0);
        expect(isolated.poolSnapshot().total).toBeLessThanOrEqual(3);
    }, 30000);
    it('recovers a committed x10 after a crash before publish and resumes at the current reveal', async () => {
        const { host, viewer } = await pair(), key = randomUUID();
        await shared.preparePull(host.identity, host.tab, key, 10);
        const result = await perform.execute(host.identity, 10, key, host.tab);
        const movements = await db.resourceMovement.count({ where: { playerId: host.id } });
        const recovered = await new SharedInvocations(db, getPlayer, store, clock).state(viewer.identity, viewer.tab);
        expect(recovered.watching?.snapshot.presentation.pull?.operation.id).toBe(result.operation.id);
        let current = (await shared.state(host.identity, host.tab)).broadcasting!;
        for (let i = 0; i < 5; i++)
            current = (await shared.control(host.identity, host.tab, 'advance', 'invocation', current.seq)).broadcasting!;
        const late = await player();
        await shared.watch(late.identity, late.tab, current.id);
        const lateState = (await shared.state(late.identity, late.tab)).watching!;
        expect(lateState.snapshot.presentation.index).toBe(4);
        const summary = (await shared.control(host.identity, host.tab, 'skip', 'invocation', current.seq)).broadcasting!;
        expect(summary.snapshot.presentation.phase).toBe('summary');
        expect(summary.snapshot.presentation.pull?.results).toHaveLength(10);
        await shared.preparePull(host.identity, host.tab, key, 10);
        const replay = await perform.execute(host.identity, 10, key, host.tab);
        expect(replay.operation.id).toBe(result.operation.id);
        expect(await db.resourceMovement.count({ where: { playerId: host.id } })).toBe(movements);
        expect(JSON.stringify(lateState)).not.toMatch(/resourceTotalsAfter|owner_id|tab_id|subject|totalPulls|xpAfter|primogemCost/);
    }, 60000);
    it('rejects stale duplicate advancement and preserves presentation across pause/resume', async () => {
        const { host } = await pair(), key = randomUUID();
        await shared.preparePull(host.identity, host.tab, key, 1);
        await perform.execute(host.identity, 1, key, host.tab);
        await shared.publishPull(host.identity);
        let own = (await shared.state(host.identity, host.tab)).broadcasting!;
        const seq = own.seq;
        own = (await shared.control(host.identity, host.tab, 'advance', 'invocation', seq)).broadcasting!;
        await expect(shared.control(host.identity, host.tab, 'advance', 'invocation', seq)).rejects.toMatchObject({ code: 'SHARED_STALE' });
        own = (await shared.control(host.identity, host.tab, 'presence', 'other')).broadcasting!;
        expect(own.status).toBe('PAUSED');
        expect(own.snapshot.presentation.phase).toBe('reveal');
        await expect(shared.control(host.identity, host.tab, 'skip', 'invocation', own.seq)).rejects.toMatchObject({ code: 'SHARED_PAUSED' });
        own = (await shared.control(host.identity, host.tab, 'presence', 'invocation')).broadcasting!;
        expect(own.snapshot.presentation.phase).toBe('reveal');
    });
    it('keeps heartbeat/viewer reads separate from authentic 45 minute activity', async () => {
        const { host, viewer } = await pair();
        const started = now.getTime();
        await db.$executeRaw `UPDATE shared_invocation_sessions SET lease_until=${new Date(started + 50 * 60000)} WHERE owner_id=${host.id}::uuid`;
        now = new Date(started + 44 * 60000);
        await shared.control(host.identity, host.tab, 'presence', 'other');
        now = new Date(started + 45 * 60000);
        expect((await shared.state(viewer.identity, viewer.tab)).watching).toBeNull();
        expect((await shared.state(host.identity, host.tab)).broadcasting).toBeNull();
    }, 60000);
    it('accepts real gesture elsewhere while technical reconnection expires after sixty seconds', async () => {
        const { host, viewer } = await pair();
        now = new Date(now.getTime() + 30000);
        await shared.control(host.identity, host.tab, 'gesture', 'other');
        now = new Date(now.getTime() + 59999);
        expect((await shared.state(viewer.identity, viewer.tab)).watching?.status).toBe('PAUSED');
        now = new Date(now.getTime() + 1);
        expect((await shared.state(viewer.identity, viewer.tab)).watching).toBeNull();
    });
    it('enforces emoji cooldown per Player across tabs, allows simultaneous distinct viewers and prunes ephemeral data', async () => {
        const { host, viewer, session } = await pair(), other = await player();
        await shared.watch(other.identity, other.tab, session.id);
        const settled = await Promise.allSettled([shared.react(viewer.identity, viewer.tab, '🎉'), shared.react(viewer.identity, randomUUID(), '✨')]);
        expect(settled.filter(x => x.status === 'fulfilled')).toHaveLength(1);
        await shared.react(other.identity, other.tab, '👏');
        expect((await shared.state(host.identity, host.tab)).broadcasting?.reactions).toHaveLength(2);
        now = new Date(now.getTime() + 4001);
        expect((await shared.state(host.identity, host.tab)).broadcasting?.reactions).toHaveLength(0);
        const rows = await db.$queryRaw<{
            reactions: unknown[];
        }[]> `SELECT reactions FROM shared_invocation_sessions WHERE owner_id=${host.id}::uuid`;
        expect(rows[0]?.reactions).toHaveLength(0);
    });
    it('voluntary stop is immediate and restores all viewers without economic mutation', async () => {
        const { host, viewer, session } = await pair();
        await shared.control(host.identity, host.tab, 'stop', 'invocation');
        expect((await shared.state(viewer.identity, viewer.tab)).watching).toBeNull();
        expect((await shared.list(viewer.identity)).sessions.some(s => s.id === session.id)).toBe(false);
        expect(await db.pullOperation.count({ where: { playerId: host.id } })).toBe(0);
    });
});
