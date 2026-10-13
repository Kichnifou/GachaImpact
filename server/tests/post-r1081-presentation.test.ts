import { describe, expect, it } from 'vitest';
import { harness } from './helpers/chat-command-harness.js';
import { standalonePullSummary } from '../src/application/chat/gacha-command-result.js';
import { pullPresentation } from '../src/application/chat/result-presentation.js';
import type { GachaPullResult, PullResultRecord } from '../src/application/gacha/gacha-store.js';
const row = (patch: Partial<PullResultRecord> = {}): PullResultRecord => ({ index: 1, resultType: 'resource', character: null, rarity: null, resourceKey: 'moras', resourceAmount: 1250n, wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null, passiveEffects: [], ...patch });
const operation = (rows: PullResultRecord[]): GachaPullResult => ({ operation: { id: 'receipt', pullCount: rows.length as 1, primogemCost: 160n * BigInt(rows.length), createdAt: new Date(), alreadyProcessed: false }, results: rows, playerState: {} as never });
describe('R1082 standalone presentation', () => {
  it.each(['pyro', 'geo'] as const)('never reapplies the recorded %s multiplier to principal credits', element => {
    const result = operation([row({ resourceKey: element === 'geo' ? 'moras' : 'particles_hydro', resourceAmount: 1500n, passiveEffects: [{ type: 'secondary_reward_multiplier', elementKey: element, numerator: 3, denominator: 2, amountBefore: 1000n, amountAfter: 1500n }] })]);
    const summary = standalonePullSummary(result, 'Pseudo');
    expect(summary.text).toContain('1 500'); expect(summary.text).not.toContain('2 250'); expect(summary.facts).toEqual([`🧩 passif : ${element === 'geo' ? 'Moras' : 'particules'} ×1,5`]);
  });
  it('shows separate 4★ and 5★ refunds, never the operation total on either card', () => {
    const character = { id: 'same', name: 'Personnage', elementKey: 'hydro' } as never;
    const result = operation([row({ character, rarity: 4, bonusRewards: [{ resourceKey: 'primogems', amount: 80n, causeKey: 'gacha.c6-duplicate-refund' }] }), row({ character, rarity: 5, bonusRewards: [{ resourceKey: 'primogems', amount: 160n, causeKey: 'gacha.c6-duplicate-refund' }] })]);
    expect(pullPresentation(result).characters.map(c => c.label)).toEqual(['+80 Primos', '+160 Primos']);
    expect(standalonePullSummary(result, 'Pseudo').text).toContain('+💎 240 Primos');
  });
  it('shows only voted candidates but still accepts an eligible zero-vote target', async () => {
    const f = harness();
    f.services.getCharacters.execute.mockResolvedValue([{ id: 'five', name: 'Premier', rarity: 5, elementKey: 'hydro' }, { id: 'candidate', name: 'Candidat', rarity: 5, elementKey: 'geo' }] as never);
    f.services.bannerVotes.getCurrent.mockResolvedValue({ candidates: [{ characterId: 'five', voteCount: 2 }, { characterId: 'candidate', voteCount: 0 }], canVote: true, ownVote: null } as never);
    await f.send('!vote');
    expect(f.chat.freezeCommandResult.mock.calls[0]![1].presentation?.characters).toMatchObject([{ id: 'five', voteCount: 2 }]);
    expect(f.chat.freezeCommandResult.mock.calls[0]![1].presentation?.characters).toHaveLength(1);
    await f.send('!vote Candidat');
    expect(f.services.bannerVotes.vote).toHaveBeenCalled();
  });
  it('does not publish a grid when there are no votes', async () => {
    const f = harness(); f.services.getCharacters.execute.mockResolvedValue([{ id: 'candidate', name: 'Candidat', rarity: 5, elementKey: 'geo' }] as never); await f.send('!vote');
    const frozen = f.chat.freezeCommandResult.mock.calls[0]![1];
    expect(frozen.presentation).toBeNull(); expect(frozen.content).toContain('Aucun vote');
  });
  it('shows the actor header, true team position and compact passives without repeating members', async () => {
    const f = harness(), state = await f.services.getCurrentPlayerTeams.execute();
    f.services.getCurrentPlayerTeams.execute.mockResolvedValue({ ...state, teams: [{ ...state.teams[0], position: 7, name: 'Luck', passives: [{ elementKey: 'hydro', stacks: 2, displayName: 'Hydro', description: 'Description longue' }] }] } as never);
    await f.send('!team');
    const frozen = f.chat.freezeCommandResult.mock.calls[0]![1];
    expect(frozen.content).toEqual(expect.stringMatching(/^✅ Team .* :$/u)); expect(frozen.content).not.toContain('(C0)');
    expect(frozen.presentation?.title).toBe('Luck · Team 7');
    expect(frozen.presentation?.facts).toEqual(['🧩 Passifs : 💧 +0.6% chance 5★']);
  });
  it('keeps C6 refund per card and principal/passive/level credits exact, with frozen actor text', () => {
    const character = { id: 'same', name: 'Étoile', rarity: 5, elementKey: 'hydro' } as never;
    const result = operation([row({ character, rarity: 5, constellationAfter: 6, bonusRewards: [{ causeKey: 'gacha.c6-duplicate-refund', resourceKey: 'primogems', amount: 80n }, { causeKey: 'team.passive.dendro.bundle', resourceKey: 'primogems', amount: 40n }], passiveEffects: [{ type: 'resource_bundle', elementKey: 'dendro', rewards: [{ resourceKey: 'primogems', amount: 40n }] }, { type: 'secondary_reward_multiplier', elementKey: 'geo', numerator: 5, denominator: 4, amountBefore: 1000n, amountAfter: 1250n }] }), row({ character, rarity: 5, constellationAfter: 6, resourceKey: null, resourceAmount: null })]);
    const summary = standalonePullSummary(result, 'Pseudo figé');
    expect(summary.text).toBe('Pseudo figé obtient : +💰 1 250 Moras | +💎 120 Primos');
    expect(pullPresentation(result).characters[0]?.label).toBe('+80 Primos');
    expect(pullPresentation(result).characters[1]?.label).toBeUndefined();
    expect(summary.facts.join(' ')).toContain('🌿 +40 Primos'); expect(summary.facts.join(' ')).toContain('Moras ×1,25');
  });
  it.each([false, true])('announces recorded thresholds only when no five star exists in the operation; five=%s', five => {
    const result = operation([row({ pity5AtPull: 74 }), row({ pity5AtPull: 80 }), ...(five ? [row({ rarity: 5, pity5AtPull: 3, backToBack: true, captureTriggered: true })] : [])]);
    const summary = standalonePullSummary(result, 'Pseudo');
    if (five) { expect(summary.text).toMatch(/^🔥 WOW EARLY !! 💥 INCROYABLE BACK-TO-BACK !!! ✨ CAPTURE DE BRILLANCE ! Pseudo obtient :/u); expect(summary.text).not.toMatch(/soft|hard/iu); }
    else { expect(summary.text).toContain('soft pity'); expect(summary.text).toContain('hard'); }
  });
});
