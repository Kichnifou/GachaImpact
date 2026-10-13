import { describe, expect, it } from 'vitest';
import { harness, commandId } from './helpers/chat-command-harness.js';
import { standalonePullSummary } from '../src/application/chat/gacha-command-result.js';
import { pullPresentation } from '../src/application/chat/result-presentation.js';
import type { GachaPullResult, PullResultRecord } from '../src/application/gacha/gacha-store.js';
import { isStructuredChatResult } from '../src/domain/chat/structured-result.js';
import { PlayerCommandResolver } from '../src/application/chat/player-command-resolver.js';
import type { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import type { ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';

const row = (patch: Partial<PullResultRecord> = {}): PullResultRecord => ({ index: 1, resultType: 'resource', character: null, rarity: null, resourceKey: 'moras', resourceAmount: 1000n, wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null, guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null, passiveEffects: [], ...patch });
const operation = (rows: readonly PullResultRecord[]): GachaPullResult => ({ operation: { id: 'operation', pullCount: rows.length as 1, primogemCost: 160n * BigInt(rows.length), createdAt: new Date('2026-10-13T10:00:00Z'), alreadyProcessed: false }, results: rows, playerState: {} as GachaPullResult['playerState'] });
const character = { id: 'same', name: 'Étoile 🌙', rarity: 5 as const, elementKey: 'cryo', iconPath: '/assets/characters/furina.png', externalKey: 'fixture', weaponType: null, region: null, classKey: null, splashPath: null, wishPath: null, fullbodyPath: null };

describe('Post-R1080 standalone result receipts', () => {
  it('sums principal and all bonus credits once, excluding repeated passive reward descriptions and initial cost', () => {
    const result = operation([
      row({ bonusRewards: [{ resourceKey: 'primogems', amount: 160n, causeKey: 'gacha.c6-duplicate-refund' }, { resourceKey: 'primogems', amount: 16n, causeKey: 'team.passive.anemo.primogem-recovery' }], passiveEffects: [{ type: 'primogem_recovery', elementKey: 'anemo', amount: 16n }] }),
      row({ resourceAmount: 2000n, bonusRewards: [{ resourceKey: 'primogems', amount: 160n, causeKey: 'gacha.c6-duplicate-refund' }, { resourceKey: 'moras', amount: 500n, causeKey: 'gacha.c6-maxed-compensation' }] }),
      row({ resourceKey: 'particles_electro', resourceAmount: 50n, bonusRewards: [{ resourceKey: 'particles_electro', amount: 100n, causeKey: 'team.passive.dendro.bundle' }, { resourceKey: 'particles_hydro', amount: 100n, causeKey: 'team.passive.dendro.bundle' }, { resourceKey: 'primogems', amount: 1600n, causeKey: 'player.xp.level-reward' }], passiveEffects: [{ type: 'resource_bundle', elementKey: 'dendro', rewards: [{ resourceKey: 'particles_electro', amount: 100n }, { resourceKey: 'particles_hydro', amount: 100n }] }, { type: 'xp', elementKey: 'cryo', amount: 30n, xpAfter: 50n, levelsReached: [5], overflowRewardsGranted: 0 }, { type: 'pity5', elementKey: 'electro', amount: 2, requestedAmount: 2 }] }),
    ]);
    const summary = standalonePullSummary(result);
    expect(summary.text).toBe('Joueur obtient : +💰 3 500 Moras | +💎 1 936 Primos | +⚡ 150 particules Electro | +💧 100 particules Hydro | +✨ 30 XP');
    expect(summary.facts).toEqual(['Niveaux atteints : 5', '🧩 passifs : ⚡ +2 pity 5★ · +16 Primos · 🌿 +100 particules Electro · 🌿 +100 particules Hydro · +30 XP']);
    expect(summary.text).not.toContain('480');
  });
  it('preserves repeated character draws, per-draw pity, constellations and C6 markers', () => {
    const result = operation([row({ resultType: 'character', character, rarity: 5, resourceKey: null, resourceAmount: null, constellationAfter: 5, pity5AtPull: 79 }), row({ resultType: 'character', character, rarity: 5, resourceKey: null, resourceAmount: null, constellationAfter: 6, pity5AtPull: 3, wasNewCharacter: false }), row({ resultType: 'character', character: { ...character, rarity: 4 }, rarity: 4, resourceKey: null, resourceAmount: null, pity4AtPull: 8, bonusRewards: [{ causeKey: 'gacha.c6-duplicate-refund', resourceKey: 'primogems', amount: 160n }] })]);
    expect(pullPresentation(result).characters).toMatchObject([{ id: 'same', pity: 79, constellation: 5, elementKey: 'cryo' }, { id: 'same', pity: 3, constellation: 6 }, { id: 'same', pity: 8, label: '+160 Primos' }]);
    expect(pullPresentation(operation([row({ resultType: 'character', character, rarity: 5, resourceKey: null })])).characters[0]).not.toHaveProperty('pity');
  });
  it.each([1, 5, 10])('publishes x%s as one result and reuses the frozen receipt after interrupted publication', async count => {
    const f = harness();
    f.services.performGachaPullChat.execute.mockResolvedValue(operation(Array.from({ length: count }, (_, i) => row({ index: i + 1 }))) as never);
    f.chat.publishGameResult.mockRejectedValueOnce(new Error('interrupted'));
    await expect(f.send(`!pull ${count}`)).rejects.toThrow('interrupted');
    const frozen = f.chat.freezeCommandResult.mock.calls[0]![1];
    expect(typeof frozen.content).toBe('string');
    expect(frozen.presentation?.characters).toEqual([]);
    f.chat.readCommandResult.mockResolvedValue(frozen as never);
    await f.send(`!pull ${count}`);
    expect(f.services.performGachaPullChat.execute).toHaveBeenCalledOnce();
    expect(f.chat.publishGameResult.mock.calls[1]![1]).toBe(frozen.content);
    expect(f.chat.publishGameResult.mock.calls[1]).toHaveLength(3);
  });
  it('keeps long Mission feedback inside one bounded Pull result without silent loss', async () => {
    const f = harness();
    f.chat.commandMissionCompletions.mockResolvedValue(['Mission importante '.repeat(36)]);
    await f.send('!pull');
    const frozen = f.chat.freezeCommandResult.mock.calls[0]![1];
    expect(typeof frozen.content).toBe('string');
    expect(frozen.presentation?.facts.join('')).toContain('Mission importante');
    expect(frozen.presentation?.facts.every(fact => Array.from(fact).length <= 300)).toBe(true);
  });
  it('uses all vote candidates with exact frozen counts instead of only own vote', async () => {
    const f = harness();
    f.services.getCharacters.execute.mockResolvedValue(Array.from({ length: 12 }, (_, i) => ({ id: `candidate-${i}`, name: `Candidat ${i}`, rarity: 5, elementKey: 'geo' })) as never);
    f.services.bannerVotes.getCurrent.mockResolvedValue({ candidates: Array.from({ length: 12 }, (_, i) => ({ characterId: `candidate-${i}`, voteCount: i })), canVote: true, ownVote: null } as never);
    await f.send('!vote');
    const frozen = f.chat.freezeCommandResult.mock.calls[0]![1];
    expect(frozen.presentation?.characters).toHaveLength(11);
    expect(frozen.presentation?.characters[0]).toMatchObject({ voteCount: 11, elementKey: 'geo' });
    expect(isStructuredChatResult(frozen.presentation)).toBe(true);
    expect(f.services.bannerVotes.vote).not.toHaveBeenCalled();
  });
  it('keeps !ami demande consultative and identical to demandes on standalone', async () => {
    const f = harness();
    expect(await f.send('!ami demande')).toEqual(await f.send('!ami demandes'));
    expect(f.services.socialService.friendship.mutate).not.toHaveBeenCalled();
  });
  it.each(['INTERNAL_CHAT', 'TWITCH'] as const)('opens a fatal Boss attack with congratulations on %s, preserving the rest', async source => {
    const f = harness();
    const attack = await f.services.monthlyBossService.attackWithActiveTeam();
    f.services.monthlyBossService.attackWithActiveTeam.mockResolvedValue({ ...attack, result: { ...attack.result, defeated: true }, view: { ...attack.view, reward: { primogems: 16000n, moras: 500000n } } } as never);
    const resolver = new PlayerCommandResolver(f.chat as unknown as GlobalChatService, f.services as unknown as ChatCommandServices, source);
    const output = await resolver.resolve({ subject: 'actor' }, '!combat boss go', commandId);
    const parts = typeof output === 'string' ? [output] : output;
    expect(parts[0]).toMatch(/^🎉 Félicitations ! 👑 Boss vaincu !/u);
    expect(parts.join(' ')).toContain('500 000 Moras');
    expect(parts.join(' ')).toContain('Yae Miko');
  });
});
