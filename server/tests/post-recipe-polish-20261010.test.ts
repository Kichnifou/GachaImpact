import { describe, expect, it, vi } from 'vitest';
import { harness, actor } from './helpers/chat-command-harness.js';
import { PlayerCommandResolver, type ChatCommandServices } from '../src/application/chat/player-command-resolver.js';
import type { PlayerCommandContext } from '../src/application/chat/player-command-context.js';
import { withPlayerCommandExecution } from '../src/application/player/player-command-execution.js';
import { chatCommandRegistry, findChatCommand } from '../src/application/chat/chat-command-registry.js';
import { codeRewardParts, codeRewardText } from '../src/application/chat/code-reward-result.js';
import { shopTicketResult } from '../src/application/chat/shop-ticket-result.js';
import type { ShopPurchaseResult } from '../src/application/shop/shop-store.js';

const flat = (v: string | readonly string[]) => typeof v === 'string' ? v : v.join(' | ');
function setup(source: 'TWITCH' | 'INTERNAL_CHAT' = 'TWITCH', limit = 424) {
  const h = harness(), services = h.services as unknown as ChatCommandServices;
  const resolver = new PlayerCommandResolver(h.chat as unknown as PlayerCommandContext, services, source);
  return { ...h, services, run: (text: string) => withPlayerCommandExecution({ source, now: new Date('2026-10-10T08:00:00Z'), responseBodyLimit: limit }, () => resolver.resolve(actor, text, 'polish')) };
}
const bounded = (value: string | readonly string[], limit = 424) => {
  for (const text of typeof value === 'string' ? [value] : value) expect(Array.from(text).length).toBeLessThanOrEqual(limit);
};
const themes = [
  ['new-year', 'Vœu'], ['hearts', 'Mot doux'], ['spring', 'Graine'], ['bells', 'Chocolat'],
  ['flowers', 'Mot printanier'], ['summer', 'Lettre'], ['stars', 'Vœu'], ['adventurers', 'Carnet'],
  ['harvest', 'Panier'], ['shadows', 'Sort'], ['mists', 'Murmure'], ['christmas', 'Carte'],
];
describe('Shared banner alias', () => {
  it.each(['TWITCH', 'INTERNAL_CHAT'] as const)('uses one definition and one result on %s', async source => {
    const h = setup(source), results: (string | readonly string[])[] = [];
    for (const root of ['banniere', 'bannière', 'ban', 'banner']) {
      expect(findChatCommand(root)).toBe(findChatCommand('banniere'));
      results.push(await h.run('!' + root));
      expect(await h.run('!' + root + ' extra')).toBe('Syntaxe : !banniere.');
    }
    expect(results.every(value => JSON.stringify(value) === JSON.stringify(results[0]))).toBe(true);
    const roots = chatCommandRegistry.flatMap(c => [c.name, ...c.aliases]).map(root => root.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase());
    expect(roots.filter(root => root === 'banner')).toHaveLength(1);
  });
});
describe('Event C syntax and root presentation', () => {
  it.each(themes)('warns without calling mutation or recipient lookup for %s/%s', async (key, label) => {
    const h = setup(), original = await h.services.eventService.getCurrent(actor);
    h.services.eventService.getCurrent = vi.fn(async () => ({ ...original, festival: { ...original.festival, key }, gameC: { ...original.gameC, theme: { label } } })) as never;
    for (const tail of ['@Kichnifou AHHHHHH', '', '@Kichnifou ""', '@Kichnifou "  "', '"message"', '@Kichnifou "message" extra']) {
      const result = flat(await h.run(`!event ${label} ${tail}`));
      expect(result).toMatch(/^⚠️/); expect(result).toMatch(/non envoyé|envoi non effectué/);
      expect(result).toContain(`Exemple : !event ${label} @Kichnifou "AHHHHHH"`);
    }
    expect(h.services.eventService.sendGameC).not.toHaveBeenCalled();
    expect(h.services.eventService.searchGameCRecipients).not.toHaveBeenCalled();
  });
  it.each(themes)('keeps valid send on the same owner for %s/%s', async (key, label) => {
    const h = setup(), original = await h.services.eventService.getCurrent(actor);
    h.services.eventService.getCurrent = vi.fn(async () => ({ ...original, festival: { ...original.festival, key }, gameC: { ...original.gameC, theme: { label } } })) as never;
    await h.run(`!event ${label} @Autre "Message valide"`);
    expect(h.services.eventService.sendGameC).toHaveBeenCalledExactlyOnceWith(actor, 'other', 'Message valide', 'polish', 'TWITCH');
  });
  it.each([false, true])('renders the exact joined October order and states completed=%s', async completed => {
    const h = setup(), original = await h.services.eventService.getCurrent(actor);
    h.services.eventService.getCurrent = vi.fn(async () => ({ ...original,
      festival: { key: 'shadows', emoji: '🎃', title: 'Festival des Ombres', currency: { emoji: '🎃', label: 'Bonbons Maudits', unit: 'Bonbon Maudit' } },
      edition: { endsAt: '2026-10-31T23:00:00Z' }, participation: { joined: true, points: 1 }, currency: { amount: '3' },
      gameA: { ...original.gameA, theme: { key: 'fantome', label: 'Fantôme' }, completedToday: completed, canAttempt: false },
      gameB: { ...original.gameB, theme: { label: 'Crypte' }, solvedToday: completed },
      gameC: { ...original.gameC, theme: { label: 'Sort' }, sentToday: completed }, dailyBonus: { claimedToday: completed },
    })) as never;
    const state = completed ? '✅' : '⏳', result = await h.run('!event'); bounded(result);
    expect(flat(result)).toBe(`🎃 Festival des Ombres | ${state} !event Fantôme · ${state} !event Crypte <code> · ${state} !event Sort <pseudo> "message" | ⭐ 1 point · 🎃 3 Bonbons Maudits | 🎁 Prochain palier : 10 points | Bonus quotidien ${state} | 🛒 !event boutique · 🏆 !event top | 🕒 Fin : 01/11/2026 00:00`);
    expect(h.services.eventService.join).not.toHaveBeenCalled();
  });
  it('keeps join, December calendar, unread notification and last date through fragmentation', async () => {
    const h = setup('TWITCH', 220), original = await h.services.eventService.getCurrent(actor);
    expect(flat(await h.run('!event'))).toContain('!event go');
    h.services.eventService.getCurrent = vi.fn(async () => ({ ...original, participation: { joined: true, points: 80 },
      milestones: { thresholds: [{ points: 80, reached: true }] }, calendar: { canClaimToday: true },
      festival: { ...original.festival, key: 'christmas', title: 'Festival de Noël', emoji: '🎄' },
      gameC: { ...original.gameC, unviewedCount: 2 },
    })) as never;
    const result = await h.run('!event'); bounded(result, 220); const text = flat(result);
    expect(text).toContain('Tous les paliers atteints'); expect(text).toContain('🎄 Calendrier : ⏳ !event calendrier');
    expect(text).toContain('📬 2 message(s) à lire'); expect(text).not.toMatch(/🎒|Jeux :|essais restants|hors fenêtre|à envoyer/);
    expect(text.indexOf('!event Feu')).toBeLessThan(text.indexOf('⭐ 80 points'));
    expect(text).toMatch(/🕒 Fin : 01\/03\/2026 01:00$/);
    expect(h.services.eventService.claimCalendar).not.toHaveBeenCalled();
  });
});
describe('Code direct and milestone groups', () => {
  it.each([0, 1, 3])('formats only %s actual milestones without duplicate signs', async count => {
    const h = setup(), direct = [{ resourceKey: 'primogems', amount: '30000', displayName: 'Primogemmes' }, { resourceKey: 'event_points', amount: '30', displayName: 'Points Event' }];
    const milestones = [{ resourceKey: 'event_currency', amount: '1', displayName: 'Bonbons Maudits' }, { resourceKey: 'particles_dendro', amount: '500', displayName: 'Particules Dendro' }, { resourceKey: 'particles_electro', amount: '500', displayName: 'Particules Electro' }].slice(0, count);
    const claimed = { editionId: 'edition', token: 'CODE', description: 'Cadeau', rewards: direct, rewardBreakdown: { direct, milestones } };
    h.services.giftCodeService.claim = vi.fn(async () => ({ claimed: [claimed], operation: { alreadyProcessed: false }, resources: { primogems: '79006', moras: '0', particles: {} } })) as never;
    const result = await h.run('!code CODE'); bounded(result); const text = flat(result);
    expect(text).toContain('🎁 Code : 💠 +30 000 Primogemmes (79 006) · ⭐ +30 points Event');
    expect(text.includes('🏅 Paliers :')).toBe(count > 0); expect(text).not.toContain('+ +');
    if (count) expect(text).toContain('🎃 +1 Bonbon Maudit');
    if (count === 3) expect(text).toContain('🌱 +500 particules Dendro · ⚡ +500 particules Electro');
  });
  it('repeats group identity on all long continuations with each reward once', () => {
    withPlayerCommandExecution({ source: 'TWITCH', now: new Date('2026-10-10T08:00:00Z'), responseBodyLimit: 180 }, () => {
      const direct = Array.from({ length: 15 }, (_, i) => `💠 +${100 + i} Primogemmes (9007199254740993)`);
      const milestones = Array.from({ length: 15 }, (_, i) => `🌱 +${500 + i} particules Dendro`);
      const result = codeRewardParts('✅ Joueur a utilisé CODE !', direct, milestones, []); bounded(result, 180);
      const parts = typeof result === 'string' ? [result] : result;
      for (const value of [...direct, ...milestones]) expect(parts.filter(p => p.includes(value))).toHaveLength(1);
      for (const part of parts) if (part.includes('particules Dendro')) expect(part).toMatch(/🏅 Paliers(?: \(suite\))? :/);
    });
  });
  it.each(['primogems', 'moras', 'particles_hydro', 'event_points'])('pluralizes %s independently of a live view', resourceKey => {
    expect(codeRewardText({ resourceKey, amount: '1', displayName: '' })).not.toMatch(/Primogemmes|Moras|particules|points/);
    expect(codeRewardText({ resourceKey, amount: '2', displayName: '' })).toMatch(/Primogemmes|Moras|particules|points/);
  });
  it('keeps a long Unicode description without overflowing or mixing reward groups', () => {
    withPlayerCommandExecution({ source: 'TWITCH', now: new Date('2026-10-10T08:00:00Z'), responseBodyLimit: 150 }, () => {
      const description = 'Cadeau 🌱 de compensation '.repeat(20).trim();
      const result = codeRewardParts('✅ Joueur a utilisé CODE !', ['✨ +1 Masterless Stella Fortuna'], [], [description]);
      bounded(result, 150);
      const parts = typeof result === 'string' ? [result] : result;
      expect(parts.slice(1).map(p => p.replace('🎁 Code · Note (suite) : ', '')).join(' ')).toBe(description);
    });
  });
});
describe('Ticket persisted result only', () => {
  it.each([
    [{ type: 'ticket_resource', resourceKey: 'moras', amount: 50_000n }, '🪙', '💰 remboursement +50 000 Moras'],
    [{ type: 'ticket_resource', resourceKey: 'primogems', amount: 1600n }, '💥', '💠 +1 600 Primogemmes (9 001)'],
    [{ type: 'ticket_main_element_particles', resourceKey: 'particles_hydro', amount: 1000n }, '🔥', '+1 000 particules 💧 Hydro (9 001)'],
    [{ type: 'ticket_other_element_particles', resourceKey: 'particles_hydro', amount: 800n }, '🔮', '+800 particules 💧 Hydro (9 001)'],
    [{ type: 'ticket_pity5', grantedAmount: 6, pity5After: 90 }, '✨', '+6 pity 5★ (90/90)'],
  ])('uses actual effect %o', (effect, reaction, reward) => {
    const result = { purchase: { effect }, rewardResourceBalanceAfter: 9001n, walletMorasAfter: 3_988_521n, resources: { particles_hydro: 999999n } } as unknown as ShopPurchaseResult;
    const text = flat(shopTicketResult('Kichnifou', result));
    expect(text).toBe(`✅ ${reaction} Kichnifou utilise 🎟️ Ticket et remporte... ${reward} | Reste 💰 3 988 521 Moras`);
    expect(text).not.toContain('999999');
  });
  it('does not invent a historical secondary total from current resources', () => {
    const result = { purchase: { effect: { type: 'ticket_other_element_particles', resourceKey: 'particles_hydro', amount: 800n } }, resources: { particles_hydro: 999n } } as unknown as ShopPurchaseResult;
    expect(flat(shopTicketResult('Joueur', result))).toBe('✅ 🔮 Joueur utilise 🎟️ Ticket et remporte... +800 particules 💧 Hydro');
  });
  it('keeps long names and complete reward/wallet entries through Twitch continuations', () => {
    withPlayerCommandExecution({ source: 'TWITCH', now: new Date('2026-10-10T08:00:00Z'), responseBodyLimit: 424 }, () => {
      const player = 'Nom composé '.repeat(30).trim();
      const result = { purchase: { effect: { type: 'ticket_other_element_particles', resourceKey: 'particles_hydro', amount: 800n } }, walletMorasAfter: 3_988_521n, rewardResourceBalanceAfter: 9001n } as unknown as ShopPurchaseResult;
      const parts = shopTicketResult(player, result); bounded(parts);
      expect(parts).toHaveLength(2); expect(parts[0]).toContain(player);
      expect(parts[1]).toContain('+800 particules 💧 Hydro (9 001)'); expect(parts[1]).toContain('Reste 💰 3 988 521 Moras');
    });
  });
});
