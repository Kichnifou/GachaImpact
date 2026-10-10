import { describe, expect, it, vi } from 'vitest';
import { harness, actor, commandId } from './helpers/chat-command-harness.js';
import { classifyGiveawayText } from '../src/domain/giveaway/giveaway.js';

const parts = (h: ReturnType<typeof harness>) => {
  const value = h.chat.publishGameResult.mock.calls.at(-1)![1];
  return typeof value === 'string' ? [value] : value;
};
const bounded = (output: readonly string[]) => {
  expect(output.every(text => Array.from(text).length <= 500 && !/[\r\n]/u.test(text))).toBe(true);
  expect(output.join(' ')).not.toContain('et 1 autres');
};
const longName = (index: number) => `Joueur ${index} ${'Étoile🌟'.repeat(15)}`;
function remember(h: ReturnType<typeof harness>) {
  const intents = new Map<string, string>();
  h.chat.rememberCommandText.mockImplementation(async (id, field, value) => {
    const key = `${id}:${field}`;
    if (!intents.has(key)) intents.set(key, value);
    return intents.get(key)!;
  });
}

describe('Complete remaining command families', () => {
  it.each(['mission', 'switch'])('connects shop %s to the Challenge owner and reports its exact cost and reward', async action => {
    const h = harness();
    const owner = { execute: vi.fn(async () => ({ view: { challenge: { displayName: 'Conversion personnelle', progress: 3n, target: 900n, rewardPrimogems: 801n }, nextSwitchCost: 80000n }, resources: { moras: 12345678901234567890n }, spentMoras: 40000n })) };
    Object.assign(h.services, { [action === 'mission' ? 'purchaseDailyChallenge' : 'switchDailyChallenge']: owner });
    const text = await h.send(`!shop ${action}`);
    for (const term of ['Conversion personnelle', '3/900', '💠801', '💰40 000', '12 345 678 901 234 567 890', '💰80 000']) expect(text).toContain(term);
    expect(owner.execute).toHaveBeenCalledWith(actor, commandId, 'INTERNAL_CHAT');
    expect(h.chat.rememberCommandRefreshScopes).toHaveBeenCalledWith(commandId, ['dailyChallenge', 'resources', 'shop']);
  });
  it('keeps disabled visible Shop items in catalogue order and splits five complete entries', async () => {
    const h = harness();
    const items = Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, externalKey: `item${i}`, displayName: longName(i), priceAmount: 10000n, available: i !== 1 }));
    h.services.getCurrentPlayerShop.execute.mockResolvedValue({ resources: { moras: 100000n }, items } as never);
    await h.send('!shop 1'); const output = parts(h); bounded(output);
    expect(output.length).toBeGreaterThan(1);
    for (let i = 0; i < 5; i++) expect(output.filter(part => part.includes(items[i]!.displayName))).toHaveLength(1);
    expect(output.join(' ')).toContain('indisponible'); expect(output.join(' ')).not.toContain(items[5]!.displayName);
    await h.send('!shop 2'); expect(parts(h).join(' ')).toContain(items[5]!.displayName);
    expect(h.services.purchaseShopItemChat.execute).not.toHaveBeenCalled();
  });
  it('reports only actual ticket pity granted at the cap, with the transaction wallet', async () => {
    const h = harness();
    h.services.purchaseShopItemChat.execute.mockResolvedValue({ purchase: { quantity: 1n, displayName: 'Ticket', totalPrice: 150000n, effect: { type: 'ticket_pity5', grantedAmount: 1, requestedAmount: 10, pity5After: 90 } }, walletMorasAfter: 13n } as never);
    const text = await h.send('!shop ticket'); expect(text).toContain('+1 pity 5★ (90/90)'); expect(text).not.toContain('+10'); expect(text).toContain('reste 🪙13 Moras');
  });
  it.each(['max', 'MAX', 'Max'])('accepts Shop primos %s and retains its quantity if the catalogue disappears before publication', async token => {
    const h = harness(); remember(h);
    let quantity: bigint | undefined;
    h.chat.rememberCommandQuantity.mockImplementation(async (_id, value) => quantity ??= value);
    await h.send(`!shop primos ${token}`);
    expect(h.services.purchaseShopItemChat.execute).toHaveBeenLastCalledWith(actor, 'primos', 2n, commandId);
    h.services.getCurrentPlayerShop.execute.mockResolvedValue({ resources: { moras: 0n }, items: [] } as never);
    h.chat.hasConfirmedCommandMutation.mockResolvedValue(true);
    await h.send(`!shop primos ${token}`);
    expect(h.services.purchaseShopItemChat.execute).toHaveBeenLastCalledWith(actor, 'primos', 2n, commandId);
  });
  it('returns all compatible partners across owner pages and all pending trade entries', async () => {
    const h = harness();
    const players = Array.from({ length: 21 }, (_, i) => ({ id: `p${i}`, displayName: longName(i), maximum: '12345678901234567890' }));
    h.services.tradeService.partners.mockImplementation(async (_id, _q, page = 1) => ({ partners: players.slice((page - 1) * 10, page * 10), page, totalPages: 3 }) as never);
    await h.send('!ech'); let output = parts(h); bounded(output);
    for (const p of players) expect(output.filter(part => part.includes(p.displayName))).toHaveLength(1);
    h.services.tradeService.snapshot.mockResolvedValue({ received: players.map(p => ({ id: p.id, sender: p, currentAmount: '99' })), sent: [] } as never);
    await h.send('!echange liste'); output = parts(h); bounded(output);
    for (const p of players) expect(output.filter(part => part.includes(p.displayName))).toHaveLength(1);
    expect(output.join(' ')).toContain('envoyés : aucun');
  });
  it.each([['accepter', 'accept'], ['annuler', 'cancel'], ['refuser', 'refuse']])('routes ech %s all through the frozen owner batch', async (action, ownerAction) => {
    const h = harness(); await h.send(`!ech ${action} all`);
    expect(h.services.tradeService.all).toHaveBeenCalledWith('self', ownerAction, commandId, 'INTERNAL_CHAT');
    expect(h.services.tradeService.mutate).not.toHaveBeenCalled();
  });
  it('keeps a trade target after its pending request disappears before publication', async () => {
    const h = harness(); remember(h); await h.send('!ech accepter Autre');
    h.services.tradeService.snapshot.mockResolvedValue({ received: [], sent: [] });
    await h.send('!echange accepter Autre');
    expect(h.services.tradeService.mutate).toHaveBeenLastCalledWith('self', 'request', 'accept', commandId, 'INTERNAL_CHAT');
  });
  it('uses the owner eligibility projection for an exact trade partner', async () => {
    const h = harness();
    h.services.tradeService.partners.mockImplementation(async (_id, _q, page = 1) => ({
      partners: page === 1 ? [{ id: 'partial', displayName: 'Autre Ami', maximum: '9' }] : [{ id: 'exact', displayName: 'Autre', maximum: '9' }], page, totalPages: 2,
    }) as never);
    h.services.tradeService.eligibility.mockResolvedValue({ player: { id: 'exact', displayName: 'Autre' }, eligible: true, maximum: '9', reason: null });
    await h.send('!ech Autre 3');
    expect(h.services.tradeService.eligibility).toHaveBeenCalledWith('self', 'Autre');
    expect(h.services.tradeService.partners).not.toHaveBeenCalled();
    expect(h.services.tradeService.create).toHaveBeenCalledWith('self', 'exact', 3n, commandId, 'INTERNAL_CHAT');
  });
  it.each(['online', 'GÉO'])('returns all twenty allowed directory entries for %s', async filter => {
    const h = harness(); const players = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, displayName: longName(i), status: 'ONLINE' }));
    h.services.socialService.connected.mockResolvedValue({ players, total: 20 });
    h.services.socialService.directory.mockResolvedValue({ players, page: 1, totalPages: 1 });
    await h.send(`!liste ${filter}`); const output = parts(h); bounded(output);
    for (const p of players) expect(output.filter(part => part.includes(p.displayName))).toHaveLength(1);
  });
  it('splits the complete accessible Legend list and keeps private detail opaque', async () => {
    const h = harness(); const characters = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, name: longName(i), elementKey: 'hydro' }));
    h.services.socialService.legends.mockResolvedValue({ access: 'ALLOWED', data: { characters, legends: [] } } as never);
    await h.send('!LÉGENDES'); const output = parts(h); bounded(output);
    for (const c of characters) expect(output.filter(part => part.includes(c.name))).toHaveLength(1);
    h.services.socialService.legends.mockResolvedValue({ access: 'PRIVATE' } as never);
    expect(await h.send('!leg Autre Personnage')).toBe('Les Légendes de ce joueur sont privées.');
  });
  it('reports a consumed Wheel without claiming a new gain, including a concurrent UI spin', async () => {
    const h = harness();
    h.services.spinDailyWheelChat.execute.mockResolvedValue({ resultType: 'moras', resourceKey: 'moras', amount: 50000n, alreadySpun: true, alreadyProcessed: false } as never);
    const text = await h.send('!roue'); expect(text).toContain('déjà utilisée'); expect(text).toContain('🪙50 000'); expect(text).not.toContain('+');
  });
  it('replays the successful Wheel result before publication using its receipt', async () => {
    const h = harness(); remember(h); const first = await h.send('!roue');
    h.services.getTodayWheelState.execute.mockResolvedValue({ spun: true, businessDate: '2026-10-06', result: { resultType: 'primogems', resourceKey: 'primogems', amount: 160n } } as never);
    h.services.spinDailyWheelChat.execute.mockResolvedValue({ resultType: 'primogems', resourceKey: 'primogems', amount: 160n, alreadySpun: true, alreadyProcessed: true } as never);
    expect(await h.send('!roue')).toBe(first);
  });
  it('keeps retrieval by expedition character name after the claimed state becomes idle', async () => {
    const h = harness(); remember(h);
    h.services.expeditionService.getState.mockResolvedValue({ operationalStatus: 'READY', activeCharacter: { name: 'A' } } as never);
    const first = await h.send('!exp A');
    h.services.expeditionService.getState.mockResolvedValue({ operationalStatus: 'IDLE' } as never);
    h.chat.hasConfirmedCommandMutation.mockResolvedValue(true);
    expect(await h.send('!expedition A')).toBe(first);
    expect(h.services.expeditionService.claim).toHaveBeenLastCalledWith(actor, commandId, 'INTERNAL_CHAT'); expect(h.services.expeditionService.start).not.toHaveBeenCalled();
  });
  it('formats the owner expedition duration in hours and minutes', async () => {
    const h = harness(); h.services.expeditionService.getState.mockResolvedValue({ operationalStatus: 'RUNNING', activeCharacter: { name: 'A' }, remainingSeconds: 3661 } as never);
    expect(await h.send('!exp')).toContain('retour dans 1 h 2 min');
  });
  it.each(['infos', 'element', 'éléments', 'faiblesse', 'faiblesses'])('keeps combat helper %s connected to its read owner', async mode => {
    const h = harness(); await h.send(`!combat ${mode}`);
    expect(h.services.dailyCombatService.fight).not.toHaveBeenCalled();
    if (mode === 'infos') expect(h.services.dailyCombatService.previewActiveTeam).toHaveBeenCalledWith(actor);
    else expect(h.services.dailyCombatService.getElementMatrix).toHaveBeenCalledOnce();
  });
  it('reports the actual Combat reward rather than historical literal values', async () => {
    const h = harness(); h.services.dailyCombatService.fight.mockResolvedValue({ result: { won: true, chanceHalfPoints: 141 }, view: { reward: { primogems: 881n, moras: 22333n } } } as never);
    const text = await h.send('!combat go'); expect(text).toContain('70.5%'); expect(text).toContain('💠881'); expect(text).toContain('🪙22 333'); expect(text).not.toContain('+800');
  });
  it.each(['stat', 'stats'])('retains the R1038 public Boss summary for combat %s', async mode => {
    const h = harness();
    const boss = await h.services.monthlyBossService.getCurrentForChat();
    h.services.monthlyBossService.getCurrentForChat.mockResolvedValue({ ...boss, publicSummary: {
      community: { participantCount: 3, attackCount: 5n, totalDamage: 9_007_199_254_740_993n, averageDamage: 322_000n },
    } } as never);
    await h.send(`!combat ${mode}`);
    expect(parts(h).join(' ')).toContain('Boss actuel (public) : 3 participants · 5 attaques · 9 007 199 254 740 993 dégâts');
    expect(h.services.monthlyBossService.getCurrentForChat).toHaveBeenLastCalledWith(actor);
    expect(h.services.monthlyBossService.attackWithActiveTeam).not.toHaveBeenCalled();
  });
  it.each(['résumé', 'resumé', 'récap', 'recap'])('normalizes mission summary %s without exposing locked Z', async mode => {
    const h = harness(); expect(await h.send(`!mission ${mode}`)).toBe(await h.send('!mission resume'));
    expect(await h.send(`!mission ${mode}`)).not.toBe(await h.send('!mission'));
  });
  it.each(['!ga open', '!GA ouvrir', '!ga close', '!ga fermer', '!ga stats', '!ga stat'])('classifies Twitch alias %s without bypassing standalone gates', async text => {
    expect(classifyGiveawayText(text)).toBe(text.toLowerCase().includes('stat') ? 'STATS' : /close|fermer/u.test(text) ? 'CLOSE' : 'OPEN');
    const h = harness(); expect(await h.send(text)).toBe('Cette commande est réservée à Twitch.'); expect(h.services.socialService.actor).not.toHaveBeenCalled();
    expect(classifyGiveawayText('!ga reroll')).toBe('HELP');
  });
});

const themes = [
  ['new-year', 'Feu', 'Coffre', 'Vœu', 'voeu'], ['hearts', 'Cœur', 'Cadeau', 'Mot doux', 'motdoux'], ['spring', 'Pousse', 'Racine', 'Graine', 'graine'],
  ['bells', 'Œuf', 'Panier', 'Chocolat', 'chocolat'], ['flowers', 'Fleur', 'Bouquet', 'Mot printanier', 'motprintemps'], ['summer', 'Pêche', 'Trésor', 'Lettre', 'lettre'],
  ['stars', 'Étoile', 'Constellation', 'Vœu', 'voeu'], ['adventurers', 'Expédition', 'Ruine', 'Carnet', 'carnet'], ['harvest', 'Récolte', 'Grenier', 'Panier', 'panier'],
  ['shadows', 'Fantôme', 'Crypte', 'Sort', 'sort'], ['mists', 'Feuille', 'Relique', 'Murmure', 'murmure'], ['christmas', 'Cadeau', 'Hotte', 'Carte', 'carte'],
];
describe('All twelve Event themes', () => {
  it.each(themes)('connects %s games, aliases and exact composed recipients to the shared owner', async (key, a, b, c, oldC) => {
    const h = harness(); const view = await h.services.eventService.getCurrent();
    h.services.eventService.getCurrent.mockResolvedValue({ ...view, festival: { ...view.festival, key }, gameA: { ...view.gameA, theme: { key: a!.normalize('NFD').replace(/\p{M}/gu, '').replace('Œ', 'oe').toLowerCase(), label: a } }, gameB: { ...view.gameB, theme: { label: b } }, gameC: { ...view.gameC, theme: { label: c } } } as never);
    await h.send(`!event ${a}`); expect(h.services.eventService.attemptGameA).toHaveBeenCalledWith(actor, commandId, 'INTERNAL_CHAT');
    await h.send(`!event ${b} 01101`); expect(h.services.eventService.attemptGameB).toHaveBeenCalledWith(actor, '01101', commandId, 'INTERNAL_CHAT');
    const text = await h.send(`!event ${oldC} @Autre "Message privé exact"`);
    expect(h.services.eventService.sendGameC).toHaveBeenCalledWith(actor, 'other', 'Message privé exact', commandId, 'INTERNAL_CHAT');
    expect(text).toContain('+1 point(s)'); expect(text).not.toContain('Message privé exact');
  });
  it('consults all 32 candidate bit codes without spending an attempt or exposing the hidden solution', async () => {
    const h = harness(); const view = await h.services.eventService.getCurrent(); const codes = Array.from({ length: 32 }, (_, i) => i.toString(2).padStart(5, '0'));
    h.services.eventService.getCurrent.mockResolvedValue({ ...view, gameB: { theme: { label: 'Coffre' }, solvedToday: false, attemptsRemaining: 3, remainingCodes: codes, resolvedCode: null } } as never);
    await h.send('!event coffre'); const output = parts(h); bounded(output);
    for (const code of codes) expect(output.join(' ')).toContain(code); expect(h.services.eventService.attemptGameB).not.toHaveBeenCalled();
  });
  it('splits the whole Top 10 without deleting entries', async () => {
    const h = harness(); const entries = Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, displayName: longName(i), points: 20 - i }));
    h.services.eventService.getRanking.mockResolvedValue({ entries }); await h.send('!event top'); const output = parts(h); bounded(output);
    for (const entry of entries) expect(output.filter(part => part.includes(entry.displayName))).toHaveLength(1);
  });
  it('reports already joined from the actual owner receipt and never advertises a second bonus', async () => {
    const h = harness(); h.services.eventService.join.mockResolvedValue({ festival: { title: 'Festival', currency: { label: 'Monnaies', emoji: '💖' } }, currency: { amount: '4' }, creditedCurrency: 0 } as never);
    expect(await h.send('!event go')).toContain('déjà inscrit'); expect(await h.send('!event go')).not.toContain('+');
  });
});
