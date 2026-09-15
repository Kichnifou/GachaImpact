import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { GIFT_CODE_RECONCILIATION_CONCURRENCY, GiftCodeScheduler, GiftCodeService } from '../src/application/gift-code/gift-code-service.js';

const identity = { subject: 'admin-subject' };
const now = new Date('2026-09-14T12:00:00.000Z');

function claimantHarness(total: number) {
  const claims = Array.from({ length: total }, (_, index) => ({
    playerId: `player-${String(index).padStart(3, '0')}`,
    giftCodeEditionId: `edition-${String(index % 3).padStart(3, '0')}`,
    claimedAt: new Date(now.getTime() - index * 1_000),
    player: { id: `player-${String(index).padStart(3, '0')}`, displayName: `Joueur ${index}` },
    edition: { editionKey: String(2026 - (index % 3)) },
  }));
  const findMany = vi.fn(async (args: { skip: number; take: number }) => claims.slice(args.skip, args.skip + args.take));
  const database = {
    playerRoleAssignment: { findFirst: vi.fn(async () => ({ id: 'admin-role' })) },
    giftCode: { findUnique: vi.fn(async () => ({ id: 'code-1', token: 'CODE-TEST', title: 'Code test' })) },
    giftCodeClaim: { findMany, count: vi.fn(async () => total) },
  };
  const getPlayer = { execute: vi.fn(async () => ({ id: 'admin-player' })) };
  return { service: new GiftCodeService(getPlayer as never, database as never, { now: () => now }), findMany };
}

describe('GiftCodeService administration', () => {
  it.each([
    { total: 0, page: 1, expected: 0, pages: 1 },
    { total: 1, page: 1, expected: 1, pages: 1 },
    { total: 20, page: 1, expected: 20, pages: 1 },
    { total: 21, page: 2, expected: 1, pages: 2 },
    { total: 45, page: 3, expected: 5, pages: 3 },
  ])('paginates $total claimants on the server', async ({ total, page, expected, pages }) => {
    const { service, findMany } = claimantHarness(total);

    const result = await service.claimants(identity, 'code-1', { page, search: 'joueur', editionKey: '2026' });

    expect(result).toMatchObject({ page, pageSize: 20, total, totalPages: pages });
    expect(result.claimants).toHaveLength(expected);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: (page - 1) * 20,
      take: 20,
      orderBy: [{ claimedAt: 'desc' }, { giftCodeEditionId: 'asc' }, { playerId: 'asc' }],
      where: {
        edition: { giftCodeId: 'code-1', editionKey: '2026' },
        player: { displayName: { contains: 'joueur', mode: 'insensitive' } },
      },
    }));
  });

  it('keeps publish and update responses scoped to the affected code', () => {
    const source = readFileSync(new URL('../src/application/gift-code/gift-code-service.ts', import.meta.url), 'utf8');
    const publishBody = source.slice(source.indexOf('public async publish'), source.indexOf('public async update'));
    const updateBody = source.slice(source.indexOf('public async update'), source.indexOf('public async claimants'));

    for (const body of [publishBody, updateBody]) {
      expect(body).not.toContain('reconcileAllActivePlayers(');
      expect(body).not.toContain('listAdmin(');
      expect(body).toContain('adminCodeById(affectedCodeId)');
    }
  });
});

describe('GiftCodeScheduler', () => {
  it('bounds Player reconciliation concurrency below the database session pool', async () => {
    const players = Array.from({ length: 11 }, (_, index) => ({ id: `player-${index}` }));
    const database = {
      giftCode: { findMany: vi.fn(async () => []) },
      player: { findMany: vi.fn(async () => players) },
    };
    const service = new GiftCodeService({} as never, database as never, { now: () => now });
    let active = 0; let maximum = 0;
    const reconcile = vi.spyOn(service, 'reconcileNotificationsForPlayer').mockImplementation(async () => {
      active += 1; maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });

    await service.reconcileAllActivePlayers(now);

    expect(GIFT_CODE_RECONCILIATION_CONCURRENCY).toBe(4);
    expect(maximum).toBe(GIFT_CODE_RECONCILIATION_CONCURRENCY);
    expect(reconcile).toHaveBeenCalledTimes(players.length);
  });

  it('waits for one reconciliation before scheduling the next and reports failures', async () => {
    vi.useFakeTimers();
    let releaseFirst!: () => void;
    const first = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const reconcile = vi.fn().mockImplementationOnce(() => first).mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValue(undefined);
    const reportError = vi.fn();
    const scheduler = new GiftCodeScheduler({ reconcileAllActivePlayers: reconcile } as never, reportError);

    const started = scheduler.start();
    expect(reconcile).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(reconcile).toHaveBeenCalledTimes(1);

    releaseFirst();
    await started;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reconcile).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'temporary failure' }));

    scheduler.stop();
    vi.useRealTimers();
  });
});
