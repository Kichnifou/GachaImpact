import { describe, expect, it, vi } from 'vitest';
import { ChatCommandDispatcher, type ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';
import type { GlobalChatService } from '../src/application/chat/global-chat-service.js';

const commandId = '11111111-1111-4111-8111-111111111111';
const actor = { subject: 'actor' };

function harness() {
  const chat = {
    send: vi.fn(async (_identity: unknown, content: string) => ({ message: { id: commandId, messageType: 'COMMAND', content }, xpGranted: 0, replayed: false })),
    findGameResult: vi.fn(async () => null),
    hasConfirmedCommandMutation: vi.fn(async () => false),
    publishGameResult: vi.fn(async (_id: string, content: string) => ({ message: { id: 'answer', content, messageType: 'GAME_RESULT' }, replayed: false })),
    rememberCommandQuantity: vi.fn(async (_id: string, quantity: bigint) => quantity),
  };
  const execute = (value: unknown) => ({ execute: vi.fn(async () => value) });
  const services = {
    getCurrentGacha: execute({ banner: { featuredFiveStars: [{ id: 'five', name: 'A' }], featuredFourStars: [{ id: 'four', name: 'B' }] }, playerState: { pity5: 9, pity4: 2, guaranteedFeatured5: true, captureProgress: 1, selectedBannerCharacterId: 'five' } }),
    performGachaPullChat: execute({ operation: { primogemCost: 160n }, results: [{ character: { name: 'A' }, rarity: 5 }] }),
    getCurrentPlayerBox: execute({ summary: { totalOwned: 1, fiveStars: 1, fourStars: 0, c6: 0 }, characters: [{ name: 'A', constellation: 0 }] }),
    getCurrentPlayerTeams: execute({ teams: [{ active: true, position: 1, name: null, slots: [{ character: { name: 'A' } }] }] }),
    getCurrentPlayerInventory: execute({ resources: [{ key: 'primogems', amount: 160n, elementKey: null }, { key: 'moras', amount: 50n, elementKey: null }], items: [{ section: 'collection', quantity: 1n, displayName: 'Objet' }] }),
    getCurrentPlayerBank: execute({ bankMoras: 100n, walletMoras: 50n, estimatedInterest: 3n }),
    depositPlayerBankChat: execute({ bankMoras: 150n, walletMoras: 0n }),
    withdrawPlayerBankChat: execute({ bankMoras: 50n, walletMoras: 100n }),
    convertPersonalParticlesChat: execute({ resources: { primogems: 180n } }),
    getCurrentPlayerShop: execute({ resources: { moras: 100_000n }, items: [{ id: 'primos', externalKey: 'primogem-bundle', displayName: 'Lot de Primogemmes', priceAmount: 50_000n, available: true }, { id: 'ticket', externalKey: 'reward-ticket', displayName: 'Ticket', priceAmount: 150_000n, available: true }] }),
    purchaseShopItemChat: execute({ purchase: { quantity: 2n, displayName: 'Lot de Primogemmes', totalPrice: 100_000n, effect: { type: 'resource_bundle', amount: 320n, resourceKey: 'primogems' } } }),
    socialService: {
      actor: vi.fn(async () => ({ id: 'self', displayName: 'Moi' })),
      directory: vi.fn(async () => ({ players: [{ id: 'other', displayName: 'Autre' }], page: 1, totalPages: 1 })),
      connected: vi.fn(async () => ({ players: [{ status: 'ONLINE', displayName: 'Autre' }], total: 1 })),
      profile: vi.fn(async () => ({ player: { displayName: 'Autre', level: 5, elementKey: 'pyro' }, box: { access: 'PRIVATE' }, team: { access: 'PRIVATE' }, statistics: { access: 'PRIVATE' } })),
      friends: vi.fn(async () => ({ friends: [{ playerId: 'other', level: 3 }] })),
    },
    giftCodeService: { listForPlayer: vi.fn(async () => ({ available: [{ token: 'CODE', editionId: 'edition', rewards: [{ amount: '1600', displayName: 'Primogemmes' }] }], claimed: [{ token: 'OTHER', editionId: 'other', claimed: true }] })), claim: vi.fn(async () => ({})) },
    eventService: { getCurrent: vi.fn(async () => ({ festival: { emoji: '🎊', title: 'Festival', currency: { label: 'Monnaies' } }, participation: { joined: false }, currency: { amount: '0' } })), getRanking: vi.fn(async () => ({ entries: [{ rank: 1, displayName: 'Autre', points: 10 }] })) },
    expeditionService: { getState: vi.fn(async () => ({ operationalStatus: 'IDLE', departureUsedToday: false })) },
    contestService: { getCurrent: vi.fn(async () => ({ active: null, theme: { label: 'Force' }, dailyUsed: false })) },
    dailyCombatService: { getDaily: vi.fn(async () => ({ status: 'TODO', loadout: { slots: [] }, preview: null, playerStats: { totalFights: 0n, totalWins: 0n, totalManualWins: 0n, totalLosses: 0n }, encounter: { enemies: [] }, canFight: false })) },
    monthlyBossService: { getCurrent: vi.fn(async () => ({ boss: { name: 'Boss', currentHp: 10n, maxHp: 20n, resistanceElementKey: 'pyro' }, attackState: 'AVAILABLE', preview: null })) },
    getDailyChallenge: execute({ status: 'AVAILABLE' }),
    getTodayWheelState: execute({ spun: false }),
  };
  const dispatcher = new ChatCommandDispatcher(chat as unknown as GlobalChatService, services as unknown as ChatCommandServices);
  const send = async (content: string) => (await dispatcher.send(actor, content, 'intent')).result?.content;
  return { chat, services, send };
}

describe('Chat command adapters', () => {
  it.each([
    ['!pity', 'Pity 5★'], ['!banniere', 'Bannière'], ['!box', 'Box'], ['!team', 'Team 1'],
    ['!sac', 'Sac'], ['!coffre', 'Coffre'], ['!shop', 'Boutique'], ['!banque', 'Banque'],
    ['!infos Autre', 'Autre'], ['!liste pyro', 'pyro'], ['!code', 'Codes disponibles'],
    ['!event', 'Festival'], ['!event top', 'Festival Top 10'], ['!expedition', 'Expédition'],
    ['!concours', 'Concours'], ['!combat', 'Combat du jour'], ['!combat boss', 'Boss'], ['!quotis', 'Quotidiennes'],
  ])('formats %s from the existing domain projection', async (command, expected) => {
    const { send } = harness();
    expect(await send(command)).toContain(expected);
  });

  it('passes the durable command message ID to mutation owners and publishes one public answer', async () => {
    const { chat, services, send } = harness();
    expect(await send('!pull 1')).toContain('Invocation ×1');
    expect(services.performGachaPullChat.execute).toHaveBeenCalledWith(actor, 1, commandId);
    expect(await send('!shop primos max')).toContain('Boutique');
    expect(chat.rememberCommandQuantity).toHaveBeenCalledWith(commandId, 2n);
    expect(services.purchaseShopItemChat.execute).toHaveBeenCalledWith(actor, 'primos', 2n, commandId);
    expect(await send('!code CODE')).toContain('Code CODE récupéré');
    expect(services.giftCodeService.claim).toHaveBeenCalledWith(actor, 'edition', commandId, 'INTERNAL_CHAT');
    expect(chat.publishGameResult).toHaveBeenCalledTimes(3);
  });

  it('returns public syntax, unavailable and unknown feedback without calling a domain mutation', async () => {
    const { send, services } = harness();
    expect(await send('!pull 2')).toBe('Syntaxe : !pull [1|10].');
    expect(await send('!echanger')).toBe('Cette commande n’est pas encore disponible dans le Chat.');
    expect(await send('!mission')).toBe('Cette fonctionnalité n’est pas encore disponible.');
    expect(await send('!gift')).toBe('Commande inconnue. Utilise !help.');
    expect(services.performGachaPullChat.execute).not.toHaveBeenCalled();
  });

  it('does not publish an error if the domain mutation was already confirmed', async () => {
    const { chat, services, send } = harness();
    chat.hasConfirmedCommandMutation.mockResolvedValue(true);
    services.depositPlayerBankChat.execute.mockRejectedValue(new Error('Result projection failed'));
    await expect(send('!banque deposer 10')).rejects.toThrow('Result projection failed');
    expect(chat.publishGameResult).not.toHaveBeenCalled();
  });

  it('reports an earlier Code claim without claiming it again', async () => {
    const { services, send } = harness();
    services.giftCodeService.listForPlayer.mockResolvedValue({ available: [], claimed: [{ token: 'CODE', editionId: 'edition', claimed: true }] });
    expect(await send('!code CODE')).toBe('Code CODE déjà récupéré.');
    expect(services.giftCodeService.claim).not.toHaveBeenCalled();
  });

  it('formats daily states as player-facing text', async () => {
    const { send } = harness();
    expect(await send('!quotis')).toBe('Quotidiennes : Roue à faire · Défi disponible · Combat à faire · Expédition à faire.');
  });
});
