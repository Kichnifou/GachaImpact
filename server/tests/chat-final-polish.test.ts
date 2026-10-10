import { describe, expect, it } from 'vitest';
import { harness } from './helpers/chat-command-harness.js';
import { classifyGiveawayText } from '../src/domain/giveaway/giveaway.js';
import { wheelChatResult } from '../src/application/chat/wheel-chat-result.js';
import type { WheelReward } from '../src/domain/wheel/wheel.js';

describe('R1047 final owner polish', () => {
  it('keeps only the calendar heading and daily state markers, in the same order', async () => {
    const h = harness();
    const text = (await h.send('!quotis'))!;
    const labels = ['Récompense', 'Roue', 'Shop', 'Combat', 'Boss', 'Expédition', 'Amitié', 'Event'];
    expect(text).toMatch(/^📅 Quotidiennes : Récompense /);
    expect(text).not.toMatch(/🎁|🎡|🛒|⚔️|👹|🧭|💖|🎪|✧/u);
    expect(text).toContain('cœur(s) à envoyer');
    let previous = -1;
    for (const label of labels) { expect(text.indexOf(label)).toBeGreaterThan(previous); previous = text.indexOf(label); }
  });
  it('uses the exact legacy no-gain Wheel sentence', async () => {
    const h = harness();
    h.services.spinDailyWheelChat.execute.mockResolvedValue({ resultType: 'nothing', resourceKey: null, amount: null, alreadySpun: false } as never);
    expect(await h.send('!roue')).toBe('🎡 La roue tourne pour Moi et… rien du tout 😭 La roue a choisi le chaos aujourd’hui.');
  });
  it.each(['!ga', '!giveaway xxx', '!ga reroll'])('classifies invalid Giveaway syntax as help: %s', text => {
    expect(classifyGiveawayText(text)).toBe('HELP');
  });
  it.each([
    ['particles', 'particles_cryo', 731n, '+731 particules ❄️ Cryo ! Une belle énergie élémentaire apparaît.'],
    ['particles', 'particles_dendro', 1234n, '+1 234 particules 🌿 Dendro ! Une belle énergie élémentaire apparaît.'],
    ['moras', 'moras', 23456n, '+💰23 456 moras ! Le pactole commence à tomber.'],
    ['primogems', 'primogems', 987n, 'JACKPOT 💠 +987 primos ! La roue bénit officiellement ce moment ✨'],
  ])('renders actual Wheel %s %s amounts without an invented balance', (resultType, resourceKey, amount, ending) => {
    expect(wheelChatResult('Voyageur', { resultType, resourceKey, amount } as WheelReward))
      .toBe(`🎡 La roue tourne pour Voyageur et… ${ending}`);
  });
  it('keeps the already-spun result and tomorrow explicit', async () => {
    const h = harness();
    h.services.getTodayWheelState.execute.mockResolvedValue({ spun: true, businessDate: '2026-10-06', result: { resultType: 'moras', resourceKey: 'moras', amount: 4567n } } as never);
    h.services.spinDailyWheelChat.execute.mockResolvedValue({ resultType: 'moras', resourceKey: 'moras', amount: 4567n, alreadySpun: true } as never);
    expect(await h.send('!roue')).toBe('⚠️ Roue déjà utilisée aujourd’hui · résultat : 🪙4 567 Moras. Prochaine Roue demain.');
  });
  it.each([['TODO', '⏳'], ['IN_PROGRESS', '⏳'], ['COMPLETED', '✅'], ['BLOCKED', '➖']])('renders Combat %s and one enemy group without a mutation', async (status, marker) => {
    const h = harness(); const current = await h.services.dailyCombatService.getDaily();
    h.services.dailyCombatService.getDaily.mockResolvedValue({ ...current, status,
      encounter: { enemies: [{ name: 'Émilie', elementKey: 'dendro' }, { name: 'Yoimiya', elementKey: 'pyro' }, { name: 'Cyno', elementKey: 'electro' }, { name: 'Mika', elementKey: 'cryo' }].map(character => ({ character })) },
    } as never);
    const text = await h.send('!combat');
    expect(text).toContain(`Combat du jour : ${marker}`);
    expect(text).toContain('Ennemis : 🌿 Émilie - 🔥 Yoimiya - ⚡ Cyno - ❄️ Mika');
    expect(h.services.dailyCombatService.fight).not.toHaveBeenCalled();
  });
  it.each(['AVAILABLE', 'DEFEATED'])('uses RES punctuation for Boss %s', async attackState => {
    const h = harness(); const current = await h.services.monthlyBossService.getCurrentForChat();
    h.services.monthlyBossService.getCurrentForChat.mockResolvedValue({ ...current, attackState, status: attackState === 'DEFEATED' ? 'DEFEATED' : 'ALIVE',
      boss: { ...current.boss, name: 'Boss', resistanceElementKey: 'pyro', currentHp: 1n, maxHp: 3n },
    } as never);
    expect(await h.send('!combat boss')).toContain('🛡️ RES : 🔥 Pyro');
    expect(h.services.monthlyBossService.attackWithActiveTeam).not.toHaveBeenCalled();
  });
  it.each(['!foo', '!gabc', '!giveawayx', '!wish extra'])('does not capture a foreign root %s', text => {
    expect(classifyGiveawayText(text)).toBe('OTHER_COMMAND');
  });
});
