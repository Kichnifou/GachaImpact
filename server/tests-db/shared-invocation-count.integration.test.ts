import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { PrismaGachaStore } from '../src/infrastructure/database/prisma-gacha-store.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { SharedInvocations } from '../src/application/gacha/shared-invocations.js';
const isolated = isolatedBatchDatabase(), db = isolated.database;
const players = new PrismaCurrentPlayerStore(db), getPlayer = new GetCurrentPlayer(players), store = new PrismaGachaStore(db);
let now = new Date();
const clock = { now: () => now };
const shared = new SharedInvocations(db, getPlayer, store, clock);
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

describe('lightweight available broadcaster count', () => {
    it('counts distinct owners including paused leases, excludes stopped/expired/inactive sessions and never prunes', async () => {
        const host = await player(), other = await player(), viewer = await player();
        expect(await shared.availableCount(viewer.identity)).toEqual({ count: 0 });
        await shared.start(host.identity, host.tab);
        const second = (await shared.start(other.identity, other.tab)).broadcasting!;
        expect(await shared.availableCount(viewer.identity)).toEqual({ count: 2 });
        await db.$executeRaw`UPDATE shared_invocation_sessions SET status='PAUSED' WHERE id=${second.id}::uuid`;
        expect(await shared.availableCount(viewer.identity)).toEqual({ count: 2 });
        await shared.control(host.identity, host.tab, 'stop', 'invocation');
        expect(await shared.availableCount(viewer.identity)).toEqual({ count: 1 });
        await shared.start(host.identity, host.tab);
        expect(await shared.availableCount(viewer.identity)).toEqual({ count: 2 });
        await shared.control(host.identity, host.tab, 'stop', 'invocation');
        await db.$executeRaw`UPDATE shared_invocation_sessions SET lease_until=${new Date(now.getTime()-1)} WHERE id=${second.id}::uuid`;
        expect(await shared.availableCount(viewer.identity)).toEqual({ count: 0 });
        const unchanged = await db.$queryRaw<{ status: string }[]>`SELECT status FROM shared_invocation_sessions WHERE id=${second.id}::uuid`;
        expect(unchanged).toEqual([{ status: 'PAUSED' }]);
        await db.$executeRaw`UPDATE shared_invocation_sessions SET lease_until=${new Date(now.getTime()+60_000)}, last_gesture_at=${new Date(now.getTime()-46*60_000)} WHERE id=${second.id}::uuid`;
        expect(await shared.availableCount(viewer.identity)).toEqual({ count: 0 });
    }, 60_000);
    it('rejects an archived viewer without exposing the count', async () => {
        const viewer = await player();
        await db.player.update({ where: { id: viewer.id }, data: { status: 'ARCHIVED' } });
        await expect(shared.availableCount(viewer.identity)).rejects.toThrow();
    });
});
