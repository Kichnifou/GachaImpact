import { describe, expect, it, vi } from 'vitest';
import { ChatCommandDispatcher, type ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';
import type { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import { chatHelp, findChatCommand, chatCommandRegistry } from '../src/application/chat/chat-command-registry.js';
import { passifsCommand, sacCommand } from '../src/application/chat/chat-command-format.js';
import { elementKeys } from '../src/domain/economy/resources.js';
import type { PlayerInventory } from '../src/application/inventory/inventory-store.js';

const identity = { subject: 'owner' }, commandId = 'command';
export function remainingHarness() {
  const chat = {
    send: vi.fn(async (_: unknown, content: string) => ({ message: { id: commandId, messageType: 'COMMAND', content } })),
    findGameResult: vi.fn(async () => null), findGameResults: vi.fn(async () => []),
    hasConfirmedCommandMutation: vi.fn(async () => false), commandMissionCompletions: vi.fn(async () => []),
    commandRefreshScopes: vi.fn(async () => []), rememberCommandRefreshScopes: vi.fn(),
    rememberCommandQuantity: vi.fn(async (_: string, value: bigint) => value),
    rememberCommandText: vi.fn(async (_: string, _field: string, value: string) => value),
    publishGameResult: vi.fn(async (_: string, content: string | readonly string[]) => ({ message: { content: typeof content === 'string' ? content : content[0] }, messages: (typeof content === 'string' ? [content] : content).map(content => ({ content })) })),
  };
  const actor = { id: 'self', displayName: 'Axel', elementKey: 'geo', status: 'ACTIVE' };
  const services = {
    socialService: { actor: vi.fn(async () => actor) },
    choosePlayerElement: { execute: vi.fn(async () => ({ elementKey: 'geo', alreadySelected: true })) },
    convertPersonalParticlesChat: { execute: vi.fn(async () => ({ resources: { primogems: 12345678901234567890n } })) },
    getCurrentGacha: { execute: vi.fn(async () => ({ playerState: { pity5: 4, pity4: 2, guaranteedFeatured5: true, captureProgress: 2, fiftyFiftyLostStreak: 99 } })) },
  };
  const dispatcher = new ChatCommandDispatcher(chat as unknown as GlobalChatService, services as unknown as ChatCommandServices);
  return { services, chat, actor, send: (content: string) => dispatcher.send(identity, content, 'intent') };
}

describe('Remaining command aliases and simple presentation', () => {
  it.each([
    ['convertir', 'conv'], ['quotis', 'quoti'], ['quotis', 'daily'], ['echanger', 'echange'], ['echanger', 'ech'],
    ['expedition', 'exp'], ['giveaway', 'ga'], ['infos', 'info'], ['legende', 'légende'], ['legende', 'legendes'], ['legende', 'légendes'], ['legende', 'leg'],
  ])('resolves %s / %s to the same definition and canonical Help', (canonical, alias) => {
    const command = findChatCommand(canonical);
    expect(findChatCommand(alias.toUpperCase())).toBe(command);
    expect(chatHelp(alias)).toBe(chatHelp(canonical));
  });
  it('keeps every normalized root unambiguous and previous roots intact', () => {
    const seen = new Map<string, string>();
    for (const definition of chatCommandRegistry) for (const root of [definition.name, ...definition.aliases]) {
      const normalized = root.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
      expect(seen.get(normalized) ?? definition.name).toBe(definition.name); seen.set(normalized, definition.name);
    }
    expect(findChatCommand('ban')?.name).toBe('banniere');
    for (const root of ['xp', 'gift', 'subscription', 'bank']) expect(findChatCommand(root)).toBeUndefined();
    expect(findChatCommand('giveaway')?.adminOnlySubcommands).toEqual(['open', 'close']);
  });
  it('keeps ga gated on standalone and does not call a business service', async () => {
    const h = remainingHarness(); const result = await h.send('!GA open');
    expect(result.result?.content).toBe('Cette commande est réservée à Twitch.');
    expect(h.services.socialService.actor).not.toHaveBeenCalled();
  });
  it('converts via conv using the same owner, bigint amount, key and authoritative total', async () => {
    const h = remainingHarness(); const result = await h.send('!CONV 100');
    expect(h.services.convertPersonalParticlesChat.execute).toHaveBeenCalledWith(identity, 100n, commandId);
    expect(result.result?.content).toBe('✅ Axel convertit 100 particules ☄️ Geo en 💠100 Primogemmes (12345678901234567890).');
    expect((await h.send('!conv 2m')).result?.content).toBe('Syntaxe : !convertir <montant>.');
  });
  it('shows modern Capture rather than legacy loss streak', async () => {
    const h = remainingHarness(); const result = await h.send('!pity');
    expect(result.result?.content).toContain('✨ Capture : 2/3'); expect(result.result?.content).not.toContain('99');
  });
  it('normalizes accented elements and refuses changing the permanent element', async () => {
    const h = remainingHarness(); expect((await h.send('!element GÉO')).result?.content).toContain('déjà choisi ton élément : ☄️ Geo');
    expect(h.services.choosePlayerElement.execute).toHaveBeenCalledWith(identity, 'geo');
    h.services.choosePlayerElement.execute.mockClear(); expect((await h.send('!element Pyro')).result?.content).toContain('déjà choisi ton élément');
    expect(h.services.choosePlayerElement.execute).not.toHaveBeenCalled();
  });
  it('describes every passive from the modern reference without a player/team read', () => {
    const parts = passifsCommand([], 'syntax') as readonly string[];
    expect(parts.length).toBeGreaterThan(1); expect(parts.every(part => Array.from(part).length <= 500)).toBe(true);
    expect(parts.join(' ')).toContain('5 particules de chaque élément');
    for (const element of elementKeys) expect(passifsCommand([element], 'syntax')).toHaveLength(1);
    expect(passifsCommand(['ÉLECTRO'], 'syntax')).toEqual(passifsCommand(['electro'], 'syntax'));
    expect(passifsCommand(['unknown'], 'syntax')).toBe('syntax');
  });
  it('shows all seven stocks, primary first, actual objects and no Collection possessions', async () => {
    const inventory: PlayerInventory = { resources: [{ key: 'primogems', amount: 12345678901234567890n, displayName: '', category: '', elementKey: null }], items: [
      { id: 'stella', externalKey: 'stella', displayName: 'Masterless Stella Fortuna', quantity: 3n, section: 'objects', category: '', description: null, firstObtainedAt: null, acquisitionHint: null },
      { id: 'event', externalKey: 'event', displayName: 'Collection cachée', quantity: 4n, section: 'collection', category: '', description: null, firstObtainedAt: null, acquisitionHint: null },
    ] };
    const services = { socialService: { actor: vi.fn(async () => ({ displayName: 'Axel', elementKey: 'geo' })) }, getCurrentPlayerInventory: { execute: vi.fn(async () => inventory) } };
    const parts = await sacCommand(identity, services as unknown as ChatCommandServices); const result = parts.join(' ');
    expect(result).toContain('12 345 678 901 234 567 890'); expect(result).toContain('Masterless Stella Fortuna (x3)'); expect(result).not.toContain('Collection cachée');
    expect(result.indexOf('☄️ Geo')).toBeLessThan(result.indexOf('🔥 Pyro'));
    for (const element of elementKeys) expect(result).toContain(element === 'electro' ? 'Electro' : element[0]!.toUpperCase() + element.slice(1));
  });
});
