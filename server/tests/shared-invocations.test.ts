import { describe, expect, it, vi } from 'vitest';
import { nextSharedPresentation, sharedInactivityMs, sharedLeaseMs, sharedLive, sharedPull, sharedState } from '../src/application/gacha/shared-invocations.js';
import type { GachaPullResult, PlayerGachaState } from '../src/application/gacha/gacha-store.js';
import { sharedBanner } from '../src/application/gacha/shared-invocation-projection.js';
import { assertSharedStandaloneAuthority } from '../src/infrastructure/database/shared-invocation-guard.js';
import type { Prisma } from '../generated/prisma/client.js';
const state: PlayerGachaState = { pity5: 30, pity4: 4, guaranteedFeatured5: true, captureProgress: 2, selectedBannerCharacterId: 'target', fiftyFiftyLostStreak: 2, totalPulls: 123n, totalFiveStars: 8n, totalFourStars: 20n, fiftyFiftyWon: 1n, fiftyFiftyLost: 2n, capturesTriggered: 3n };
const pull: GachaPullResult = { operation: { id: 'committed', pullCount: 10, primogemCost: 1600n, createdAt: new Date(), alreadyProcessed: false }, playerState: state, results: Array.from({ length: 10 }, (_, index) => ({ index: index + 1, resultType: 'resource', character: null, rarity: null, resourceKey: 'moras', resourceAmount: 5000n, wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null, passiveEffects: [{ type: 'xp', elementKey: 'cryo', amount: 1n, xpAfter: 999999n, levelsReached: [], overflowRewardsGranted: 0 }], resourceTotalsAfter: { moras: 'private-wallet' } })) };
describe('shared invocation allowlists and presentation', () => {
    it('refuses a target mutation while committed results are still being presented', async () => {
        const tx = { $executeRaw: vi.fn(async () => 0), $queryRaw: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ tab_id: 'owner-tab', status: 'ACTIVE', phase: 'reveal', pending_key: null, completed_key: 'committed-key', pending_count: null }]) };
        await expect(assertSharedStandaloneAuthority(tx as unknown as Prisma.TransactionClient, 'owner', 'owner-tab', new Date())).rejects.toMatchObject({ code: 'SHARED_PRESENTATION_PENDING' });
        expect(tx.$executeRaw).toHaveBeenCalledOnce();
    });
    it('projects only the receipt banner scene fields, excluding its persistence metadata', () => {
        const banner = { id: 'receipt-banner', startsAt: new Date('2026-10-05T00:00:00Z'), endsAt: new Date('2026-10-12T00:00:00Z'), featuredFiveStars: [], featuredFourStars: [], generationVoteSnapshot: { private: 'operator-data' }, legacyProvenance: 'private-history', status: 'ENDED' };
        expect(sharedBanner(banner)).toEqual({ id: 'receipt-banner', startsAt: '2026-10-05T00:00:00.000Z', endsAt: '2026-10-12T00:00:00.000Z', featuredFiveStars: [], featuredFourStars: [] });
    });
    it('excludes lifetime state and private balances/XP from the wire projection', () => {
        expect(sharedState(state)).toEqual({ pity5: 30, pity4: 4, guaranteedFeatured5: true, captureProgress: 2, selectedBannerCharacterId: 'target' });
        const serialized = JSON.stringify(sharedPull(pull));
        for (const forbidden of ['private-wallet', 'resourceTotalsAfter', 'xpAfter', 'passiveEffects', 'primogemCost', 'alreadyProcessed', 'totalPulls'])
            expect(serialized).not.toContain(forbidden);
        expect(sharedPull(pull).results).toHaveLength(10);
    });
    it('keeps exact current x10 index and final committed results without RNG', () => {
        let p: Parameters<typeof nextSharedPresentation>[0] = { phase: 'intro', index: 0, pull: sharedPull(pull) };
        p = nextSharedPresentation(p, 'advance');
        expect(p.phase).toBe('reveal');
        for (let i = 0; i < 5; i++)
            p = nextSharedPresentation(p, 'advance');
        expect(p.index).toBe(5);
        expect(p.pull?.operation.id).toBe('committed');
        p = nextSharedPresentation(p, 'skip');
        expect(p.phase).toBe('summary');
        expect(p.pull?.results).toHaveLength(10);
        expect(nextSharedPresentation(p, 'close')).toEqual({ phase: 'idle', index: 0, pull: null });
    });
    it('distinguishes technical 60 second lease from 45 minute authentic inactivity', () => {
        const now = new Date();
        const row = { status: 'ACTIVE' as const, last_gesture_at: now, lease_until: new Date(now.getTime() + sharedLeaseMs) };
        expect(sharedLive(row, new Date(now.getTime() + 59999))).toBe(true);
        expect(sharedLive(row, new Date(now.getTime() + sharedLeaseMs))).toBe(false);
        expect(sharedLive({ ...row, lease_until: new Date(now.getTime() + sharedInactivityMs + 60000) }, new Date(now.getTime() + sharedInactivityMs))).toBe(false);
        expect(sharedLive({ ...row, status: 'PAUSED' }, now)).toBe(true);
    });
});
