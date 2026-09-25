import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { RankingService, findRanking, rankingRegistry } from '../src/application/ranking/ranking-service.js';

function player(id: string, xp: bigint, overrides: Record<string, 'PUBLIC' | 'FRIENDS' | 'PRIVATE'> = {}) {
  return {
    id, displayName: id, status: 'ACTIVE', elementKey: 'pyro',
    privacySettings: Object.entries(overrides).map(([categoryKey, level]) => ({ categoryKey, level })),
    progression: { xp, totalMessages: xp, countedMessages: xp },
    gachaState: { totalPulls: 100n, totalFiveStars: 2n, totalFourStars: 10n, pity5: 7, fiftyFiftyWon: 1n, fiftyFiftyLost: 0n },
    economyStats: { totalPrimosEarned: 100n, totalPrimosSpent: 50n, totalMorasEarned: 100n, totalMorasSpent: 50n },
    combatStats: { totalWins: 3n, totalManualWins: 2n }, expedition: { totalCompleted: 4n }, socialStats: { totalFriendHeartsSent: 5n },
    bankAccount: { balance: 200n }, resourceBalances: [{ resourceKey: 'moras', amount: 100n }, { resourceKey: 'primogems', amount: 10n }, ...['pyro','hydro','cryo','electro','anemo','geo','dendro'].map(key => ({ resourceKey: `particles_${key}`, amount: 1n }))],
    characters: [{ constellation: 6, copies: 7 }, { constellation: 0, copies: 1 }],
  };
}
function harness(rows: ReturnType<typeof player>[]) {
  const findMany = vi.fn(async (_query?: unknown) => rows);
  const findUnique = vi.fn(async (query?: { where?: { id?: string }; select?: { status?: boolean } }) => query?.select?.status
    ? rows.find(row => row.id === query.where?.id) ?? null
    : { displayName: 'Self', progression: { xp: 100n }, gachaState: { totalPulls: 1n, totalFiveStars: 1n, pity5: 2 }, resourceBalances: [{ resourceKey: 'primogems', amount: 10n }, { resourceKey: 'moras', amount: 20n }], characters: [{ constellation: 6 }] });
  const database = { player: { findMany, findUnique } } as unknown as PrismaClient;
  return { service: new RankingService(database), findMany, findUnique };
}
describe('global rankings R714–R727', () => {
  it('registers all 32 metrics and historical aliases without specialist rankings', () => {
    expect(rankingRegistry).toHaveLength(32);
    const aliases = rankingRegistry.flatMap(metric => metric.aliases);
    expect(new Set(aliases).size).toBe(aliases.length);
    expect(findRanking('luck')?.id).toBe('rate5');
    expect(findRanking('50/50')?.id).toBe('won5050');
    expect(findRanking('event')).toBeUndefined();
  });
  it('filters private, friends and zero before competition ranks and paginates afterwards', async () => {
    const { service, findMany } = harness([
      player('A', 100n), player('B', 100n), player('C', 90n), player('D', 200n, { GENERAL_STATISTICS: 'PRIVATE' }),
      player('E', 300n, { GENERAL_STATISTICS: 'FRIENDS' }), player('F', 0n),
    ]);
    const first = await service.list('xp', 'C', 1, 2);
    const second = await service.list('xp', 'C', 2, 2);
    expect(first?.entries.map(entry => entry.rank)).toEqual([1, 1]);
    expect(second?.entries.map(entry => entry.rank)).toEqual([3]);
    expect(first?.total).toBe(3);
    expect(first?.self?.rank).toBe(3);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'ACTIVE', elementKey: { not: null } } }));
  });
  it('requires both public permissions for wealth and omits missing source rows', async () => {
    const rows = [player('A', 1n, { CURRENCY_BALANCES: 'PUBLIC', BANK: 'PUBLIC' }), player('B', 1n, { CURRENCY_BALANCES: 'PUBLIC' }), player('C', 1n, { BANK: 'PUBLIC' })];
    const { service } = harness(rows);
    expect((await service.list('moras', 'B'))?.entries.map(entry => [entry.playerId, entry.value])).toEqual([['A', '300']]);
    rows[0]!.bankAccount = null as unknown as { balance: bigint };
    expect((await service.list('moras', 'A'))?.entries).toEqual([]);
  });
  it('orders five-star rates by exact fractions after the 100-pull threshold', async () => {
    const rows = [player('A', 1n), player('B', 1n), player('C', 1n)];
    rows[0]!.gachaState.totalPulls = 101n; rows[0]!.gachaState.totalFiveStars = 2n;
    rows[1]!.gachaState.totalPulls = 100n; rows[1]!.gachaState.totalFiveStars = 2n;
    rows[2]!.gachaState.totalPulls = 99n; rows[2]!.gachaState.totalFiveStars = 50n;
    const { service } = harness(rows);
    expect((await service.list('rate5', 'C'))?.entries.map(entry => [entry.playerId, entry.rank])).toEqual([['B', 1], ['A', 2]]);
    expect((await service.list('rate5', 'C'))?.self).toBeNull();
    expect((await service.list('rate5', 'C'))?.selfStatus).toBe('NOT_ELIGIBLE');
  });
  it('distinguishes rates that round to the same text and keeps bigint scores lossless', async () => {
    const rows = [player('A', 9007199254740993n), player('B', 9007199254740992n)];
    rows[0]!.gachaState.totalPulls = 10_000n; rows[0]!.gachaState.totalFiveStars = 123n;
    rows[1]!.gachaState.totalPulls = 1_000_000n; rows[1]!.gachaState.totalFiveStars = 12_301n;
    const { service } = harness(rows);
    expect((await service.list('rate5', 'A'))?.entries.map(entry => [entry.playerId, entry.rank, entry.value])).toEqual([['B', 1, '1.23 %'], ['A', 2, '1.23 %']]);
    expect((await service.list('xp', 'A'))?.entries[0]?.value).toBe('9007199254740993');
  });
  it('formats at most five chat leaders and adds only an eligible outside personal rank', async () => {
    const rows = Array.from({ length: 7 }, (_, index) => player(`P${index + 1}`, BigInt(70 - index * 10)));
    const { service } = harness(rows);
    const xp = findRanking('xp')!;
    const outside = await service.chatTop(xp, 'P7');
    expect((outside.match(/#\d+ P\d+/gu) ?? [])).toHaveLength(5);
    expect(outside).toContain('Vous : #7');
    expect(await service.chatTop(xp, 'P1')).not.toContain('Vous :');
    rows[6]!.privacySettings.push({ categoryKey: 'GENERAL_STATISTICS', level: 'PRIVATE' });
    expect(await service.chatTop(xp, 'P7')).not.toContain('Vous :');
    expect((await service.list('xp', 'P7'))?.selfStatus).toBe('NOT_PUBLIC');
  });
  it('counts only active catalogue possessions and reads personal data without publishing a rank', async () => {
    const { service, findMany, findUnique } = harness([player('A', 1n)]);
    expect((await service.list('copies', 'A'))?.entries[0]?.value).toBe('8');
    expect((await service.list('c6', 'A'))?.entries[0]?.value).toBe('1');
    expect(findMany.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ select: expect.objectContaining({ characters: { where: { character: { isActive: true } }, select: { constellation: true, copies: true } } }) }));
    const personal = await service.personal('A');
    expect(personal).toContain('XP 100');
    expect(personal).toContain('niveau 3');
    expect(personal).toContain('Taux 5★ 100.00 %');
    expect(personal).toContain('Primos 10 · Moras 20 · Box 1 · C6 1');
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect((await service.list('unknown', 'A'))).toBeNull();
  });
});
