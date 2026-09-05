import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { ClaimDailyReward } from '../src/application/daily-reward/claim-daily-reward.js';
import type { DailyRewardClaimInput, DailyRewardStore } from '../src/application/daily-reward/daily-reward-store.js';
import { GetTodayDailyReward } from '../src/application/daily-reward/get-today-daily-reward.js';
import type { CurrentPlayerResult, CurrentPlayerStore, ProvisionCurrentPlayerInput } from '../src/application/player/current-player-store.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { DAILY_REWARDS } from '../src/domain/daily-reward/daily-reward.js';

const identity = { subject: 'daily-test' } as const;
class PlayerStore implements CurrentPlayerStore {
  public constructor(private readonly elementKey: 'hydro' | null = 'hydro') {}
  public async findByIdentity() { return { id: 'player-1', displayName: 'Daily', elementKey: this.elementKey, status: 'ACTIVE' as const }; }
  public async provision(_input: ProvisionCurrentPlayerInput): Promise<CurrentPlayerResult> { throw new Error('unused'); }
}
class MemoryDailyStore implements DailyRewardStore {
  public lastDate: string | null = null;
  public claimCalls = 0;
  public async isClaimed(_playerId: string, date: string) { return this.lastDate === date; }
  public async claim(input: DailyRewardClaimInput) {
    this.claimCalls += 1;
    const alreadyClaimed = this.lastDate === input.businessDate;
    if (!alreadyClaimed) this.lastDate = input.businessDate;
    return { claimed: true, businessDate: input.businessDate, rewards: DAILY_REWARDS, alreadyClaimed };
  }
}

describe('daily reward application and routes', () => {
  const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
  afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

  it('is read-only before claim, idempotent the same day, and available on the next Paris day', async () => {
    const clock = { value: new Date('2026-09-04T21:59:00Z'), now() { return this.value; } };
    const store = new MemoryDailyStore();
    const getPlayer = new GetCurrentPlayer(new PlayerStore());
    const today = new GetTodayDailyReward(getPlayer, store, clock);
    const claim = new ClaimDailyReward(getPlayer, store, clock);
    await expect(today.execute(identity)).resolves.toEqual({ claimed: false, businessDate: '2026-09-04', rewards: DAILY_REWARDS });
    await expect(claim.execute(identity)).resolves.toMatchObject({ alreadyClaimed: false, businessDate: '2026-09-04' });
    await expect(claim.execute(identity)).resolves.toMatchObject({ alreadyClaimed: true });
    clock.value = new Date('2026-09-04T22:00:00Z');
    await expect(today.execute(identity)).resolves.toMatchObject({ claimed: false, businessDate: '2026-09-05' });
  });

  it('protects GET today and POST claim and serializes all amounts', async () => {
    const playerStore = new PlayerStore();
    const getPlayer = new GetCurrentPlayer(playerStore);
    const store = new MemoryDailyStore();
    const clock = { now: () => new Date('2026-09-05T12:00:00Z') };
    const app = await buildApp({ host: '127.0.0.1', port: 3001, supabase: {} }, {
      authIdentityVerifier: { verify: async () => identity }, getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(playerStore),
      getTodayDailyReward: new GetTodayDailyReward(getPlayer, store, clock), claimDailyReward: new ClaimDailyReward(getPlayer, store, clock),
    });
    apps.push(app);
    expect((await app.inject({ method: 'GET', url: '/api/v1/daily-reward/today' })).statusCode).toBe(401);
    const headers = { authorization: 'Bearer token' };
    expect((await app.inject({ method: 'GET', url: '/api/v1/daily-reward/today', headers })).json()).toEqual({ claimed: false, businessDate: '2026-09-05', rewards: { primogems: '160', mainElementParticles: '160', moras: '10000' } });
    expect((await app.inject({ method: 'POST', url: '/api/v1/daily-reward/claim', headers })).json()).toMatchObject({ claimed: true, alreadyClaimed: false });
  });

  it('refuses a claim when the Player has no permanent element', async () => {
    const getPlayer = new GetCurrentPlayer(new PlayerStore(null));
    const claim = new ClaimDailyReward(getPlayer, new MemoryDailyStore(), { now: () => new Date('2026-09-05T12:00:00Z') });
    await expect(claim.execute(identity)).rejects.toMatchObject({ code: 'PLAYER_ELEMENT_REQUIRED' });
  });
});
