import { describe, expect, it } from 'vitest';
import { legacyBannerEvidence, planLegacyBannerReconciliation, planLegacyVotes } from '../src/application/migration/legacy-banner-reconciliation.js';
import type { Snapshot } from '../src/application/migration/streamerbot-snapshot.js';

const catalog = Array.from({ length: 12 }, (_, i) => ({ id: `character-${i}`, externalKey: `legacy:${i}`, rarity: i < 6 ? 5 : 4, isActive: true }));
const snapshot: Snapshot = { hash: 'a'.repeat(64), files: 17, sources: {
  'genshin_characters.json': { lastBannerUpdate: '2026-10-05', characters: catalog.filter(c => !['character-4', 'character-5'].includes(c.id)).map(c => ({ id: Number(c.externalKey.slice(7)), bannerFeatured: true })) },
  'banner_votes.json': { weekId: '2026-10-05', voters: { approved_0: 4, approved_42: 5, discarded: 4, quarantine: 5 }, votes: { 4: { votes: 2 }, 5: { votes: 2 } } },
} };
describe('bounded legacy banner and vote plans', () => {
  it('maps the fixed 43 supplied bindings, including NATIVE, without creating voters for discarded or quarantined names', () => {
    const evidence = legacyBannerEvidence(snapshot, catalog), bindings = Array.from({ length: 43 }, (_, i) => ({ legacyUsername: `approved_${i}`, playerId: `player-${i}` }));
    const plan = planLegacyVotes(evidence, bindings, []);
    expect(plan.map(v => v.action)).toEqual(['IMPORT', 'IMPORT', 'EXCLUDED', 'EXCLUDED']);
    expect(plan.filter(v => v.playerId).map(v => v.playerId)).toEqual(['player-0', 'player-42']);
    expect(planLegacyVotes(evidence, bindings, [{ playerId: 'player-0', characterId: 'character-4', sourceChannel: 'MIGRATION' }])[0]!.action).toBe('RETAIN');
    expect(planLegacyVotes(evidence, bindings, [{ playerId: 'player-0', characterId: 'character-5', sourceChannel: 'UI' }])[0]!.action).toBe('CONFLICT');
    expect(() => planLegacyVotes(evidence, [...bindings, bindings[0]!], [])).toThrow('BINDING_AMBIGUOUS');
  });
  it('rejects mismatching aggregates, normalized duplicate voters, missing catalog entries and incomplete composition', () => {
    const votes = snapshot.sources['banner_votes.json'] as Record<string, unknown>;
    const replace = (value: unknown): Snapshot => ({ ...snapshot, sources: { ...snapshot.sources, 'banner_votes.json': value } });
    expect(() => legacyBannerEvidence(replace({ ...votes, votes: { 0: { votes: 3 }, 1: { votes: 2 } } }), catalog)).toThrow('AGGREGATES_CONFLICT');
    expect(() => legacyBannerEvidence(replace({ ...votes, voters: { Ceo: 0, 'Céo': 0 } }), catalog)).toThrow('IDENTITY_AMBIGUOUS');
    expect(() => legacyBannerEvidence(snapshot, catalog.slice(1))).toThrow('CHARACTER_INVALID');
    expect(() => legacyBannerEvidence(snapshot, catalog.map(c => ({ ...c, isActive: c.id !== 'character-0' })))).toThrow('CHARACTER_INVALID');
    expect(() => legacyBannerEvidence(snapshot, catalog.map(c => ({ ...c, rarity: 5 })))).toThrow('COMPOSITION_INVALID');
    const featuredVote = legacyBannerEvidence(replace({ ...votes, voters: { approved_0: 0 }, votes: { 0: { votes: 1 } } }), catalog);
    expect(planLegacyVotes(featuredVote, [{ legacyUsername: 'approved_0', playerId: 'player-0' }], [])[0]!.action).toBe('INELIGIBLE');
  });
  it('keeps expired weeks historical, uses Paris Monday boundaries and refuses any overlapping native composition', () => {
    const evidence = legacyBannerEvidence(snapshot, catalog), now = new Date('2026-10-08T12:00:00Z');
    expect(evidence.startsAt.toISOString()).toBe('2026-10-04T22:00:00.000Z');
    expect(evidence.endsAt.toISOString()).toBe('2026-10-11T22:00:00.000Z');
    expect(planLegacyBannerReconciliation(evidence, [], now).status).toBe('CREATE');
    expect(planLegacyBannerReconciliation(evidence, [], evidence.endsAt).status).toBe('HISTORICAL');
    const rotation = { id: 'native', startsAt: evidence.startsAt, endsAt: evidence.endsAt, status: 'ACTIVE', featuredCharacters: evidence.featured.map(c => ({ characterId: c.id, rarity: c.rarity })) };
    expect(planLegacyBannerReconciliation(evidence, [rotation], now).status).toBe('REUSE');
    expect(planLegacyBannerReconciliation(evidence, [{ ...rotation, featuredCharacters: [] }], now).reason).toBe('BANNER_AUTHORITY_CONFLICT');
    expect(planLegacyBannerReconciliation(evidence, [rotation, { ...rotation, id: 'other' }], now).reason).toBe('BANNER_AUTHORITY_CONFLICT');
    expect(planLegacyBannerReconciliation(evidence, [{ ...rotation, status: 'FINISHED' }], now).reason).toBe('BANNER_ACTIVE_STATE_CONFLICT');
  });
});
