import { vi } from 'vitest';
import { ChatCommandDispatcher, type ChatCommandServices } from '../../src/application/chat/chat-command-dispatcher.js';
import type { GlobalChatService } from '../../src/application/chat/global-chat-service.js';
export const commandId = '11111111-1111-4111-8111-111111111111';
export const actor = { subject: 'actor' };

export function harness() {
  const chat = {
    send: vi.fn(async (_identity: unknown, content: string) => ({ message: { id: commandId, messageType: 'COMMAND', content }, xpGranted: 0, replayed: false })),
    findGameResult: vi.fn(async () => null),
    findGameResults: vi.fn(async () => []),
    commandMissionCompletions: vi.fn(async () => [] as string[]),
    hasConfirmedCommandMutation: vi.fn(async () => false),
    commandRefreshScopes: vi.fn(async () => []),
    rememberCommandRefreshScopes: vi.fn(async () => undefined),
    publishGameResult: vi.fn(async (_id: string, content: string | readonly string[]) => {
      const messages = (typeof content === 'string' ? [content] : content).map((part, index) => ({ id: 'answer-' + index, content: part, messageType: 'GAME_RESULT' }));
      return { message: messages[0]!, messages, replayed: false };
    }),
    rememberCommandQuantity: vi.fn(async (_id: string, quantity: bigint) => quantity),
    rememberCommandText: vi.fn(async (_id: string, _field: string, value: string) => value),
  };
  const execute = <T>(value: T) => ({ execute: vi.fn(async () => value) });
  const eventView = {
    festival: { key: 'hearts', emoji: '🎊', title: 'Festival', currency: { label: 'Monnaies', emoji: '💖' } },
    edition: { endsAt: '2026-03-01T00:00:00Z' }, milestones: { thresholds: [{ points: 10, reached: false }] },
    dailyBonus: { claimedToday: false, canClaim: false }, canJoin: true, participation: { joined: false, points: 0 },
    currency: { amount: '3' }, shop: { rates: { primogems: 160, moras: 20000 }, collection: { label: 'Souvenir', cost: 80, obtainedThisEdition: false } },
    gameA: { theme: { key: 'feu', label: 'Feu' }, windows: [], completedToday: false, canAttempt: false, cooldownRemainingMs: 0 },
    gameB: { theme: { label: 'Coffre' }, solvedToday: false, attemptsRemaining: 3, canAttempt: false, remainingCodes: ['00000', '00001'], resolvedCode: null },
    gameC: { theme: { label: 'Mot doux' }, sentToday: false, canSend: false, unviewedCount: 0 },
  };
  const services = {
    getCurrentGacha: execute({ banner: { startsAt: new Date('2026-09-27T22:00:00Z'), endsAt: new Date('2026-10-04T22:00:00Z'), featuredFiveStars: [{ id: 'five', name: 'A', elementKey: 'pyro' }], featuredFourStars: [{ id: 'four', name: 'B', elementKey: 'hydro' }] }, playerState: { pity5: 9, pity4: 2, guaranteedFeatured5: true, captureProgress: 1, selectedBannerCharacterId: 'five' } }),
    getCharacters: execute([{ id: 'five', name: 'A' }, { id: 'candidate', name: 'Candidat' }]),
    setGachaTarget: execute({}),
    bannerVotes: { getCurrent: vi.fn(async () => ({ bannerRotationId: 'rotation', ownVote: null, candidates: [{ characterId: 'candidate', voteCount: 0 }] })), vote: vi.fn(async () => ({ candidates: [{ characterId: 'candidate', voteCount: 1 }] })) },
    performGachaPullChat: execute({ operation: { primogemCost: 160n, pullCount: 1 }, results: [{ index: 1, character: { name: 'A', elementKey: 'pyro' }, rarity: 5, wasNewCharacter: true, constellationAfter: 0, bonusRewards: [], passiveEffects: [] }] }),
    getCurrentPlayerBox: execute({ summary: { totalOwned: 1, fiveStars: 1, fourStars: 0, c6: 0 }, preference: { sortKey: 'alphabetical', direction: 'asc' }, characters: [{ id: 'five', name: 'A', constellation: 0, firstObtainedAt: new Date('2026-09-01'), rarity: 5, elementKey: 'pyro', favorite: false }] }),
    setBoxCharacterFavorite: execute({ name: 'A' }),
    setBoxSortPreference: execute({ sortKey: 'alphabetical', direction: 'desc' }),
    useMasterlessStella: execute({ character: { name: 'A', constellation: 1 }, stellaRemaining: 2n }),
    activatePlayerTeam: execute({}),
    getCurrentPlayerTeams: execute({ teams: [{ active: true, position: 1, name: null, slots: [{ character: { name: 'A', elementKey: 'pyro', constellation: 0 } }], passives: [{ elementKey: 'pyro', displayName: 'Pyro', stacks: 1, description: 'Bonus' }] }] }),
    getCurrentPlayerInventory: execute({ resources: [{ key: 'primogems', amount: 160n, elementKey: null }, { key: 'moras', amount: 50n, elementKey: null }], items: [{ section: 'collection', quantity: 1n, displayName: 'Objet' }] }),
    getCurrentPlayerBank: execute({ bankMoras: 100n, walletMoras: 50n, estimatedInterest: 3n }),
    depositPlayerBankChat: execute({ bankMoras: 150n, walletMoras: 0n, resolvedAmount: 50n }),
    withdrawPlayerBankChat: execute({ bankMoras: 50n, walletMoras: 100n, resolvedAmount: 50n }),
    convertPersonalParticlesChat: execute({ resources: { primogems: 180n } }),
    getCurrentPlayerShop: execute({ resources: { moras: 100_000n }, items: [{ id: 'primos', externalKey: 'primogem-bundle', rewardPerUnit: { amount: 160n, resourceKey: 'primogems' }, displayName: 'Lot de Primogemmes', priceAmount: 50_000n, available: true }, { id: 'ticket', externalKey: 'reward-ticket', displayName: 'Ticket', priceAmount: 150_000n, available: true }] }),
    purchaseShopItemChat: execute({ purchase: { quantity: 2n, displayName: 'Lot de Primogemmes', totalPrice: 100_000n, effect: { type: 'resource_bundle', amount: 320n, resourceKey: 'primogems' } } }),
    socialService: {
      legends: vi.fn(async () => ({ access: 'ALLOWED', data: { characters: [{ id: 'c6', name: 'Étoile' }], legends: [{ character: { name: 'Étoile' }, stats: { strength: 1, intelligence: 2, beauty: 3, charisma: 4, popularity: 5 }, totals: { contests: '9', wins: '2' }, themes: { STRENGTH: { title: 'Titre thème', wins: '2', participations: '9' } } }] } })),
      favor: vi.fn(async () => ({ access: 'ALLOWED', data: { active: false, daysRemaining: 0, maxDays: 180 } })),
      actor: vi.fn(async () => ({ id: 'self', displayName: 'Moi' })),
      directory: vi.fn(async () => ({ players: [{ id: 'other', displayName: 'Autre' }], page: 1, totalPages: 1 })),
      connected: vi.fn(async () => ({ players: [{ status: 'ONLINE', displayName: 'Autre' }], total: 1 })),
      profile: vi.fn(async () => ({ player: { displayName: 'Autre', level: 5, elementKey: 'pyro' }, box: { access: 'PRIVATE' }, team: { access: 'PRIVATE' }, statistics: { access: 'PRIVATE' } })),
      friends: vi.fn(async () => ({ friends: [{ playerId: 'other', level: 3, tier: 'Amitié Sincère', totalHearts: '2', heartSent: false }], players: [{ id: 'other', displayName: 'Autre' }], requests: [], summary: { activeFriends: 1, available: 1 } })),
      friendship: { mutate: vi.fn(async () => ({ state: 'ACTIVE' })), sendHearts: vi.fn(async () => ({ message: 'Moi envoie un cœur à Autre : leur amitié s’embellit doucement.', level: 3, sent: 1, alreadySent: 0, unavailable: 0, senderReward: '5', status: 'SENT' })) },
    },
    rankingService: { chatTop: vi.fn(async () => 'XP : #1 Autre — 30.'), personal: vi.fn(async () => 'Top personnel — Moi : XP 30.') },
    tradePlayer: execute({ id: 'self' }),
    tradeService: {
      eligibility: vi.fn(async (_id: string, name: string) => ({ player: name === 'Autre' ? { id: 'other', displayName: 'Autre' } : null, eligible: name === 'Autre', maximum: '5', reason: name === 'Autre' ? null : 'NOT_FOUND' })),
      partners: vi.fn(async (_id?: string, _q?: string, _page?: number) => ({ partners: [{ id: 'other', displayName: 'Autre', maximum: 5n }] })),
      snapshot: vi.fn(async () => ({ received: [{ id: 'request', sender: { displayName: 'Autre' }, currentAmount: 3n }], sent: [{ id: 'request', recipient: { displayName: 'Autre' }, currentAmount: 3n }] })),
      create: vi.fn(async () => ({ amount: 3n })), mutate: vi.fn(async () => ({ state: 'ACCEPTED', amount: 3n })),
      all: vi.fn(async () => ({ results: [{ state: 'ACCEPTED' }] })),
    },
    choosePlayerElement: execute({ elementKey: 'pyro' }),
    giftCodeService: { listForPlayer: vi.fn(async () => ({ available: [{ token: 'CODE', editionId: 'edition', rewards: [{ amount: '1600', displayName: 'Primogemmes', resourceKey: 'primogems' }] }], claimed: [{ token: 'OTHER', editionId: 'other', claimed: true }] })), claim: vi.fn(async () => ({ claimed: [], resources: { primogems: '1800', moras: '0', particles: {} }, operation: { alreadyProcessed: false } })) },
    eventService: {
      getCurrent: vi.fn(async () => eventView),
      getRanking: vi.fn(async () => ({ entries: [{ rank: 1, displayName: 'Autre', points: 10 }] })),
      join: vi.fn(async () => ({ ...eventView, creditedCurrency: 1, currency: { amount: '4' } })),
      attemptGameA: vi.fn(async () => ({ ...eventView, attempt: { succeeded: true, reward: { points: 1, currency: 1 } } })), attemptGameB: vi.fn(async () => ({ ...eventView, attempt: { kind: 'CORRECT', reward: { points: 1, currency: 1 } } })),
      searchGameCRecipients: vi.fn(async () => ({ recipients: [{ playerId: 'other', displayName: 'Autre' }], totalPages: 1 })), sendGameC: vi.fn(async () => ({ reward: { points: 1, currency: 1 } })),
      claimCalendar: vi.fn(async () => ({ ...eventView, calendarClaim: { day: 1, reward: 2 } })),
      convertShop: vi.fn(async () => ({ festival: { title: 'Festival', currency: { label: 'Monnaies', emoji: '💖' } }, currency: { amount: '2' }, conversion: { resourceKey: 'moras', amount: '60000' } })),
      purchaseCollection: vi.fn(async () => eventView),
    },
    expeditionService: { getState: vi.fn(async () => ({ operationalStatus: 'IDLE', departureUsedToday: false, canStartToday: true })), start: vi.fn(async () => ({ view: { departedAt: null, readyAt: null } })), claim: vi.fn(async () => ({ reward: { amount: 5n, resourceKey: 'primogems' }, resources: { primogems: 165n, moras: 50n, particles: {} } })) },
    contestService: { getCurrent: vi.fn(async () => ({ active: null, theme: { label: 'Force' }, dailyUsed: false })) },
    dailyCombatService: { getDaily: vi.fn(async () => ({ status: 'TODO', loadout: { slots: [] }, preview: null, playerStats: { totalFights: 0n, totalWins: 0n, totalManualWins: 0n, totalLosses: 0n }, encounter: { enemies: [{ character: { name: 'Ennemi', elementKey: 'cryo' }, weakAgainstElements: ['pyro'], resistantAgainstElements: ['hydro'] }] }, canFight: false })), previewActiveTeam: vi.fn(async () => ({ finalHalfPoints: 140 })), getElementMatrix: vi.fn(async () => [{ element: 'cryo', weakAgainstElements: ['pyro'], resistantAgainstElements: ['hydro'] }]), fight: vi.fn(async () => ({ result: { won: true, mode: 'ACTIVE_TEAM', chanceHalfPoints: 140, characters: [{ name: 'A', elementKey: 'pyro', constellation: 0 }] }, view: { reward: { primogems: 800n, moras: 20000n } } })) },
    monthlyBossService: { getCurrentForChat: vi.fn(async () => ({ boss: { id: 'boss', name: 'Boss', currentHp: 10n, maxHp: 20n, resistanceElementKey: 'pyro' }, status: 'ALIVE', attackState: 'AVAILABLE', availableCharacters: Array(4).fill({}), preview: null, playerStats: { totalDamage: 0n, totalAttacks: 0n, totalParticipated: 0n, totalRewarded: 0n, finalBlows: 0n, bestHit: 0n } })), attackWithActiveTeam: vi.fn(async () => ({ result: { damage: 5n, defeated: false, members: ['Yoimiya', 'Chiori', 'Yae Miko', 'Neuvillette'].map((name, index) => ({ characterNameSnapshot: name, elementKeySnapshot: ['pyro', 'geo', 'electro', 'hydro'][index]!, constellationSnapshot: index })) }, view: { boss: { name: 'Boss', currentHp: 5n, maxHp: 20n } } })) },
    getDailyChallenge: execute({ status: 'AVAILABLE', challenge: null, purchaseCost: 10000n }),
    getCurrentPlayerMissions: execute({
      catchUpApplied: false,
      ranks: {
        B: Array.from({ length: 9 }, (_, index) => ({ externalKey: `b${index}`, rank: 'B', displayName: `Mission B ${index + 1}`, description: '', progressLabel: '', progress: BigInt(index), target: 9n, status: index === 0 ? 'COMPLETED' : 'ACTIVE', rewardPrimogems: 160n, completedAt: null })),
        A: Array.from({ length: 9 }, (_, index) => ({ externalKey: `a${index}`, rank: 'A', displayName: `Mission A ${index + 1}`, description: '', progressLabel: '', progress: 0n, target: 20n, status: 'LOCKED', rewardPrimogems: 1600n, completedAt: null })),
        S: Array.from({ length: 9 }, (_, index) => ({ externalKey: `s${index}`, rank: 'S', displayName: `Mission S ${index + 1}`, description: '', progressLabel: '', progress: 0n, target: 30n, status: 'LOCKED', rewardPrimogems: 16000n, completedAt: null })),
      },
      z: { status: 'LOCKED' },
    }),
    getTodayDailyReward: execute({ claimed: false }),
    getTodayWheelState: execute({ spun: false }),
    spinDailyWheelChat: execute({ resultType: 'primogems', resourceKey: 'primogems', amount: 160n }),
  };
  const dispatcher = new ChatCommandDispatcher(chat as unknown as GlobalChatService, services as unknown as ChatCommandServices);
  const send = async (content: string) => (await dispatcher.send(actor, content, 'intent')).result?.content;
  return { chat, services, send };
}
