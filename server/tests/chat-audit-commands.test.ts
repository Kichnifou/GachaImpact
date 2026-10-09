import { describe, expect, it, vi } from 'vitest';
import { boxCommand } from '../src/application/chat/box-command.js';
import { bankCommand, codeCommand, coffreCommand } from '../src/application/chat/resource-commands.js';
import { chatElementEmojis } from '../src/application/chat/chat-list-result.js';
import { chatHelp, findChatCommand } from '../src/application/chat/chat-command-registry.js';
import { BusinessError } from '../src/application/errors.js';
import type { BoxCharacter, BoxSortPreference } from '../src/application/box/box-store.js';
import type { ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';
import type { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import type { PlayerInventory } from '../src/application/inventory/inventory-store.js';
const actor = { subject: 'test' };
const character = (index: number, rarity: 4 | 5 = 5, elementKey: BoxCharacter['elementKey'] = 'pyro'): BoxCharacter => ({
  id: String(index), externalKey: String(index), name: `Perso ${String(index).padStart(2, '0')}`, rarity, elementKey, constellation: index % 7,
  firstObtainedAt: new Date(2026, 8, index + 1), favorite: false, copies: 123,
  weaponType: null, region: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, c6CompetitionStats: null,
});
function harness() {
  const box = { characters: [character(1), character(2, 4)], preference: { sortKey: 'alphabetical', direction: 'asc' } as BoxSortPreference };
  const inventory: { resources: PlayerInventory['resources']; items: PlayerInventory['items'] } = { resources: [], items: [] };
  const code = { editionId: 'edition', token: 'CADEAU', description: 'Bonne fête !', claimed: false, rewards: [
    { resourceKey: 'particles_geo', amount: '20' }, { resourceKey: 'moras', amount: '200000' }, { resourceKey: 'particles_pyro', amount: '200' }, { resourceKey: 'primogems', amount: '1600' }, { resourceKey: 'particles_hydro', amount: '0' },
  ] };
  const codes = { available: [code], claimed: [] as typeof code[] };
  const services = {
    socialService: { actor: vi.fn(async () => ({ id: 'self', displayName: 'Axel' })) },
    getCurrentPlayerBox: { execute: vi.fn(async () => box) },
    setBoxCharacterFavorite: { execute: vi.fn(async (_identity: unknown, id: string, favorite: boolean) => { const c = box.characters.find(c => c.id === id)!; box.characters = box.characters.map(c => c.id === id ? { ...c, favorite } : c); return { ...c, favorite }; }) },
    setBoxSortPreference: { execute: vi.fn(async (_identity: unknown, preference: BoxSortPreference) => { box.preference = preference; return preference; }) },
    getCurrentPlayerInventory: { execute: vi.fn(async () => inventory) },
    getCurrentPlayerBank: { execute: vi.fn(async () => ({ bankMoras: 100n, walletMoras: 50n, estimatedInterest: 3n })) },
    depositPlayerBankChat: { execute: vi.fn(async () => ({ bankMoras: 150n, walletMoras: 0n, resolvedAmount: 50n })) },
    withdrawPlayerBankChat: { execute: vi.fn(async () => ({ bankMoras: 0n, walletMoras: 150n, resolvedAmount: 100n })) },
    giftCodeService: { listForPlayer: vi.fn(async () => codes), claim: vi.fn(async () => ({ claimed: [{ ...code, claimed: true }], resources: { primogems: '12500', moras: '850000', particles: { pyro: '1250', geo: '50' } }, operation: { alreadyProcessed: false } })) },
  };
  const intents = new Map<string, string>();
  const chat = { hasConfirmedCommandMutation: vi.fn(async () => false), rememberCommandRefreshScopes: vi.fn(), rememberCommandText: vi.fn(async (id: string, field: string, value: string) => { const key = id + field; if (!intents.has(key)) intents.set(key, value); return intents.get(key)!; }) };
  const typed = services as unknown as ChatCommandServices, typedChat = chat as unknown as GlobalChatService;
  const args = (s: string) => s ? s.split(' ') : [];
  return { box, inventory, code, codes, services, chat,
    boxRun: (s = '', id = 'box') => boxCommand(actor, args(s), id, typed, typedChat, 'Syntaxe : !box [5|4|6|élément|pN|favoris [personnage]|a|d|c|e].'),
    bankRun: (s = '') => bankCommand(actor, args(s), 'bank', typed, typedChat, 'Syntaxe : !banque [deposer|retirer <montant|max>].'),
    codeRun: (s = '') => codeCommand(actor, args(s), 'code', typed, typedChat, 'Syntaxe : !code [CODE].'),
    coffreRun: () => coffreCommand(actor, typed),
  };
}
const combined = (result: string | readonly string[]) => typeof result === 'string' ? result : result.join(' ');

describe('Bank Chat contract', () => {
  it('shows authoritative balances and interest with the real player', async () => {
    expect(await harness().bankRun()).toBe('🏦 Banque Axel : 100 Moras | 💰 Portefeuille : 50 | Intérêt estimé (3%) : +3 | 📥 !banque deposer X | 📤 !banque retirer X');
  });
  it.each(['deposer', 'depose', 'déposer', 'dépose', 'DÉPOSE'])('accepts %s, resolving MAX only in the owner', async action => {
    const h = harness();
    expect(await h.bankRun(`${action} MAX`)).toBe('✅ Axel dépose 50 Moras à la banque. Banque : 150 | Sur toi : 0');
    expect(h.services.depositPlayerBankChat.execute).toHaveBeenCalledWith(actor, 'max', 'bank');
    expect(h.services.getCurrentPlayerBank.execute).not.toHaveBeenCalled();
  });
  it.each(['retirer', 'retire', 'retiré', 'retirée', 'retiree'])('accepts %s', async action => {
    const h = harness(); expect(await h.bankRun(`${action} max`)).toBe('✅ Axel retire 100 Moras de la banque. Banque : 0 | Sur toi : 150');
    expect(h.services.withdrawPlayerBankChat.execute).toHaveBeenCalledWith(actor, 'max', 'bank');
  });
  it.each(['deposer 0', 'deposer -1', 'retirer 2.5', 'deposer 500k', 'retirer 2m', 'nope 1', 'retirer', 'deposer 10 plus'])('rejects %s without mutation', async args => {
    const h = harness(); expect(await h.bankRun(args)).toBe('Syntaxe : !banque [deposer|retirer <montant|max>].');
    expect(h.services.depositPlayerBankChat.execute).not.toHaveBeenCalled(); expect(h.services.withdrawPlayerBankChat.execute).not.toHaveBeenCalled();
  });
  it.each([
    ['deposer', 'BANK_WALLET_INSUFFICIENT', '10', '⚠️ Axel, tu n’as pas assez de Moras. Portefeuille : 50.'],
    ['retirer', 'BANK_BALANCE_INSUFFICIENT', '10', '⚠️ Axel, tu n’as pas assez de Moras en banque. Banque : 100.'],
    ['deposer', 'BANK_AMOUNT_INVALID', 'max', '⚠️ Axel, tu n’as aucun Mora à déposer.'],
    ['retirer', 'BANK_AMOUNT_INVALID', 'max', '⚠️ Axel, tu n’as aucun Mora à retirer.'],
  ] as const)('localizes %s / %s', async (action, code, amount, text) => {
    const h = harness(); (action === 'deposer' ? h.services.depositPlayerBankChat : h.services.withdrawPlayerBankChat).execute.mockRejectedValue(new BusinessError(code, 'internal'));
    expect(await h.bankRun(`${action} ${amount}`)).toBe(text);
  });
});

describe('Box Chat contract', () => {
  it('lists both rarity groups and constellations without copies', async () => {
    expect(await harness().boxRun()).toEqual(['✅ Axel, ta Box [alphabétique ↑] : ⭐⭐⭐⭐⭐ 🔥 Perso 01 (C1) | ⭐⭐⭐⭐ 🔥 Perso 02 (C2)']);
  });
  it.each(['5', '4', '6'])('filters %s and reports an empty result', async option => {
    const h = harness(); h.box.characters = [character(6), character(4, 4), character(2)];
    const value = combined(await h.boxRun(option));
    expect(value).toContain(option === '6' ? 'Box C6' : 'Box ' + '⭐'.repeat(Number(option)));
    if (option === '6') { expect(value).toContain('Perso 06'); expect(value).not.toContain('Perso 02'); }
    h.box.characters = []; expect(await h.boxRun(option)).toBe(`⚠️ Axel, tu n’as aucun personnage ${option === '6' ? 'C6' : option + '★'}.`);
  });
  it.each(Object.keys(chatElementEmojis) as BoxCharacter['elementKey'][])('filters %s with normalized case/accents', async element => {
    const h = harness(); h.box.characters = [character(1, 5, element), character(2, 4, element)];
    expect(combined(await h.boxRun(element.toUpperCase()))).toContain(`${chatElementEmojis[element]} Perso 01`);
    h.box.characters = []; expect(await h.boxRun(element)).toContain('aucun personnage');
  });
  it.each(['alphabetical', 'obtainedAt', 'constellation', 'element'] as const)('applies persisted %s in each rarity group', async sortKey => {
    const h = harness();
    h.box.characters = [
      { ...character(1), name: 'Zed', constellation: 0, elementKey: 'anemo' },
      { ...character(2), name: 'Alpha', constellation: 5, elementKey: 'pyro' },
      { ...character(3, 4), name: 'Autre' },
    ];
    h.box.preference = { sortKey, direction: 'asc' };
    const ascending = combined(await h.boxRun());
    const first = sortKey === 'alphabetical' ? 'Alpha' : 'Zed', second = first === 'Alpha' ? 'Zed' : 'Alpha';
    expect(ascending.indexOf(first)).toBeLessThan(ascending.indexOf(second));
    expect(ascending.indexOf(second)).toBeLessThan(ascending.indexOf('Autre'));
    h.box.preference = { sortKey, direction: 'desc' };
    const descending = combined(await h.boxRun()); expect(descending.indexOf(second)).toBeLessThan(descending.indexOf(first));
  });
  it('normalizes accented element filters', async () => {
    const h = harness(); h.box.characters = [character(1, 5, 'electro')];
    expect(combined(await h.boxRun('ÉLECTRO'))).toContain('Box ⚡ Electro');
  });
  it('balances pages and fills the missing rarity without repeating characters', async () => {
    const h = harness(); h.box.characters = [...Array.from({ length: 12 }, (_, i) => character(i)), ...Array.from({ length: 3 }, (_, i) => character(i + 20, 4))];
    const first = combined(await h.boxRun('p1')), second = combined(await h.boxRun('p2'));
    expect((first.match(/\(C\d\)/g) ?? []).length).toBe(10); expect((second.match(/\(C\d\)/g) ?? []).length).toBe(5);
    const all = (first + second).match(/Perso \d+/g)!; expect(new Set(all).size).toBe(15);
    expect(first.indexOf('Perso 20')).toBeLessThan(first.indexOf('Perso 05'));
    expect(await h.boxRun('p3')).toBe('⚠️ Axel, cette page est vide.');
  });
  it('takes 5 + 5 when both groups are present', async () => {
    const h = harness(); h.box.characters = [...Array.from({ length: 10 }, (_, i) => character(i)), ...Array.from({ length: 10 }, (_, i) => character(i + 20, 4))];
    const first = combined(await h.boxRun('p1')); expect(first).toContain('Perso 04'); expect(first).not.toContain('Perso 05'); expect(first).toContain('Perso 24'); expect(first).not.toContain('Perso 25');
    const second = combined(await h.boxRun('p2')); expect(second).toContain('Perso 05'); expect(second).toContain('Perso 25');
  });
  it.each(['a', 'd', 'c', 'e'])('persists %s, toggles repeated commands, freezes retry intent', async option => {
    const h = harness(); await h.boxRun(option, 'first'); const initial = h.box.preference;
    await h.boxRun(option, 'second'); expect(h.box.preference.direction).not.toBe(initial.direction);
    const repeated = h.box.preference; await h.boxRun(option, 'second'); expect(h.box.preference).toEqual(repeated);
    expect(h.chat.rememberCommandRefreshScopes).toHaveBeenCalledWith('second', ['box']);
  });
  it('toggles only an exact owned normalized name and keeps retry from toggling again', async () => {
    const h = harness(); h.box.characters = [{ ...character(1), name: 'Étoile Royale' }];
    expect(await h.boxRun('favoris etoile')).toContain('introuvable'); expect(h.services.setBoxCharacterFavorite.execute).not.toHaveBeenCalled();
    expect(await h.boxRun('favoris ETOILE ROYALE', 'add')).toContain('ajouté aux favoris');
    expect(await h.boxRun('favoris ETOILE ROYALE', 'add')).toContain('ajouté aux favoris');
    expect(await h.boxRun('favoris Étoile Royale', 'remove')).toContain('retiré des favoris');
  });
  it('sorts favorites alphabetically and packs every long entry intact', async () => {
    const h = harness(); h.box.characters = Array.from({ length: 40 }, (_, i) => ({ ...character(i), name: `${String(i).padStart(2, '0')} Nom composé, Très Long`, favorite: true }));
    h.box.characters.reverse(); const parts = await h.boxRun('favoris'); expect(Array.isArray(parts)).toBe(true);
    expect(parts.length).toBeGreaterThan(1); expect(combined(parts)).not.toContain('autres');
    for (const c of h.box.characters) expect((parts as readonly string[]).filter(part => part.includes(`${c.name} (C${c.constellation})`))).toHaveLength(1);
    expect((parts as readonly string[]).every(part => Array.from(part).length <= 500)).toBe(true);
    expect(combined(parts).indexOf('00 Nom')).toBeLessThan(combined(parts).indexOf('39 Nom'));
    const full = await h.boxRun(); expect(full.length).toBeGreaterThan(1);
    for (const c of h.box.characters) expect((full as readonly string[]).filter(part => part.includes(`${c.name} (C${c.constellation})`))).toHaveLength(1);
  });
  it.each(['p0', 'p-1', 'p1.5', 'p99999999999999999999', 'unknown', '5 extra'])('rejects invalid option %s', async option => {
    expect(await harness().boxRun(option)).toMatch(/^Syntaxe : !box/);
  });
  it('reports empty Box and favorites', async () => {
    const h = harness(); h.box.characters = []; expect(await h.boxRun()).toBe('⚠️ Axel, ta Box est vide pour le moment.');
    expect(await h.boxRun('favoris')).toBe('⚠️ Axel, tu n’as aucun favori. Utilise : !box favoris NomPerso');
  });
});

describe('Codes and Coffre Chat contract', () => {
  it('discovers all codes and keeps tokens intact in long lists', async () => {
    const h = harness(); expect(await h.codeRun()).toEqual(['🎁 Codes disponibles : CADEAU | Récupérés : 0.']);
    h.codes.available = Array.from({ length: 30 }, (_, i) => ({ ...h.code, token: `CADEAU_${i}_TOKEN_LONGUEUR` }));
    const parts = await h.codeRun(); expect(parts.length).toBeGreaterThan(1);
    for (const c of h.codes.available) expect((parts as readonly string[]).filter(part => part.includes(c.token))).toHaveLength(1);
    h.codes.available = []; expect(await h.codeRun()).toBe('🎁 Aucun code cadeau disponible actuellement. Récupérés : 0.');
  });
  it('uses authoritative totals, positive rewards in order and description', async () => {
    const h = harness(); expect(await h.codeRun('cadeau')).toBe('✅ Axel a utilisé CADEAU ! +💠1 600 Primogemmes (12 500) | +🪙200 000 Moras (850 000) | +200 particules 🔥 Pyro (1 250) | +20 particules ☄️ Geo (50) | Bonne fête !');
    expect(h.services.giftCodeService.claim).toHaveBeenCalledWith(actor, 'edition', 'code', 'INTERNAL_CHAT');
  });
  it('reports actual enriched gains and never announces a skipped configured Event reward', async () => {
    const h = harness();
    const original = await h.services.giftCodeService.claim();
    h.services.giftCodeService.claim.mockImplementation(async () => ({ ...original,
      grantedRewards: [{ resourceKey: 'masterless-stella-fortuna', displayName: 'Masterless Stella Fortuna', amount: '2' }],
      eventReward: { granted: false, reason: 'NOT_JOINED', editionId: null, milestones: [] },
    }));
    const text = await h.codeRun('CADEAU');
    expect(text).toContain('+2 Masterless Stella Fortuna');
    expect(text).toContain('Gains Event non accordés');
    expect(text).not.toContain('Primogemmes');
    expect(text).not.toContain('+80');
  });
  it('omits empty description, refuses unavailable codes and already claimed', async () => {
    const h = harness(); h.code.description = ''; expect(await h.codeRun('cadeau')).not.toMatch(/\| $/);
    const unknown = harness(); unknown.codes.available = []; expect(await unknown.codeRun('inconnu')).toBe('⚠️ Ce code cadeau n’est pas disponible.');
    const other = harness(); other.codes.available = [];
    other.codes.claimed = [{ ...other.code, claimed: true }]; expect(await other.codeRun('CADEAU')).toBe('⚠️ Axel, tu as déjà utilisé le code CADEAU.');
    expect(other.services.giftCodeService.claim).not.toHaveBeenCalled();
  });
  it.each(['GIFT_CODE_NOT_FOUND', 'GIFT_CODE_UNAVAILABLE', 'GIFT_CODE_ALREADY_CLAIMED'] as const)('localizes claim race %s', async code => {
    const h = harness(); h.services.giftCodeService.claim.mockRejectedValue(new BusinessError(code, 'internal'));
    expect(await h.codeRun('CADEAU')).toBe(code === 'GIFT_CODE_ALREADY_CLAIMED' ? '⚠️ Axel, tu as déjà utilisé le code CADEAU.' : '⚠️ Ce code cadeau n’est pas disponible.');
  });
  it('replays a confirmed claim instead of treating it as a new claim', async () => {
    const h = harness(); h.code.claimed = true; h.chat.hasConfirmedCommandMutation.mockResolvedValue(true);
    h.services.giftCodeService.claim.mockResolvedValue({ claimed: [{ ...h.code, claimed: true }], resources: { primogems: '12500', moras: '850000', particles: { pyro: '1250', geo: '50' } }, operation: { alreadyProcessed: true } });
    expect(await h.codeRun('CADEAU')).toContain('✅ Axel a utilisé CADEAU');
  });
  it('does not expose an expired already-claimed edition as available', async () => {
    const h = harness(); h.codes.available = [];
    h.codes.claimed = [{ ...h.code, claimed: true, available: false } as typeof h.code];
    expect(await h.codeRun('CADEAU')).toBe('⚠️ Ce code cadeau n’est pas disponible.');
    expect(h.services.giftCodeService.claim).not.toHaveBeenCalled();
  });
  it('keeps every positive Collection item in alphabetical order with stable-key emojis', async () => {
    const h = harness(); h.inventory.items = Array.from({ length: 30 }, (_, i) => ({ id: String(i), externalKey: i === 0 ? 'flocon_enchante' : 'unknown_' + i, displayName: `Objet ${String(29 - i).padStart(2, '0')} Avec un Nom Composé`, quantity: 2n, section: 'collection', category: 'collection', description: null, firstObtainedAt: null, acquisitionHint: null }));
    const parts = await h.coffreRun(); expect(parts.length).toBeGreaterThan(1);
    expect((parts as readonly string[])[0]).toMatch(/^🏆 Coffre de Axel/); expect((parts as readonly string[])[1]).toMatch(/^🏆 Coffre suite/);
    for (const item of h.inventory.items) expect((parts as readonly string[]).filter(part => part.includes(`${item.displayName} (x2)`))).toHaveLength(1);
    expect(combined(parts)).toContain('❄️ Objet 29'); expect(combined(parts)).toContain('❔ Objet 00');
    expect(combined(parts).indexOf('Objet 00')).toBeLessThan(combined(parts).indexOf('Objet 29'));
    expect((parts as readonly string[]).every(part => Array.from(part).length <= 450)).toBe(true);
    h.inventory.items = h.inventory.items.map(item => ({ ...item, quantity: 0n }));
    expect(await h.coffreRun()).toBe('ℹ️ Axel, ton Coffre est vide. Les objets de Collection s’obtiennent avec !event collection.');
  });
  it('keeps all twelve historical Collection emojis and excludes ordinary objects', async () => {
    const h = harness(); const keys = ['lanterne_nouvel_an', 'coeur_cristallin', 'bourgeon_eternel', 'oeuf_enchante', 'fleur_de_printemps', 'coquillage_dore', 'etoile_filante', 'boussole_antique', 'gerbe_de_recolte', 'citrouille_hantee', 'feuille_ancienne', 'flocon_enchante'];
    h.inventory.items = keys.map((externalKey, index) => ({ id: externalKey, externalKey, displayName: 'Nom ' + index, quantity: 1n, section: 'collection', category: 'collection', description: null, firstObtainedAt: null, acquisitionHint: null }));
    const before = structuredClone(h.inventory); const value = combined(await h.coffreRun());
    for (const emoji of ['🎆', '💖', '🌱', '🥚', '🌸', '🏝️', '⭐', '🧭', '🌾', '🎃', '🍁', '❄️']) expect(value).toContain(emoji);
    expect(h.inventory).toEqual(before);
    h.inventory.items = h.inventory.items.map(item => ({ ...item, section: 'objects' })); expect(await h.coffreRun()).toContain('ton Coffre est vide');
  });
  it('advertises canonical syntax and adds no unapproved root aliases', () => {
    expect(chatHelp('box')).toContain('!box [5|4|6|élément|pN|favoris [personnage]|a|d|c|e]');
    expect(chatHelp('banque')).toContain('!banque [deposer|retirer <montant|max>]');
    for (const root of ['bank', 'codes', 'chest']) expect(findChatCommand(root)).toBeUndefined();
  });
});
