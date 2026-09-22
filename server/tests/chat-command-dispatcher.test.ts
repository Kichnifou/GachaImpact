import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { ChatCommandDispatcher, type ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';
import type { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import { BusinessError } from '../src/application/errors.js';

const commandId = '11111111-1111-4111-8111-111111111111';
const actor = { subject: 'actor' };

function harness() {
  const chat = {
    send: vi.fn(async (_identity: unknown, content: string) => ({ message: { id: commandId, messageType: 'COMMAND', content }, xpGranted: 0, replayed: false })),
    findGameResult: vi.fn(async () => null),
    findGameResults: vi.fn(async () => []),
    hasConfirmedCommandMutation: vi.fn(async () => false),
    publishGameResult: vi.fn(async (_id: string, content: string) => ({ message: { id: 'answer', content, messageType: 'GAME_RESULT' }, messages: [{ id: 'answer', content, messageType: 'GAME_RESULT' }], replayed: false })),
    rememberCommandQuantity: vi.fn(async (_id: string, quantity: bigint) => quantity),
    rememberCommandText: vi.fn(async (_id: string, _field: string, value: string) => value),
  };
  const execute = (value: unknown) => ({ execute: vi.fn(async () => value) });
  const services = {
    getCurrentGacha: execute({ banner: { featuredFiveStars: [{ id: 'five', name: 'A' }], featuredFourStars: [{ id: 'four', name: 'B' }] }, playerState: { pity5: 9, pity4: 2, guaranteedFeatured5: true, captureProgress: 1, selectedBannerCharacterId: 'five' } }),
    getCharacters: execute([{ id: 'five', name: 'A' }, { id: 'candidate', name: 'Candidat' }]),
    setGachaTarget: execute({}),
    bannerVotes: { getCurrent: vi.fn(async () => ({ bannerRotationId: 'rotation', ownVote: null, candidates: [{ characterId: 'candidate', voteCount: 0 }] })), vote: vi.fn(async () => ({})) },
    performGachaPullChat: execute({ operation: { primogemCost: 160n }, results: [{ character: { name: 'A' }, rarity: 5 }] }),
    getCurrentPlayerBox: execute({ summary: { totalOwned: 1, fiveStars: 1, fourStars: 0, c6: 0 }, characters: [{ id: 'five', name: 'A', constellation: 0, firstObtainedAt: new Date('2026-09-01') }] }),
    useMasterlessStella: execute({ character: { name: 'A', constellation: 1 }, stellaRemaining: 2n }),
    getCurrentPlayerTeams: execute({ teams: [{ active: true, position: 1, name: null, slots: [{ character: { name: 'A' } }], passives: [{ displayName: 'Élan', stacks: 1, description: 'Bonus' }] }] }),
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
      friends: vi.fn(async () => ({ friends: [{ playerId: 'other', level: 3, tier: 'CLOSE', heartSent: false }], players: [{ id: 'other', displayName: 'Autre' }], requests: [], summary: { activeFriends: 1, available: 1 } })),
      friendship: { mutate: vi.fn(async () => ({ state: 'ACTIVE' })), sendHearts: vi.fn(async () => ({ message: 'Cœur envoyé.', level: 3 })) },
    },
    tradePlayer: execute({ id: 'self' }),
    tradeService: {
      partners: vi.fn(async () => ({ partners: [{ id: 'other', displayName: 'Autre', maximum: 5n }] })),
      snapshot: vi.fn(async () => ({ received: [{ id: 'request', sender: { displayName: 'Autre' }, currentAmount: 3n }], sent: [{ id: 'request', recipient: { displayName: 'Autre' }, currentAmount: 3n }] })),
      create: vi.fn(async () => ({ amount: 3n })), mutate: vi.fn(async () => ({ state: 'ACCEPTED', amount: 3n })),
      all: vi.fn(async () => ({ results: [{ state: 'ACCEPTED' }] })),
    },
    choosePlayerElement: execute({ elementKey: 'pyro' }),
    giftCodeService: { listForPlayer: vi.fn(async () => ({ available: [{ token: 'CODE', editionId: 'edition', rewards: [{ amount: '1600', displayName: 'Primogemmes' }] }], claimed: [{ token: 'OTHER', editionId: 'other', claimed: true }] })), claim: vi.fn(async () => ({})) },
    eventService: {
      getCurrent: vi.fn(async () => ({ festival: { emoji: '🎊', title: 'Festival', currency: { label: 'Monnaies' } }, participation: { joined: false, points: 0 }, currency: { amount: '3' }, shop: { rates: { primogems: 160, moras: 20000 }, collection: { label: 'Souvenir', cost: 80, obtainedThisEdition: false } }, gameA: { theme: { key: 'feu', label: 'Feu' } }, gameB: { theme: { label: 'Coffre' } }, gameC: { theme: { label: 'Mot doux' } } })),
      getRanking: vi.fn(async () => ({ entries: [{ rank: 1, displayName: 'Autre', points: 10 }] })),
      join: vi.fn(async () => ({ festival: { title: 'Festival', currency: { label: 'Monnaies' } }, currency: { amount: '4' } })),
      attemptGameA: vi.fn(async () => ({ attempt: { succeeded: true } })), attemptGameB: vi.fn(async () => ({ attempt: { kind: 'CORRECT' } })),
      searchGameCRecipients: vi.fn(async () => ({ recipients: [{ playerId: 'other', displayName: 'Autre' }], totalPages: 1 })), sendGameC: vi.fn(async () => ({})),
      claimCalendar: vi.fn(async () => ({ festival: { title: 'Festival', currency: { label: 'Monnaies' } }, calendarClaim: { day: 1, reward: 2 } })),
      convertShop: vi.fn(async () => ({ currency: { amount: '2' } })),
      purchaseCollection: vi.fn(async () => ({ festival: { title: 'Festival', currency: { label: 'Monnaies' } }, shop: { collection: { label: 'Souvenir', cost: 80 } } })),
    },
    expeditionService: { getState: vi.fn(async () => ({ operationalStatus: 'IDLE', departureUsedToday: false })), start: vi.fn(async () => ({})), claim: vi.fn(async () => ({ reward: { amount: 5n, resourceKey: 'primogems' } })) },
    contestService: { getCurrent: vi.fn(async () => ({ active: null, theme: { label: 'Force' }, dailyUsed: false })) },
    dailyCombatService: { getDaily: vi.fn(async () => ({ status: 'TODO', loadout: { slots: [] }, preview: null, playerStats: { totalFights: 0n, totalWins: 0n, totalManualWins: 0n, totalLosses: 0n }, encounter: { enemies: [{ character: { name: 'Ennemi', elementKey: 'cryo' }, weakAgainstElements: ['pyro'], resistantAgainstElements: ['hydro'] }] }, canFight: false })), previewActiveTeam: vi.fn(async () => ({ finalHalfPoints: 140 })), getElementMatrix: vi.fn(async () => [{ element: 'cryo', weakAgainstElements: ['pyro'], resistantAgainstElements: ['hydro'] }]), fight: vi.fn(async () => ({ result: { won: true, chanceHalfPoints: 140 } })) },
    monthlyBossService: { getCurrentForChat: vi.fn(async () => ({ boss: { id: 'boss', name: 'Boss', currentHp: 10n, maxHp: 20n, resistanceElementKey: 'pyro' }, status: 'ALIVE', attackState: 'AVAILABLE', preview: null, playerStats: { totalDamage: 0n, totalAttacks: 0n, totalParticipated: 0n, totalRewarded: 0n, finalBlows: 0n, bestHit: 0n } })), attackWithActiveTeam: vi.fn(async () => ({ result: { damage: 5n, defeated: false }, view: { boss: { name: 'Boss' } } })) },
    getDailyChallenge: execute({ status: 'AVAILABLE' }),
    getTodayWheelState: execute({ spun: false }),
    spinDailyWheelChat: execute({ resultType: 'primogems', resourceKey: 'primogems', amount: 160n }),
  };
  const dispatcher = new ChatCommandDispatcher(chat as unknown as GlobalChatService, services as unknown as ChatCommandServices);
  const send = async (content: string) => (await dispatcher.send(actor, content, 'intent')).result?.content;
  return { chat, services, send };
}

describe('Chat command adapters', () => {
  it('requires only the Contest read projection in its dependency contract', () => {
    expectTypeOf<keyof ChatCommandServices['contestService']>().toEqualTypeOf<'getCurrent'>();
  });

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
    expect(await send('!pull 11')).toBe('Syntaxe : !pull [1..10].');
    expect(await send('!echanger')).toContain('Partenaires échangeables');
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

  it.each([
    ['!select A', 'setGachaTarget', 'execute'], ['!vote Candidat', 'bannerVotes', 'vote'],
    ['!stella A', 'useMasterlessStella', 'execute'], ['!roue', 'spinDailyWheelChat', 'execute'],
    ['!element pyro', 'choosePlayerElement', 'execute'], ['!ami ajouter Autre', 'socialService', 'friendship'],
    ['!echanger Autre 3', 'tradeService', 'create'], ['!expedition A', 'expeditionService', 'start'],
    ['!event go', 'eventService', 'join'],
    ['!combat go', 'dailyCombatService', 'fight'], ['!combat boss go', 'monthlyBossService', 'attackWithActiveTeam'],
  ])('publishes the domain result for %s without command XP', async (command, service, method) => {
    const { chat, services, send } = harness();
    expect(await send(command)).toBeTruthy();
    expect(chat.publishGameResult).toHaveBeenCalledOnce();
    const sent = await chat.send.mock.results[0]!.value;
    const owner = services[service as keyof typeof services] as Record<string, unknown>;
    expect(method === 'friendship' ? (owner.friendship as { mutate: unknown }).mutate : owner[method]).toHaveBeenCalledOnce();
    expect(sent.xpGranted).toBe(0);
  });

  it.each([
    '!select', '!vote', '!obtention A', '!passifs', '!ami', '!ami liste', '!ami demandes', '!ami voir Autre', '!ami coeur Autre', '!ami coeur all',
    '!echanger liste', '!echanger Autre MAX', '!echanger accepter', '!echanger accepter Autre', '!echanger annuler Autre',
    '!combat info', '!combat auto', '!combat elements', '!combat help', '!combat stat',
    '!expedition retour',
  ])('returns a public answer for %s', async command => {
    const { services, send } = harness();
    if (command === '!expedition retour') services.expeditionService.getState.mockResolvedValue({ operationalStatus: 'READY', activeCharacter: { name: 'A' } } as never);
    expect(await send(command)).toBeTruthy();
  });

  it.each([
    ['!event', 'getCurrent'], ['!event sac', 'getCurrent'], ['!event boutique', 'getCurrent'],
    ['!event top', 'getRanking'], ['!event go', 'join'], ['!event primos 1', 'convertShop'],
    ['!event moras max', 'convertShop'], ['!event collection', 'purchaseCollection'],
    ['!event calendrier', 'claimCalendar'], ['!event Feu', 'attemptGameA'],
    ['!event Coffre 01010', 'attemptGameB'], ['!event Mot doux Autre "bonjour"', 'sendGameC'],
  ])('keeps %s connected to the Event owner and a public result', async (command, method) => {
    const { chat, services, send } = harness();
    expect(await send(command)).toBeTruthy();
    expect(services.eventService[method as keyof typeof services.eventService]).toHaveBeenCalled();
    expect(chat.publishGameResult).toHaveBeenCalledOnce();
    expect((await chat.send.mock.results[0]!.value).xpGranted).toBe(0);
  });

  it('passes Game C the resolved recipient, exact message and durable command ID, then replays without another send', async () => {
    const { chat, services, send } = harness();
    const first = await send('!event Mot doux Autre "Bonjour exact !"');
    expect(first).toBe('Mot doux envoyé à Autre.');
    expect(services.eventService.searchGameCRecipients).toHaveBeenCalledWith(actor, { q: 'Autre', sort: 'name', direction: 'asc', page: 1 });
    expect(services.eventService.sendGameC).toHaveBeenCalledExactlyOnceWith(actor, 'other', 'Bonjour exact !', commandId);
    chat.findGameResult.mockResolvedValue({ id: 'answer', content: first, messageType: 'GAME_RESULT' } as never);
    chat.findGameResults.mockResolvedValue([{ id: 'answer', content: first, messageType: 'GAME_RESULT' }] as never);
    expect(await send('!event Mot doux Autre "Bonjour exact !"')).toBe(first);
    expect(services.eventService.sendGameC).toHaveBeenCalledOnce();
    expect(chat.publishGameResult).toHaveBeenCalledOnce();
  });

  it('publishes a Game C business refusal without a second domain send', async () => {
    const { chat, services, send } = harness();
    services.eventService.sendGameC.mockRejectedValue(new BusinessError('EVENT_GAME_C_ALREADY_SENT', 'Message Event déjà envoyé aujourd’hui.'));
    expect(await send('!event Mot doux Autre "bonjour"')).toBe('Message Event déjà envoyé aujourd’hui.');
    expect(services.eventService.sendGameC).toHaveBeenCalledOnce();
    expect(chat.publishGameResult).toHaveBeenCalledOnce();
  });

  it('replays a published command without a second domain mutation', async () => {
    const { chat, services, send } = harness();
    expect(await send('!roue')).toContain('Roue du jour');
    chat.findGameResult.mockResolvedValue({ id: 'answer', content: 'Roue du jour : 160 primogems.', messageType: 'GAME_RESULT' } as never);
    chat.findGameResults.mockResolvedValue([{ id: 'answer', content: 'Roue du jour : 160 primogems.', messageType: 'GAME_RESULT' }] as never);
    expect(await send('!roue')).toContain('Roue du jour');
    expect(services.spinDailyWheelChat.execute).toHaveBeenCalledOnce();
    expect(chat.publishGameResult).toHaveBeenCalledOnce();
  });

  it('publishes a business rejection without mutating again', async () => {
    const { services, send } = harness();
    services.spinDailyWheelChat.execute.mockRejectedValue(new BusinessError('PLAYER_ELEMENT_REQUIRED', 'Un élément permanent est requis.'));
    expect(await send('!roue')).toBe('Un élément permanent est requis.');
    expect(services.spinDailyWheelChat.execute).toHaveBeenCalledOnce();
  });

  it('lists every persisted Pull result for x10 without inventing a reward', async () => {
    const { services, send } = harness();
    services.performGachaPullChat.execute.mockResolvedValue({ operation: { primogemCost: 1_600n }, results: Array.from({ length: 10 }, (_, index) => ({ character: { name: `Personnage${index + 1}` }, rarity: 4 })) } as never);
    const answer = await send('!pull 10');
    expect(answer).toContain('Personnage1');
    expect(answer).toContain('Personnage10');
    expect(answer).toContain('Coût : 1600 Primogemmes.');
    expect(services.performGachaPullChat.execute).toHaveBeenCalledWith(actor, 10, commandId);
  });

  it('reads the standalone Contest projection without requesting a mutation', async () => {
    const { chat, services, send } = harness();
    expect(await send('!concours')).toContain('participation du jour non utilisée');
    expect(services.contestService.getCurrent).toHaveBeenCalledExactlyOnceWith(actor);
    services.contestService.getCurrent.mockResolvedValue({ active: { status: 'LOBBY', participants: [{}, {}] }, theme: { label: 'Force' }, dailyUsed: true } as never);
    expect(await send('!concours')).toContain('2/4 participants');
    expect(chat.publishGameResult).toHaveBeenCalledTimes(2);
  });

  it.each([
    '!concours open A', '!concours rejoindre A', '!concours participant A', '!concours participer A',
    '!concours spectateur', '!concours quitter', '!concours pret', '!concours start', '!concours lancer',
    '!concours annuler', '!concours cancel', '!concours basique', '!concours basic', '!concours risque',
    '!concours risqué', '!concours risk', '!concours soutenir Autre', '!concours autre',
  ])('redirects %s to standalone without any Contest call', async command => {
    const { chat, services, send } = harness();
    expect(await send(command)).toBe('Le Concours se joue dans l’interface. Utilise !concours pour consulter son état.');
    expect(services.contestService.getCurrent).not.toHaveBeenCalled();
    expect(chat.publishGameResult).toHaveBeenCalledWith(commandId, 'Le Concours se joue dans l’interface. Utilise !concours pour consulter son état.');
  });

  it('accepts the Event theme name from the owner with French ligatures', async () => {
    const { services, send } = harness();
    const view = await services.eventService.getCurrent();
    services.eventService.getCurrent.mockResolvedValue({ ...view, gameC: { theme: { label: 'Vœu' } } } as never);
    expect(await send('!event voeu Autre "bonjour"')).toContain('Vœu envoyé');
    expect(services.eventService.sendGameC).toHaveBeenCalledWith(actor, 'other', 'bonjour', commandId);
  });

  it.each(['!combat boss non', '!combat auto encore', '!event Coffre 01234', '!event Mot doux Autre bonjour', '!ami ajouter', '!stella', '!element inconnu'])('publishes syntax for malformed %s', async command => {
    const { send } = harness();
    expect(await send(command)).toContain('Syntaxe :');
  });
});
