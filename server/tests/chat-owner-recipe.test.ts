import { describe, expect, it } from 'vitest';
import { harness, actor, commandId } from './helpers/chat-command-harness.js';
import { chatHelp, findChatCommand } from '../src/application/chat/chat-command-registry.js';
import { deriveTeamPassives } from '../src/domain/team/team-passives.js';
import { elementKeys } from '../src/domain/economy/resources.js';
import type { TradeEligibility } from '../src/application/trades/trade-service.js';

describe('Final owner recipe, step 29', () => {
  it('shows completed daily claims, including an expedition actually recovered', async () => {
    const h = harness();
    h.services.getTodayDailyReward.execute.mockResolvedValue({ claimed: true });
    h.services.getTodayWheelState.execute.mockResolvedValue({ spun: true });
    h.services.getDailyChallenge.execute.mockResolvedValue({ status: 'COMPLETED' } as never);
    h.services.dailyCombatService.getDaily.mockResolvedValue({ status: 'COMPLETED' } as never);
    h.services.expeditionService.getState.mockResolvedValue({ operationalStatus: 'IDLE', departureUsedToday: true, todayReward: { amount: '5' } } as never);
    h.services.socialService.friends.mockResolvedValue({ summary: { available: 0 } } as never);
    const event = await h.services.eventService.getCurrent();
    h.services.eventService.getCurrent.mockResolvedValue({ ...event, canJoin: false, participation: { joined: true }, dailyBonus: { claimedToday: true, canClaim: false }, gameA: { completedToday: true }, gameB: { solvedToday: true, canAttempt: false }, gameC: { canSend: false, unviewedCount: 0 } } as never);
    h.services.monthlyBossService.getCurrentForChat.mockResolvedValue({ attackState: 'USED' } as never);
    h.services.socialService.favor.mockResolvedValue({ access: 'ALLOWED', data: { active: true, claimedToday: true } } as never);
    expect(await h.send('!quotis')).toBe('📅 Quotidiennes : Récompense ✅ | Roue ✅ | Shop ✅ | Combat ✅ | Boss ✅ | Expédition ✅ | Amitié ✅ | Event ✅');
  });
  it.each(['RUNNING', 'READY', 'IDLE'])('keeps an unfinished expedition %s pending and inactive Favor unavailable', async status => {
    const h = harness();
    h.services.expeditionService.getState.mockResolvedValue({ operationalStatus: status, remainingSeconds: 600, departureUsedToday: status !== 'IDLE', canStartToday: status === 'IDLE' } as never);
    const text = await h.send('!quotis');
    for (const fragment of ['Récompense ⏳', 'Roue ⏳', 'Shop ⏳', 'Combat ⏳', 'Expédition ⏳', 'Amitié ⏳ · 1 cœur(s)', 'Event ⏳ · non inscrit']) expect(text).toContain(fragment);
    expect(h.services.expeditionService.claim).not.toHaveBeenCalled();
    expect(h.services.eventService.join).not.toHaveBeenCalled();
  });
  it('keeps active Favor and joined Festival claims pending', async () => {
    const h = harness();
    h.services.socialService.favor.mockResolvedValue({ access: 'ALLOWED', data: { active: true, claimedToday: false } } as never);
    h.services.eventService.getCurrent.mockResolvedValue({ ...await h.services.eventService.getCurrent(), canJoin: false, participation: { joined: true }, dailyBonus: { claimedToday: false, canClaim: true } } as never);
    expect(await h.send('!quotis')).toContain('Event ⏳');
  });
  it.each(['!exp', '!exp Skirk', '!exp Autre'])('reports the real ongoing expedition and remaining time for %s', async command => {
    const h = harness();
    h.services.expeditionService.getState.mockResolvedValue({ operationalStatus: 'RUNNING', activeCharacter: { name: 'Skirk' }, remainingSeconds: 44760 } as never);
    const text = await h.send(command);
    expect(text).toContain('Skirk'); expect(text?.toLowerCase()).toContain('retour dans 12 h 26 min');
    expect(h.services.expeditionService.start).not.toHaveBeenCalled();
  });
  it('gives the READY claim help for another name but retains the exact-name shortcut', async () => {
    const h = harness();
    h.services.expeditionService.getState.mockResolvedValue({ operationalStatus: 'READY', activeCharacter: { name: 'Skirk' } } as never);
    expect(await h.send('!exp Autre')).toBe('⚠️ 🧭 Moi, l’expédition de Skirk est prête à être récupérée avec !expedition retour.');
    await h.send('!exp Skirk'); expect(h.services.expeditionService.claim).toHaveBeenCalledWith(actor, commandId, 'INTERNAL_CHAT');
    expect(h.services.expeditionService.start).not.toHaveBeenCalled();
  });
  it('replays a confirmed start despite the resulting RUNNING state', async () => {
    const h = harness();
    h.services.expeditionService.getState.mockResolvedValue({ operationalStatus: 'RUNNING', activeCharacter: { name: 'A' }, remainingSeconds: 72000 } as never);
    h.chat.hasConfirmedCommandMutation.mockResolvedValue(true);
    await h.send('!exp A'); expect(h.services.expeditionService.start).toHaveBeenCalledWith(actor, 'five', commandId, 'INTERNAL_CHAT');
  });
  it('shares the singular passive alias, canonical Help and Electro result', async () => {
    const h = harness();
    expect(findChatCommand('passif')).toBe(findChatCommand('passifs'));
    expect(chatHelp('passif')).toBe(chatHelp('passifs')); expect(chatHelp('passif')).toContain('!passifs [element]');
    expect(await h.send('!passif electro')).toBe(await h.send('!passifs electro'));
    expect(await h.send('!passif')).toBe(await h.send('!passifs'));
  });
  it.each(['', ' 1'])('uses compact Team composition and modern passive parameters for !team%s', async args => {
    const h = harness();
    h.services.getCurrentPlayerTeams.execute.mockResolvedValue({ teams: [{ position: 1, active: true,
      slots: [{ character: { name: 'Cyno', elementKey: 'electro', constellation: 2 } }, { character: { name: 'Flins', elementKey: 'electro', constellation: 0 } }, { character: { name: 'Ayato', elementKey: 'hydro', constellation: 0 } }, { character: { name: 'Neuvillette', elementKey: 'hydro', constellation: 0 } }],
      passives: deriveTeamPassives(['electro', 'electro', 'hydro', 'hydro']),
    }] } as never);
    expect(await h.send('!team' + args)).toBe('✅ Team Moi : ⚡ Cyno (C2) - ⚡ Flins (C0) - 💧 Ayato (C0) - 💧 Neuvillette (C0) | 🧩 Passifs : 💧 +0.6% chance 5★, ⚡ 1/20 : +2 pity 5★');
    expect(h.services.activatePlayerTeam.execute).not.toHaveBeenCalled();
  });
  it.each(elementKeys)('derives the compact %s passive from the current owner', async element => {
    const h = harness();
    h.services.getCurrentPlayerTeams.execute.mockResolvedValue({ teams: [{ active: true, slots: [], passives: deriveTeamPassives([element, element]) }] } as never);
    const text = await h.send('!team');
    expect(text).toContain('🧩 Passifs'); expect(text).not.toContain('chance sur'); expect(text).not.toContain('par vœu');
    const expected = { pyro: '×1,5 particules', hydro: '+0.6%', cryo: '1/10 : +1 XP', electro: '1/20 : +2 pity', anemo: '1/8 : +80 primos', geo: '×1,5 moras', dendro: '1/15 : +40 primos, +1000 moras, +5 particules/élément' };
    expect(text).toContain(expected[element]);
  });
  it('reads Shop prices and bundle size from the owners without purchasing', async () => {
    const h = harness();
    h.services.getDailyChallenge.execute.mockResolvedValue({ purchaseCost: 12345n } as never);
    h.services.getCurrentPlayerShop.execute.mockResolvedValue({ items: [{ externalKey: 'primogem-bundle', rewardPerUnit: { amount: 321n }, priceAmount: 56789n, available: true }, { externalKey: 'reward-ticket', priceAmount: 234567n, available: true }] } as never);
    expect(await h.send('!shop')).toBe('🛒 Shop : 📜 Mission [💰 12 345] | 💠 321 Primos [💰 56 789] | 🎟️ Ticket [💰 234 567] | Achat : !shop article');
    expect(h.services.purchaseShopItemChat.execute).not.toHaveBeenCalled();
  });
  it.each(['element', 'elements', 'élément', 'éléments'])('returns a nonmutating Liste helper for %s and explicit Help', async word => {
    const h = harness();
    expect(await h.send('!liste ' + word)).toBe('Éléments : !liste pyro | !liste hydro | !liste cryo | !liste electro | !liste anemo | !liste geo | !liste dendro');
    expect(h.services.socialService.directory).not.toHaveBeenCalled();
    expect(chatHelp('liste')).toContain('!liste <pyro|hydro|cryo|electro|anemo|geo|dendro|online> [page]');
  });
  it.each([false, true])('keeps Contest opaque before the public reveal, active=%s', async active => {
    const h = harness(); if (active) h.services.contestService.getCurrent.mockResolvedValue({ active: { status: 'LOBBY', participants: [] }, theme: { label: 'Force' } } as never);
    for (const command of ['!concours', '!concours xxx', '!concours rejoindre A']) {
      expect(await h.send(command)).toBe('🏆 Concours : prochainement disponible.');
    }
    expect(h.services.contestService.getCurrent).not.toHaveBeenCalled();
  });
  it.each([false, true])('keeps Event calendar and received messages free of interface hints, canClaimToday=%s', async canClaimToday => {
    const h = harness(), event = await h.services.eventService.getCurrent();
    h.services.eventService.getCurrent.mockResolvedValue({ ...event, calendar: { canClaimToday },
      gameC: { ...event.gameC, unviewedCount: 2 } } as never);
    const text = await h.send('!event');
    expect(text).toContain(`🎄 Calendrier : ${canClaimToday ? '⏳ !event calendrier' : 'indisponible actuellement'}`);
    expect(text).toContain('📬 2 message(s) à lire');
    expect(text).not.toMatch(/interface|standalone|https?:\/\/|#activities|Activités >/iu);
    for (const action of ['claimCalendar', 'sendGameC', 'join'] as const) expect(h.services.eventService[action]).not.toHaveBeenCalled();
  });
  it.each([false, true])('renders the exact Event root with Paris time and owner attempt limit, completed=%s', async completed => {
    const h = harness(); const original = await h.services.eventService.getCurrent();
    h.services.eventService.getCurrent.mockResolvedValue({ ...original, festival: { key: 'shadows', emoji: '🎃', title: 'Festival des Ombres', currency: { emoji: '🎃', label: 'Bonbons Maudits' } }, edition: { endsAt: '2026-10-31T23:00:00Z' }, participation: { joined: true, points: 7 }, currency: { amount: '11' }, gameA: { ...original.gameA, theme: { key: 'fantome', label: 'Fantôme' }, completedToday: completed, canAttempt: true }, gameB: { ...original.gameB, theme: { label: 'Crypte' }, solvedToday: completed, attemptsRemaining: completed ? 0 : 2 }, gameC: { ...original.gameC, theme: { label: 'Sort' }, sentToday: completed }, dailyBonus: { claimedToday: completed } } as never);
    const state = completed ? '✅' : '⏳';
    expect(await h.send('!event')).toBe(`🎃 Festival des Ombres | ${state} !event Fantôme · ${state} !event Crypte <code> · ${state} !event Sort <pseudo> "message" | ⭐ 7 points · 🎃 11 Bonbons Maudits | 🎁 Prochain palier : 10 points | Bonus quotidien ${state} | 🛒 !event boutique · 🏆 !event top | 🕒 Fin : 01/11/2026 00:00`);
    for (const action of ['join', 'attemptGameA', 'attemptGameB', 'sendGameC'] as const) expect(h.services.eventService[action]).not.toHaveBeenCalled();
  });
  it.each([
    ['PARTNER_EMPTY', 'particles_cryo', '⚠️ Échange impossible avec Mynonyme : Mynonyme n’a aucune particule ❄️ Cryo disponible à échanger.'],
    ['ACTOR_EMPTY', 'particles_pyro', '⚠️ Échange impossible avec Mynonyme : tu n’as aucune particule 🔥 Pyro disponible à échanger.'],
    ['SAME_ELEMENT', undefined, '⚠️ Échange impossible avec Mynonyme : vous avez le même élément.'],
    ['PENDING', undefined, '⚠️ Un échange est déjà en attente avec Mynonyme.'],
    ['NOT_FOUND', undefined, 'Joueur introuvable.'],
    ['UNAVAILABLE', undefined, '⚠️ Ce joueur n’est pas disponible pour un échange.'],
  ])('renders safe eligibility reason %s', async (reason, resourceKey, expected) => {
    const h = harness(); h.services.tradeService.eligibility.mockResolvedValue({ reason, player: ['NOT_FOUND', 'UNAVAILABLE'].includes(reason!) ? null : { id: 'partner', displayName: 'Mynonyme' }, maximum: '0', eligible: false, resourceKey } as never);
    expect(await h.send('!ech @Mynonyme')).toBe(expected);
    expect(h.services.tradeService.create).not.toHaveBeenCalled();
  });
  it.each(['', ' max', ' 3'])('keeps eligible creation authoritative for a bare name%s', async suffix => {
    const h = harness(); await h.send('!ech Autre' + suffix);
    expect(h.services.tradeService.create).toHaveBeenCalledWith('self', 'other', suffix === ' 3' ? 3n : undefined, commandId, 'INTERNAL_CHAT');
  });
  it('replays creation despite eligibility now reporting a pending request', async () => {
    const h = harness(); h.chat.hasConfirmedCommandMutation.mockResolvedValue(true);
    h.services.tradeService.eligibility.mockResolvedValue({ player: { id: 'other', displayName: 'Autre' }, eligible: false, maximum: '0', reason: 'PENDING' } satisfies TradeEligibility as never);
    await h.send('!ech Autre'); expect(h.services.tradeService.create).toHaveBeenCalledOnce();
  });
});
