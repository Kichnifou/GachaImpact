import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { readTwitchBossContributions, readTwitchBossHistory } from '../src/application/combat/monthly-boss-archive-history.js';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';
import { bossArchiveFixture } from './fixtures/monthly-boss-archive.js';

function fixture(counts?: number[]) {
  const proof = bossArchiveFixture(counts);
  const database = { $queryRaw: vi.fn(async () => [proof.projected]), player: { findMany: vi.fn(async () => proof.players) } };
  return { ...proof, database, client: database as never };
}
const json = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);

describe('read-only Twitch Boss archive projection', () => {
  it('exposes the complete 27 proven contributions across three distinct archives without native IDs or raw source names', async () => {
    const f = fixture(), before = structuredClone(f.projected);
    const entries = await readTwitchBossHistory(f.client);
    expect(entries).toHaveLength(3);
    expect(entries.map(row => row.contributions.total)).toEqual([10, 9, 8]);
    expect(entries.flatMap(row => row.contributions.entries)).toHaveLength(27);
    expect(entries.map(row => row.status)).toEqual(['DEFEATED', 'DEFEATED', 'INTERRUPTED']);
    expect(entries.every(row => row.origin === 'TWITCH_ARCHIVE' && row.baseHp === null && row.nextBaseAdjustment === null
      && row.victoryDayCount === null && row.daysRemainingAfterVictory === null && row.records.biggestHit?.createdAt === null)).toBe(true);
    expect(entries.every(row => /^twitch-[a-f0-9]{64}$/.test(row.id))).toBe(true);
    for (const row of entries.flatMap(entry => entry.contributions.entries)) expect(f.players.find(player => player.id === row.playerId)?.displayName).toBe(row.displayName);
    expect(json(entries)).not.toContain(f.projected.sourceKey);
    expect(json(entries)).not.toContain(f.projected.id);
    expect(json(entries)).not.toContain(f.players[0]!.twitchIdentity.twitchUserId);
    expect(f.projected).toEqual(before);
    expect(Object.keys(f.database).sort()).toEqual(['$queryRaw', 'player']);
  });

  it('retains source aggregate facts while hiding ARCHIVED rankings and anonymizing the final blow', async () => {
    const f = fixture(); f.players[0]!.status = 'ARCHIVED';
    const entries = await readTwitchBossHistory(f.client);
    expect(entries[0]!.community.participantCount).toBe(10);
    expect(entries[0]!.contributions.total).toBe(9);
    expect(entries.flatMap(row => row.contributions.entries).some(row => row.playerId === f.players[0]!.id)).toBe(false);
    expect(entries[0]!.records.finalBlow).toEqual({ id: f.players[0]!.id, displayName: 'Progression archivée' });
    expect(json(entries)).not.toContain(JSON.stringify(f.players[0]!.displayName));
  });

  it('paginates complete participant rankings on the server without silently returning only a top three', async () => {
    const f = fixture([12]); const [archive] = await readTwitchBossHistory(f.client);
    expect(archive!.contributions).toMatchObject({ page: 1, pageSize: 10, total: 12, totalPages: 2 });
    expect(archive!.contributions.entries).toHaveLength(10);
    const page2 = await readTwitchBossContributions(f.client, archive!.id, 2);
    expect(page2.entries.map(row => row.rank)).toEqual([11, 12]);
    expect(new Set([...archive!.contributions.entries, ...page2.entries].map(row => row.playerId)).size).toBe(12);
    expect((await readTwitchBossContributions(f.client, archive!.id, 3)).entries).toEqual([]);
    await expect(readTwitchBossContributions(f.client, archive!.id, 0)).rejects.toThrow('page');
    await expect(readTwitchBossContributions(f.client, 'native-boss-id', 1)).rejects.toThrow('introuvable');
    await expect(readTwitchBossContributions(f.client, 'twitch-' + 'f'.repeat(64), 1)).rejects.toThrow('introuvable');
  });

  it('never resolves a changed identity through a matching name or another Player', async () => {
    const f = fixture(); f.players[0]!.twitchIdentity.twitchUserId = '999999';
    await expect(readTwitchBossHistory(f.client)).rejects.toThrow('indisponibles');
  });

  it.each(['count', 'sum', 'unknownDate', 'duplicatePlayer', 'missingBindings'])('fails closed on malformed %s proof', async kind => {
    const f = fixture();
    if (kind === 'count') f.projected.bindings[0]!.instances[0]!.participantCount++;
    if (kind === 'sum') f.projected.bindings[0]!.instances[0]!.contribution!.totalDamage = '1000';
    if (kind === 'unknownDate') (f.projected.bindings[0]!.instances[0]!.contribution as unknown as { firstAttackAt: string }).firstAttackAt = '2026-08-01T00:00:00Z';
    if (kind === 'duplicatePlayer') f.projected.bindings.push(f.projected.bindings[0]!);
    if (kind === 'missingBindings') f.projected.bindings.length = 0;
    await expect(readTwitchBossHistory(f.client)).rejects.toThrow('indisponibles');
  });

  it('deduplicates equal evidence but refuses conflicting authorities instead of choosing the latest journal', async () => {
    const f = fixture(), duplicate = structuredClone(f.projected);
    f.database.$queryRaw.mockResolvedValue([f.projected, duplicate]);
    expect(await readTwitchBossHistory(f.client)).toHaveLength(3);
    duplicate.sourceKey = '2'.repeat(64);
    for (const binding of duplicate.bindings) binding.instances[0]!.name = 'Conflicting historical boss';
    await expect(readTwitchBossHistory(f.client)).rejects.toThrow('indisponibles');
  });

  it('combines native and Twitch instances in one stable history without attaching by month', async () => {
    const f = fixture();
    const native = { id: 'native-september', monthStart: new Date('2026-09-01'), nameSnapshot: 'Native September', baseHp: 1500n,
      maxHp: 1500n, currentHp: 1000n, resistanceElementKey: 'anemo', defeatedAt: null, finalBlowPlayer: null };
    const database = { ...f.database, monthlyBoss: { findMany: vi.fn(async (input: { select?: unknown }) => input.select ? [{ id: native.id, monthStart: native.monthStart }] : [native]) },
      playerBossParticipation: { findMany: vi.fn(async () => []) }, bossAttack: { findMany: vi.fn(async () => []) } };
    const service = new MonthlyBossService({} as never, database as never, { now: () => new Date('2026-10-09T15:00:00Z') }, { nextInt: () => { throw Error('RNG forbidden'); } });
    const result = await service.getHistory(1);
    expect(result.total).toBe(4);
    expect(result.bosses.map(row => [row.monthStart, row.origin])).toEqual([
      ['2026-10-01', 'TWITCH_ARCHIVE'], ['2026-09-01', 'NATIVE'], ['2026-09-01', 'TWITCH_ARCHIVE'], ['2026-08-01', 'TWITCH_ARCHIVE'],
    ]);
    expect(result.bosses.find(row => row.origin === 'NATIVE')).toMatchObject({ id: native.id, currentHp: 1000n, status: 'FAILED', baseHp: 1500n, contributions: null });
    expect(native.currentHp).toBe(1000n);
  });

  it('paginates the combined history through archive-only, mixed and native-only pages', async () => {
    const f = fixture([1]), first = f.projected.bindings[0]!.instances[0]!;
    f.projected.bindings[0]!.instances = Array.from({ length: 12 }, (_, index) => {
      const month = `2025-${String(index + 1).padStart(2, '0')}`, createdAt = `${month}-01T00:00:00.000Z`, defeated = index < 11;
      return { ...structuredClone(first), month, createdAt, name: `Archive ${month}`,
        sourceBossKey: createHash('sha256').update(JSON.stringify(['streamerbot-boss-v1', month, createdAt])).digest('hex'),
        maxHp: defeated ? '100' : '300', currentHp: defeated ? '0' : '200', defeated,
        defeatedAt: defeated ? `${month}-15T00:00:00.000Z` : null, rewardsDistributed: defeated,
        contribution: { ...first.contribution!, lastAttackDate: `${month}-06`, finalBlow: defeated, reward: { ...first.contribution!.reward, distributed: defeated } },
      };
    });
    const natives = Array.from({ length: 15 }, (_, index) => ({ id: `native-${index}`, monthStart: new Date(Date.UTC(2024, 11 - index, 1)),
      nameSnapshot: `Native ${index}`, baseHp: 1000n, maxHp: 1000n, currentHp: 500n, resistanceElementKey: 'pyro', defeatedAt: null, finalBlowPlayer: null }));
    const database = { ...f.database, monthlyBoss: { findMany: vi.fn(async (input: { select?: unknown; where: { id?: { in: string[] } } }) =>
      input.select ? natives.map(({ id, monthStart }) => ({ id, monthStart })) : natives.filter(row => input.where.id!.in.includes(row.id))) },
      playerBossParticipation: { findMany: vi.fn(async () => []) }, bossAttack: { findMany: vi.fn(async () => []) } };
    const service = new MonthlyBossService({} as never, database as never, { now: () => new Date('2026-10-09T15:00:00Z') }, { nextInt: () => 0 });
    const pages = await Promise.all([1, 2, 3].map(page => service.getHistory(page)));
    expect(pages.map(page => page.bosses.length)).toEqual([10, 10, 7]);
    expect(pages[0]!.bosses.every(row => row.origin === 'TWITCH_ARCHIVE')).toBe(true);
    expect(pages[1]!.bosses.map(row => row.origin).slice(0, 3)).toEqual(['TWITCH_ARCHIVE', 'TWITCH_ARCHIVE', 'NATIVE']);
    expect(pages[2]!.bosses.every(row => row.origin === 'NATIVE')).toBe(true);
    expect(new Set(pages.flatMap(page => page.bosses.map(row => row.id))).size).toBe(27);
  });

  it('keeps native history accessible with an explicit archive warning when approved proof is malformed', async () => {
    const f = fixture(); f.projected.bindings.length = 0;
    const native = { id: 'native-september', monthStart: new Date('2026-09-01'), nameSnapshot: 'Native', baseHp: 1000n,
      maxHp: 1000n, currentHp: 500n, resistanceElementKey: 'pyro', defeatedAt: null, finalBlowPlayer: null };
    const database = { ...f.database, monthlyBoss: { count: vi.fn(async () => 1), findMany: vi.fn(async () => [native]) },
      playerBossParticipation: { findMany: vi.fn(async () => []) }, bossAttack: { findMany: vi.fn(async () => []) } };
    const service = new MonthlyBossService({} as never, database as never, { now: () => new Date('2026-10-09T15:00:00Z') }, { nextInt: () => 0 });
    expect(await service.getHistory(1)).toMatchObject({ archiveStatus: 'UNAVAILABLE', total: 1, bosses: [{ id: native.id, origin: 'NATIVE' }] });
    database.$queryRaw.mockRejectedValueOnce(Error('database unavailable'));
    await expect(service.getHistory(1)).rejects.toThrow('database unavailable');
  });
});
