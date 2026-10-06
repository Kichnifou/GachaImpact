import { describe, expect, it } from 'vitest';
import { harness, actor, commandId } from './helpers/chat-command-harness.js';
import { PlayerCommandResolver, type ChatCommandServices } from '../src/application/chat/player-command-resolver.js';
import type { PlayerCommandContext } from '../src/application/chat/player-command-context.js';
import { firstDailyMessageResult } from '../src/application/chat/daily-reward-chat-result.js';
import { BusinessError, type BusinessErrorCode } from '../src/application/errors.js';

const output = (h: ReturnType<typeof harness>) => {
  const value = h.chat.publishGameResult.mock.calls.at(-1)![1];
  return typeof value === 'string' ? value : value.join(' ');
};

describe('R1047 post-recipe: modern daily semantics and shared presentation', () => {
  it.each(['!quotis', '!quoti', '!daily'])('orders and decorates all nine domains for %s', async command => {
    const h = harness();
    h.services.monthlyBossService.getCurrentForChat.mockResolvedValue({ attackState: 'AVAILABLE', availableCharacters: [1, 2, 3, 4] } as never);
    await h.send(command);
    const text = output(h);
    const labels = ['📅 Quotidiennes :', 'Récompense', 'Roue', 'Shop', 'Combat', 'Boss', 'Expédition', 'Amitié', 'Event', 'Faveur'];
    let previous = -1;
    for (const label of labels) { expect(text).toContain(label); expect(text.indexOf(label)).toBeGreaterThan(previous); previous = text.indexOf(label); }
    expect(h.services.monthlyBossService.getCurrentForChat).toHaveBeenCalledWith(actor);
    expect(text).not.toMatch(/Défi|Festival/);
  });
  it.each([
    ['AVAILABLE', 4, '⏳'], ['AVAILABLE', 3, '➖'], ['USED', 0, '✅'], ['DEFEATED', 0, '✅'],
  ])('reads the real Boss owner: %s with %s eligible characters', async (attackState, count, mark) => {
    const h = harness();
    h.services.monthlyBossService.getCurrentForChat.mockResolvedValue({ attackState, availableCharacters: Array(count).fill({}) } as never);
    await h.send('!quotis'); expect(output(h)).toContain(`Boss ${mark}`);
  });
  it.each([
    ['RUNNING', true, false, false, '✅'], ['RUNNING', false, false, false, '⏳'],
    ['READY', true, true, false, '⏳'], ['IDLE', false, true, false, '✅'],
    ['IDLE', false, false, true, '⏳'], ['IDLE', false, false, false, '➖'],
  ])('projects Expedition %s, startedToday=%s, used=%s, canStart=%s', async (operationalStatus, startedOnCurrentBusinessDate, departureUsedToday, canStartToday, mark) => {
    const h = harness();
    h.services.expeditionService.getState.mockResolvedValue({ operationalStatus, startedOnCurrentBusinessDate, departureUsedToday, canStartToday, todayReward: null } as never);
    await h.send('!quotis'); expect(output(h)).toContain(`Expédition ${mark}`);
  });
  it.each([
    ['shadows', false, false, false, false, '⏳'],
    ['shadows', true, false, false, false, '⏳'],
    ['shadows', true, true, true, false, '⏳'],
    ['shadows', true, true, false, true, '⏳'],
    ['shadows', true, true, false, false, '✅'],
    ['hearts', true, false, false, false, '⏳'],
  ])('projects Event %s, joined=%s, A=%s, B actionable=%s, C actionable=%s', async (key, joined, aDone, bActionable, cActionable, mark) => {
    const h = harness(); const view = await h.services.eventService.getCurrent();
    h.services.eventService.getCurrent.mockResolvedValue({ ...view, festival: { ...view.festival, key }, canJoin: !joined,
      participation: { joined }, dailyBonus: { claimedToday: true, canClaim: false },
      gameA: { completedToday: aDone }, gameB: { solvedToday: !bActionable, canAttempt: bActionable },
      gameC: { canSend: cActionable, unviewedCount: 0 },
    } as never);
    await h.send('!quotis'); expect(output(h)).toContain(`Event ${mark}`);
  });
  it('also keeps calendar, daily bonus and unread social messages actionable', async () => {
    for (const remaining of ['calendar', 'bonus', 'message']) {
      const h = harness(); const event = await h.services.eventService.getCurrent();
      h.services.eventService.getCurrent.mockResolvedValue({ ...event, canJoin: false, participation: { joined: true },
        dailyBonus: { claimedToday: true, canClaim: remaining === 'bonus' }, calendar: { canClaimToday: remaining === 'calendar' },
        gameA: { completedToday: true }, gameB: { solvedToday: true, canAttempt: false }, gameC: { canSend: false, unviewedCount: remaining === 'message' ? 1 : 0 },
      } as never);
      await h.send('!quotis'); expect(output(h)).toContain('Event ⏳');
    }
  });
  it('renders the same logical command result for standalone and Twitch', async () => {
    for (const command of ['!quotis', '!combat go', '!shop', '!convertir 160', '!event']) {
      const h = harness();
      const shared = new PlayerCommandResolver(h.chat as unknown as PlayerCommandContext, h.services as unknown as ChatCommandServices);
      const twitch = new PlayerCommandResolver(h.chat as unknown as PlayerCommandContext, h.services as unknown as ChatCommandServices, 'TWITCH');
      expect(await twitch.resolve(actor, command, commandId)).toEqual(await shared.resolve(actor, command, commandId));
    }
  });
  it('keeps the actual Combat chance and rewards with the legacy victory tone', async () => {
    const h = harness();
    h.services.dailyCombatService.fight.mockResolvedValue({ result: { won: true, mode: 'AUTO', chanceHalfPoints: 141 }, view: { reward: { primogems: 881n, moras: 22333n }, loadout: { slots: [] } } } as never);
    await h.send('!combat auto');
    expect(output(h)).toContain('✅ ⚔️ Moi gagne le combat ! Chance de victoire : 70.5%');
    expect(output(h)).toContain('Gain : +💠881 Primogemmes | +🪙22 333 Moras');
    expect(output(h)).toContain('Team auto temporaire');
  });
});

describe('R1047 authored presentation, actual owner facts', () => {
  it('formats the first daily message with the reward returned by the owner', () => {
    expect(firstDailyMessageResult('Kichnifou', 'cryo', { rewards: { primogems: 160n, mainElementParticles: 160n, moras: 10000n } }))
      .toBe('✅ Premier message du jour Kichnifou ! +💠160 Primogemmes | +160 particules ❄️ Cryo | +🪙10 000 Moras');
    expect(firstDailyMessageResult('Autre', 'dendro', { rewards: { primogems: 321n, mainElementParticles: 654n, moras: 7890n } }))
      .toContain('+💠321 Primogemmes | +654 particules 🌿 Dendro | +🪙7 890 Moras');
  });
  it('keeps a loss, the used characters and temporary Auto team explicit', async () => {
    const h = harness();
    h.services.dailyCombatService.fight.mockResolvedValue({ result: { won: false, mode: 'AUTO', chanceHalfPoints: 119,
      characters: [{ name: 'Cyno', elementKey: 'electro', constellation: 2 }] }, view: { reward: { primogems: 800n, moras: 20000n } } } as never);
    await h.send('!combat auto');
    expect(output(h)).toContain('❌ ⚔️ Moi perd le combat. Chance de victoire : 59.5%');
    expect(output(h)).toContain('Team auto temporaire : ⚡ Cyno (C2)');
    expect(output(h)).toContain('Personnages KO jusqu’à demain : ⚡ Cyno (C2)');
    expect(output(h)).not.toContain('Gain');
  });
  it('uses the departure duration and the returned particle balance', async () => {
    const h = harness();
    h.services.expeditionService.start.mockResolvedValue({ view: { departedAt: new Date('2026-10-06T08:00Z'), readyAt: new Date('2026-10-06T15:30Z') } } as never);
    await h.send('!exp A'); expect(output(h)).toContain('✅ 🧭 Moi envoie 🔥 A en expédition. Retour dans 7 h 30 min !');
    h.services.expeditionService.getState.mockResolvedValue({ operationalStatus: 'READY', activeCharacter: { name: 'A' } } as never);
    h.services.expeditionService.claim.mockResolvedValue({ reward: { resourceKey: 'particles_cryo', amount: 1234n }, resources: { particles_cryo: 4567n } } as never);
    await h.send('!exp A'); expect(output(h)).toContain('+1 234 particules ❄️ Cryo (4 567)');
  });
  const themes = [
    ['new-year', 'Feu', 'Coffre', 'Vœu', 'feu d’artifice', 'coffre', 'vœu du Nouvel An'],
    ['hearts', 'Cœur', 'Cadeau', 'Mot doux', 'cœur étincelant', 'cadeau', 'mot doux'],
    ['spring', 'Pousse', 'Racine', 'Graine', 'bourgeon printanier', 'racine', 'graine'],
    ['bells', 'Œuf', 'Panier', 'Chocolat', 'œuf enchanté', 'panier', 'chocolat'],
    ['flowers', 'Fleur', 'Bouquet', 'Mot printanier', 'fleur de printemps', 'bouquet', 'mot de printemps'],
    ['summer', 'Pêche', 'Trésor', 'Lettre', 'poisson', 'fouille le sable', 'carte postale d’été'],
    ['stars', 'Étoile', 'Constellation', 'Vœu', 'étoile', 'constellation', 'vœu'],
    ['adventurers', 'Expédition', 'Ruine', 'Carnet', 'expédition', 'ruine', 'note de voyage'],
    ['harvest', 'Récolte', 'Grenier', 'Panier', 'récolte', 'grenier', 'panier'],
    ['shadows', 'Fantôme', 'Crypte', 'Sort', 'fantôme', 'crypte', 'sort'],
    ['mists', 'Feuille', 'Relique', 'Murmure', 'feuille', 'relique', 'murmure'],
    ['christmas', 'Cadeau', 'Hotte', 'Carte', 'cadeau', 'hotte', 'carte'],
  ];
  it.each(themes)('restores %s phrases, dynamic gains and private C contents', async (key, a, b, c, aPhrase, bPhrase, cPhrase) => {
    const h = harness(), base = await h.services.eventService.getCurrent();
    const view = { ...base, festival: { ...base.festival, key },
      gameA: { ...base.gameA, theme: { key: a!, label: a! } }, gameB: { ...base.gameB, theme: { label: b! } }, gameC: { ...base.gameC, theme: { label: c! } } };
    h.services.eventService.getCurrent.mockResolvedValue(view);
    h.services.eventService.attemptGameA.mockResolvedValue({ ...view, attempt: { succeeded: true, reward: { points: 7, currency: 9 } } });
    await h.send(`!event ${a}`); expect(output(h).toLowerCase()).toContain(aPhrase!.toLowerCase()); expect(output(h)).toContain('+7 point(s) | +9 💖 Monnaies');
    h.services.eventService.attemptGameB.mockResolvedValue({ ...view, gameB: { ...view.gameB, attemptsRemaining: 1 }, attempt: { kind: 'INCORRECT', reward: { points: 0, currency: 0 } } });
    await h.send(`!event ${b} 01010`); expect(output(h).toLowerCase()).toContain(bPhrase!.toLowerCase()); expect(output(h)).toContain('01010'); expect(output(h)).toContain('1/3'); expect(output(h)).not.toContain('Gain');
    await h.send(`!event ${c} Autre "Contenu confidentiel"`); expect(output(h).toLowerCase()).toContain(cPhrase!.toLowerCase()); expect(output(h)).toContain('Autre'); expect(output(h)).not.toContain('Contenu confidentiel');
    expect(h.services.eventService.sendGameC).toHaveBeenCalledWith(actor, 'other', 'Contenu confidentiel', commandId, 'INTERNAL_CHAT');
    expect(Array.from(output(h)).length).toBeLessThanOrEqual(500);
  });
  it.each([
    ['EVENT_GAME_A_OUTSIDE_WINDOW', 'Fantôme', 'Fenêtres du jour : 10:00–11:00'],
    ['EVENT_GAME_A_ALREADY_COMPLETED', 'Fantôme', 'Reviens demain'],
    ['EVENT_GAME_A_COOLDOWN', 'Fantôme', '2 seconde(s)'],
    ['EVENT_GAME_B_ALREADY_SOLVED', 'Crypte 01010', 'coordonnées 11111'],
    ['EVENT_GAME_B_NO_ATTEMPTS', 'Crypte 01010', '3 essais du jour'],
    ['EVENT_GAME_C_ALREADY_SENT', 'Sort Autre "secret"', 'sort du jour'],
    ['EVENT_GAME_C_CONTACT_UNAVAILABLE', 'Sort Autre "secret"', 'destinataire introuvable'],
  ])('renders %s from the October owner state', async (code, args, expected) => {
    const h = harness(), base = await h.services.eventService.getCurrent();
    h.services.eventService.getCurrent.mockResolvedValue({ ...base, festival: { ...base.festival, key: 'shadows' },
      gameA: { ...base.gameA, theme: { key: 'fantome', label: 'Fantôme' }, windows: [{ startAt: '2026-10-06T08:00Z', endAt: '2026-10-06T09:00Z' }], cooldownRemainingMs: 1750 },
      gameB: { ...base.gameB, theme: { label: 'Crypte' }, resolvedCode: '11111' }, gameC: { ...base.gameC, theme: { label: 'Sort' } } } as never);
    const method = code.startsWith('EVENT_GAME_A') ? h.services.eventService.attemptGameA : code.startsWith('EVENT_GAME_B') ? h.services.eventService.attemptGameB : h.services.eventService.sendGameC;
    method.mockRejectedValue(new BusinessError(code as BusinessErrorCode, 'owner refusal'));
    await h.send(`!event ${args}`); expect(output(h)).toContain(expected); expect(output(h)).not.toContain('secret');
  });
  it('gives B/C help and refuses self, invalid codes and missing recipients without mutations', async () => {
    const h = harness();
    await h.send('!event Coffre'); expect(output(h)).toContain('3/3 essais restants');
    await h.send('!event Coffre 01234'); expect(output(h)).toContain('5 chiffres 0 ou 1');
    await h.send('!event Mot doux'); expect(output(h)).toContain('<pseudo> "message"');
    await h.send('!event Mot doux Moi "secret"'); expect(output(h)).toContain('à toi-même');
    h.services.eventService.searchGameCRecipients.mockResolvedValue({ recipients: [], totalPages: 1 });
    await h.send('!event Mot doux Introuvable "secret"'); expect(output(h)).toContain('destinataire Event introuvable');
    expect(h.services.eventService.attemptGameB).not.toHaveBeenCalled(); expect(h.services.eventService.sendGameC).not.toHaveBeenCalled();
  });
  it('formats Event currency, conversion, collection and calendar from returned facts', async () => {
    const h = harness(), base = await h.services.eventService.getCurrent();
    const view = { ...base, festival: { ...base.festival, key: 'christmas', emoji: '🎄', title: 'Festival de Noël', currency: { emoji: '⭐', label: 'Étoiles de Noël', unit: 'Étoile de Noël' } },
      currency: { amount: '12345' }, participation: { joined: true, points: 29 }, shop: { rates: { primogems: 321, moras: 23456 }, collection: { label: 'Souvenir unique', cost: 79, obtainedThisEdition: false } } };
    h.services.eventService.getCurrent.mockResolvedValue(view);
    await h.send('!event boutique'); expect(output(h)).toContain('12 345 ⭐ Étoiles de Noël'); expect(output(h)).toContain('💠321 Primogemmes'); expect(output(h)).toContain('Souvenir unique : 79 ⭐');
    h.services.eventService.convertShop.mockResolvedValue({ ...view, conversion: { resourceKey: 'primogems', amount: '642' }, currency: { amount: '12343' } });
    await h.send('!event primos 2'); expect(output(h)).toContain('convertit 2 ⭐ Étoiles de Noël en +💠642 Primogemmes'); expect(output(h)).toContain('Solde : 12 343 ⭐');
    h.services.eventService.purchaseCollection.mockResolvedValue(view);
    await h.send('!event collection'); expect(output(h)).toContain('✅ 🎁 Moi obtient Souvenir unique pour 79 ⭐');
    h.services.eventService.claimCalendar.mockResolvedValue({ ...view, calendarClaim: { day: 19, reward: 1 } });
    await h.send('!event calendrier'); expect(output(h)).toContain('case 19'); expect(output(h)).toContain('+1 ⭐ Étoile de Noël');
  });
  it('keeps failed A, correct/already tested B and unread/calendar destinations visible', async () => {
    const h = harness(), base = await h.services.eventService.getCurrent();
    h.services.eventService.attemptGameA.mockResolvedValue({ ...base, attempt: { succeeded: false, reward: { points: 0, currency: 0 } } });
    await h.send('!event Feu'); expect(output(h)).toContain('magie ne prend pas'); expect(output(h)).not.toContain('Gain');
    await h.send('!event Coffre 01010'); expect(output(h)).toContain('✅ 🎀 Moi ouvre le cadeau'); expect(output(h)).toContain('Chaque participant inscrit reçoit : +1 point(s)');
    h.services.eventService.attemptGameB.mockResolvedValue({ ...base, attempt: { kind: 'ALREADY_TESTED', reward: { points: 0, currency: 0 } } });
    await h.send('!event Coffre 01010'); expect(output(h)).toContain('déjà été testé'); expect(output(h)).toContain('Aucun essai consommé');
    h.services.eventService.getCurrent.mockResolvedValue({ ...base, participation: { joined: true, points: 9 }, calendar: { canClaimToday: true }, gameC: { ...base.gameC, unviewedCount: 2 } } as never);
    await h.send('!event'); expect(output(h)).toContain('🎄 Calendrier : ⏳ !event calendrier'); expect(output(h)).toContain('📬 2 message(s) à lire');
  });
});
