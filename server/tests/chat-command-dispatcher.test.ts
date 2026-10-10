import { describe, expect, expectTypeOf, it } from 'vitest';
import { type ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';
import { BusinessError } from '../src/application/errors.js';
import type { CurrentPlayerMissions } from '../src/application/missions/get-current-player-missions.js';

import { harness, commandId, actor } from './helpers/chat-command-harness.js';

describe('Chat command adapters', () => {
  it('publishes logical command parts and appends a Mission only when it fits intact', async () => {
    const { chat, send } = harness();
    chat.commandMissionCompletions.mockResolvedValueOnce(['Mission terminée.']);
    await send('!box');
    expect(chat.publishGameResult).toHaveBeenCalledWith(commandId, [expect.stringContaining('ta Box [alphabétique ↑]')]);
    expect((chat.publishGameResult.mock.calls[0]![1] as readonly string[])[0]).toMatch(/Mission terminée\.$/);
  });
  it.each(['!banniere', '!bannière', '!ban', '!BAN'])('renders %s from authoritative data without mutations', async command => {
    const { services, chat, send } = harness();
    const current = await services.getCurrentGacha.execute();
    const elements = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'];
    current.banner.featuredFiveStars = elements.slice(0, 4).map((elementKey, index) => ({ id: index === 0 ? 'five' : `five-${index}`, name: `Cinq ${index}`, elementKey }));
    current.banner.featuredFourStars = elements.slice(1).map((elementKey, index) => ({ id: `four-${index}`, name: `Quatre ${index}`, elementKey }));
    const before = structuredClone(current);
    const result = await send(command);
    expect(result).toBe('🎯 Bannières (28/09 → 04/10) | ⭐⭐⭐⭐⭐ 🔥 Cinq 0, 💧 Cinq 1, ❄️ Cinq 2, ⚡ Cinq 3 | ⭐⭐⭐⭐ 💧 Quatre 0, ❄️ Quatre 1, ⚡ Quatre 2, 🌪️ Quatre 3, ☄️ Quatre 4, 🌿 Quatre 5 | 5★ ciblé : 🔥 Cinq 0');
    expect(Array.from(result!).length).toBeLessThanOrEqual(500);
    expect(chat.publishGameResult).toHaveBeenCalledTimes(1);
    expect(services.getCurrentGacha.execute).toHaveBeenLastCalledWith(actor);
    expect(services.setGachaTarget.execute).not.toHaveBeenCalled();
    expect(services.performGachaPullChat.execute).not.toHaveBeenCalled();
    expect(services.bannerVotes.vote).not.toHaveBeenCalled();
    expect(chat.rememberCommandText).not.toHaveBeenCalled();
    expect(current).toEqual(before);
  });
  it.each([null, 'four', 'obsolete'])('instructs selection for missing or stale target %s', async target => {
    const { services, send } = harness();
    const current = await services.getCurrentGacha.execute();
    current.playerState.selectedBannerCharacterId = target as never;
    expect(await send('!banniere')).toBe('🎯 Bannières (28/09 → 04/10) | ⭐⭐⭐⭐⭐ 🔥 A | ⭐⭐⭐⭐ 💧 B | Utilise !select nom_du_perso pour choisir ton 5★ ciblé.');
    expect(services.setGachaTarget.execute).not.toHaveBeenCalled();
  });
  it.each([
    ['2026-03-22T23:00:00Z', '2026-03-29T22:00:00Z', '23/03 → 29/03'],
    ['2026-10-18T22:00:00Z', '2026-10-25T23:00:00Z', '19/10 → 25/10'],
    ['2026-12-27T23:00:00Z', '2027-01-03T23:00:00Z', '28/12 → 03/01'],
  ])('formats inclusive Paris dates through DST and year changes', async (start, end, period) => {
    const { services, send } = harness();
    const current = await services.getCurrentGacha.execute();
    current.banner.startsAt = new Date(start); current.banner.endsAt = new Date(end);
    expect(await send('!banniere')).toContain(`Bannières (${period})`);
  });
  it.each(['!banniere test', '!ban test', '!bannière test'])('keeps canonical syntax for %s', async command => {
    const { services, send } = harness();
    expect(await send(command)).toBe('Syntaxe : !banniere.');
    expect(services.getCurrentGacha.execute).not.toHaveBeenCalled();
  });
  it('shares banner alias and localizes only unavailable banner consultation', async () => {
    const { services, send } = harness();
    expect(await send('!banner')).toEqual(await send('!banniere'));
    services.getCurrentGacha.execute.mockRejectedValue(new BusinessError('GACHA_BANNER_UNAVAILABLE', 'No active Gacha banner is available.'));
    expect(await send('!ban')).toBe('⚠️ Aucune bannière n’est active pour le moment.');
    expect(await send('!select')).toBe('Action impossible pour le moment.');
    expect(services.setGachaTarget.execute).not.toHaveBeenCalled();
  });
  it('reads Legends with exact normalized character names, self aliases, player names and no private leak', async () => {
    const { services, send } = harness();
    expect(await send('!legende')).toBe('🏆 Légendes de Moi : Étoile');
    expect(await send('!legende moi ETOILE')).toContain('Force 1');
    expect(await send('!legende me Etoile')).toContain('Concours 9, victoires 2');
    expect(await send('!legende Autre')).toBe('🏆 Légendes de Autre : Étoile');
    expect(await send('!legende @Autre Étoile')).toContain('Titre thème');
    expect(services.socialService.legends).toHaveBeenLastCalledWith(actor, 'other', true);
    expect(await send('!legende moi Éto')).toContain('Légende introuvable');
    services.socialService.legends.mockResolvedValueOnce({ access: 'PRIVATE' } as never);
    expect(await send('!legende Autre Étoile')).toBe('Les Légendes de ce joueur sont privées.');
  });
  it('includes current Mission completions in the immediate command response', async () => {
    const { chat, send } = harness();
    chat.commandMissionCompletions.mockResolvedValueOnce(['Mission terminée : Bavard du jour (+160 Primogemmes).']);
    expect(await send('!help')).toContain('Mission terminée : Bavard du jour (+160 Primogemmes).');
    expect(chat.commandMissionCompletions).toHaveBeenCalledWith(commandId);
  });
  it('routes !top aliases and personal summary through RankingService', async () => {
    const { services, send } = harness();
    expect(await send('!top xp')).toBe('XP : #1 Autre — 30.');
    expect(services.rankingService.chatTop).toHaveBeenCalledWith(expect.objectContaining({ id: 'xp' }), 'self');
    expect(await send('!top luck')).toBe('XP : #1 Autre — 30.');
    expect(services.rankingService.chatTop).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'rate5' }), 'self');
    await send('!top pity');
    expect(services.rankingService.chatTop).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'pity5', format: 'PITY5' }), 'self');
    expect(await send('!top me')).toBe('Top personnel — Moi : XP 30.');
    expect(await send('!top unknown')).toContain('Métrique inconnue');
    expect(await send('!top')).toContain('taux5');
  });
  it('resolves !infos by the same exact Player with or without a leading mention', async () => {
    const { services, send } = harness();
    const plain = await send('!infos Autre');
    expect(await send('!infos @Autre')).toBe(plain);
    expect(services.socialService.directory).toHaveBeenLastCalledWith(actor, { q: 'Autre', page: 1 });
    services.socialService.directory.mockResolvedValue({ players: [{ id: 'other', displayName: 'Éloïse' }], page: 1, totalPages: 1 });
    expect(await send('!infos   @ÉLOÏSE')).toBe(plain);
    expect(services.socialService.directory).toHaveBeenLastCalledWith(actor, { q: 'ÉLOÏSE', page: 1 });
    expect(await send('!infos @Inconnu')).toBe('Joueur introuvable.');
    expect(await send('!infos me')).toContain('Autre · niveau 5');
    expect(await send('!infos moi')).toContain('Autre · niveau 5');
  });
  it('normalizes Player references throughout friendship and trade commands', async () => {
    const { services, send } = harness();
    for (const [plain, mentioned] of [
      ['!ami ajouter Autre', '!ami ajouter @Autre'], ['!ami voir Autre', '!ami voir @Autre'],
      ['!ami coeur Autre', '!ami coeur @Autre'], ['!echanger Autre 3', '!echanger @Autre 3'],
      ['!echanger accepter Autre', '!echanger accepter @Autre'], ['!echanger annuler Autre', '!echanger annuler @Autre'],
    ] as const) expect(await send(mentioned)).toBe(await send(plain));
    expect(services.tradeService.eligibility).toHaveBeenCalledWith('self', 'Autre');
    expect(await send('!ami coeur all')).toContain('+💠5 Primos pour Moi');
    expect(services.socialService.friendship.sendHearts).toHaveBeenLastCalledWith('self', 'all', commandId, 'INTERNAL_CHAT');
    expect(await send('!ami coeur @all')).toBe(await send('!ami coeur all'));
    expect(await send('!echanger accepter')).toContain('1/1 acceptés');
    expect(await send('!echanger @Inconnu 3')).toBe('Joueur introuvable.');
  });
  it('normalizes only the Event recipient, preserving message text and non-Player tokens', async () => {
    const { services, send } = harness();
    expect(await send('!event Mot doux @Autre "@all est du texte"')).toBe(await send('!event Mot doux Autre "@all est du texte"'));
    expect(services.eventService.searchGameCRecipients).toHaveBeenLastCalledWith(actor, { q: 'Autre', sort: 'name', direction: 'asc', page: 1 });
    expect(services.eventService.sendGameC).toHaveBeenLastCalledWith(actor, 'other', '@all est du texte', commandId, 'INTERNAL_CHAT');
    expect(await send('!code @CODE')).toBe('⚠️ Ce code cadeau n’est pas disponible.');
    expect(services.giftCodeService.claim).not.toHaveBeenCalled();
    expect(await send('!stella @A')).toBe('Ce personnage ne fait pas partie de votre Box.');
  });
  it('keeps !infos compact and omits general statistics when access is private', async () => {
    const { services, send } = harness();
    expect(await send('!infos Autre')).toBe('ℹ️ Autre · niveau 5 · 🔥 Pyro · amitié niveau 3');
    services.socialService.profile.mockResolvedValue({
      player: { displayName: 'Autre', level: 5, elementKey: 'pyro' }, box: { access: 'PRIVATE' }, team: { access: 'PRIVATE' },
      statistics: { access: 'ALLOWED', data: { totalPulls: '20', combatWins: '5', totalPrimosEarned: '999999', fiveStarRate: '5.00' } },
    } as unknown as Awaited<ReturnType<typeof services.socialService.profile>>);
    expect(await send('!infos Autre')).toBe('ℹ️ Autre · niveau 5 · 🔥 Pyro · 20 Pulls, 5 victoires Combat · amitié niveau 3');
  });
  it('requires only the Contest read projection in its dependency contract', () => {
    expectTypeOf<keyof ChatCommandServices['contestService']>().toEqualTypeOf<'getCurrent'>();
  });

  it.each([
    ['!pity', 'pity : 5★ 9/90'], ['!banniere', 'Bannières'], ['!box', 'Box'], ['!team', 'Team Moi'],
    ['!sac', 'sac : 💠 160 primos'], ['!coffre', 'Coffre'], ['!shop', 'Shop'], ['!banque', 'Banque'],
    ['!infos Autre', 'Autre'], ['!liste pyro', 'Pyro'], ['!code', 'Codes disponibles'],
    ['!event', 'Festival'], ['!event top', 'Festival Top 10'], ['!expedition', 'Expédition'],
    ['!concours', 'Concours'], ['!combat', 'Combat du jour'], ['!combat boss', 'Boss'], ['!quotis', 'Quotidiennes'],
  ])('formats %s from the existing domain projection', async (command, expected) => {
    const { send } = harness();
    expect(await send(command)).toContain(expected);
  });

  it('passes the durable command message ID to mutation owners and publishes one public answer', async () => {
    const { chat, services, send } = harness();
    expect(await send('!pull 1')).toContain('Moi obtient ⭐⭐⭐⭐⭐');
    expect(services.performGachaPullChat.execute).toHaveBeenCalledWith(actor, 1, commandId);
    expect(await send('!shop primos max')).toContain('Boutique');
    expect(chat.rememberCommandQuantity).toHaveBeenCalledWith(commandId, 2n);
    expect(services.purchaseShopItemChat.execute).toHaveBeenCalledWith(actor, 'primos', 2n, commandId);
    expect(await send('!code CODE')).toContain('a utilisé CODE ! | 🎁 Code : 💠 +1 600 Primogemmes (1 800)');
    expect(services.giftCodeService.claim).toHaveBeenCalledWith(actor, 'edition', commandId, 'INTERNAL_CHAT');
    expect(chat.publishGameResult).toHaveBeenCalledTimes(3);
  });

  it('returns public syntax, unavailable and unknown feedback without calling a domain mutation', async () => {
    const { send, services } = harness();
    expect(await send('!pull 11')).toBe('Syntaxe : !pull [1..10].');
    expect(await send('!echanger')).toContain('Partenaires échangeables');
    expect(await send('!mission inconnu')).toBe('Syntaxe : !mission [B|A|S|Z|resume].');
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
    expect(await send('!code CODE')).toBe('⚠️ Moi, tu as déjà utilisé le code CODE.');
    expect(services.giftCodeService.claim).not.toHaveBeenCalled();
  });

  it('formats daily states as player-facing text', async () => {
    const { send } = harness();
    const output = await send('!quotis');
    for (const text of ['Récompense ⏳', 'Roue ⏳', 'Shop ⏳', 'Combat ⏳', 'Expédition ⏳', 'Amitié ⏳ · 1 cœur(s)', 'Event ⏳ · non inscrit']) expect(output).toContain(text);
  });

  it('formats mission summary, compatibility alias and canonical ranks without leaking locked Z', async () => {
    const { send } = harness();
    const summary = await send('!mission');
    expect(summary).not.toContain('Défi');
    expect(summary).toContain('B [1/9] · A [0/9] · S [0/9] · Z verrouillé');
    expect(await send('!mission resume')).not.toBe(summary);
    expect(await send('!mission b')).toMatch(/^🎯 Missions B : ▶ Mission B 2 1\/9/u);
    expect(await send('!mission Z')).toBe('Rang Z verrouillé : accessible après accomplissement de toutes les missions B, A et S.');
    expect(await send('!mission pseudo')).toBe('Syntaxe : !mission [B|A|S|Z|resume].');
  });

  it('formats active and completed Défi states plus unlocked Z counts', async () => {
    const active = harness();
    active.services.getDailyChallenge.execute.mockResolvedValue({ status: 'ACTIVE', challenge: { displayName: 'Invocations', progress: 2n, target: 5n } } as never);
    const unlocked = await active.services.getCurrentPlayerMissions.execute() as CurrentPlayerMissions;
    active.services.getCurrentPlayerMissions.execute.mockResolvedValue({ ...unlocked, z: { status: 'ACTIVE', unlockedAt: new Date(), missions: [
      { ...unlocked.ranks.B[0]!, externalKey: 'z1', rank: 'Z', status: 'COMPLETED' },
      { ...unlocked.ranks.B[1]!, externalKey: 'z2', rank: 'Z', status: 'ACTIVE' },
      { ...unlocked.ranks.B[2]!, externalKey: 'z3', rank: 'Z', status: 'LOCKED' },
      { ...unlocked.ranks.B[3]!, externalKey: 'z4', rank: 'Z', status: 'LOCKED' },
    ] } } as never);
    expect(await active.send('!mission')).not.toContain('Défi');
    expect(active.services.getDailyChallenge.execute).not.toHaveBeenCalled();
    expect(await active.send('!mission')).toContain('Z [1/4]');
    expect(await active.send('!mission Z')).toContain('Missions Z : ▶');

    const completed = harness();
    completed.services.getDailyChallenge.execute.mockResolvedValue({ status: 'COMPLETED', challenge: { displayName: 'Conversion', progress: 1n, target: 1n } } as never);
    const completeView = await completed.services.getCurrentPlayerMissions.execute() as CurrentPlayerMissions;
    completed.services.getCurrentPlayerMissions.execute.mockResolvedValue({ ...completeView, z: { status: 'COMPLETED', unlockedAt: new Date(), missions: [] } } as never);
    expect(await completed.send('!mission resume')).not.toContain('Défi');
    expect(completed.services.getDailyChallenge.execute).not.toHaveBeenCalled();
    expect(await completed.send('!mission')).toContain('Z [0/0]');
  });

  it('refreshes resources only when the personal projection applies R301', async () => {
    const { chat, services, send } = harness();
    const current = await services.getCurrentPlayerMissions.execute() as CurrentPlayerMissions;
    services.getCurrentPlayerMissions.execute.mockResolvedValue({ ...current, catchUpApplied: true } as never);
    await send('!mission A');
    expect(chat.rememberCommandRefreshScopes).toHaveBeenCalledWith(commandId, ['resources']);
  });

  it('publishes every Mission as logical bounded parts without truncation', async () => {
    const { chat, services, send } = harness();
    const current = await services.getCurrentPlayerMissions.execute() as CurrentPlayerMissions;
    services.getCurrentPlayerMissions.execute.mockResolvedValue({ ...current, ranks: { ...current.ranks, B: current.ranks.B.map((mission, index) => ({ ...mission, displayName: `Mission ${index + 1} ${'très-longue '.repeat(8)}` })) } } as never);
    await send('!mission B');
    const parts = chat.publishGameResult.mock.calls[0]![1] as readonly string[];
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every(part => Array.from(part).length <= 500)).toBe(true);
    for (let index = 1; index <= 9; index += 1) expect(parts.filter(part => part.includes(`Mission ${index} ${'très-longue '.repeat(8)}`))).toHaveLength(1);
    expect(parts.join(' ')).not.toContain('autres');
  });

  it('attributes Expedition start and claim commands to INTERNAL_CHAT', async () => {
    const start = harness();
    await start.send('!expedition A');
    expect(start.services.expeditionService.start).toHaveBeenCalledWith(expect.anything(), expect.any(String), expect.any(String), 'INTERNAL_CHAT');

    const claim = harness();
    claim.services.expeditionService.getState.mockResolvedValue({ operationalStatus: 'READY', activeCharacter: { name: 'A' } } as never);
    await claim.send('!expedition retour');
    expect(claim.services.expeditionService.claim).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'INTERNAL_CHAT');
  });

  it.each([
    ['!select A', 'setGachaTarget', 'execute'], ['!vote Candidat', 'bannerVotes', 'vote'],
    ['!stella A', 'useMasterlessStella', 'execute'], ['!roue', 'spinDailyWheelChat', 'execute'],
    ['!element pyro', 'choosePlayerElement', 'execute'], ['!ami retirer Autre', 'socialService', 'friendship'],
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
    '!select', '!vote', '!obtention A', '!passifs', '!ami', '!ami demandes', '!ami voir Autre', '!ami coeur Autre', '!ami coeur all',
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

  it('passes INTERNAL_CHAT through Event Shop conversion', async () => {
    const { services, send } = harness();
    await send('!event moras 3');
    expect(services.eventService.convertShop).toHaveBeenCalledWith(actor, 'MORAS', 3, commandId, 'INTERNAL_CHAT');
  });

  it('passes Game C the resolved recipient, exact message and durable command ID, then replays without another send', async () => {
    const { chat, services, send } = harness();
    const first = await send('!event Mot doux Autre "Bonjour exact !"');
    expect(first).toBe('✅ 💌 Moi envoie un mot doux à Autre ! Gain : +1 point(s) | +1 💖 Monnaies');
    expect(services.eventService.searchGameCRecipients).toHaveBeenCalledWith(actor, { q: 'Autre', sort: 'name', direction: 'asc', page: 1 });
    expect(services.eventService.sendGameC).toHaveBeenCalledExactlyOnceWith(actor, 'other', 'Bonjour exact !', commandId, 'INTERNAL_CHAT');
    chat.findGameResult.mockResolvedValue({ id: 'answer', content: first, messageType: 'GAME_RESULT' } as never);
    chat.findGameResults.mockResolvedValue([{ id: 'answer', content: first, messageType: 'GAME_RESULT' }] as never);
    expect(await send('!event Mot doux Autre "Bonjour exact !"')).toBe(first);
    expect(services.eventService.sendGameC).toHaveBeenCalledOnce();
    expect(chat.publishGameResult).toHaveBeenCalledOnce();
  });

  it('publishes a Game C business refusal without a second domain send', async () => {
    const { chat, services, send } = harness();
    services.eventService.sendGameC.mockRejectedValue(new BusinessError('EVENT_GAME_C_ALREADY_SENT', 'Message Event déjà envoyé aujourd’hui.'));
    expect(await send('!event Mot doux Autre "bonjour"')).toBe('⚠️ Moi, tu as déjà envoyé ton mot doux du jour. Reviens demain !');
    expect(services.eventService.sendGameC).toHaveBeenCalledOnce();
    expect(chat.publishGameResult).toHaveBeenCalledOnce();
  });

  it('replays a published command without a second domain mutation', async () => {
    const { chat, services, send } = harness();
    expect(await send('!roue')).toContain('La roue tourne pour');
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
    const { services, chat, send } = harness();
    services.performGachaPullChat.execute.mockResolvedValue({ operation: { primogemCost: 1_600n, pullCount: 10 }, results: Array.from({ length: 10 }, (_, index) => ({ index: index + 1, character: { name: `Personnage${index + 1}`, elementKey: 'hydro' }, rarity: 4, constellationAfter: 2, bonusRewards: [], passiveEffects: [] })) } as never);
    await send('!pull 10');
    const answer = (chat.publishGameResult.mock.calls[0]![1] as readonly string[]).join(' ');
    expect(answer).toContain('Personnage1');
    expect(answer).toContain('Personnage10');
    expect(chat.publishGameResult.mock.calls[0]![1]).toHaveLength(10);
    expect(services.performGachaPullChat.execute).toHaveBeenCalledWith(actor, 10, commandId);
  });

  it('publishes the same neutral Contest response regardless of current state without consulting its owner', async () => {
    const { chat, services, send } = harness();
    expect(await send('!concours')).toBe('🏆 Concours : prochainement disponible.');
    services.contestService.getCurrent.mockResolvedValue({ active: { status: 'LOBBY', participants: [{}, {}] }, theme: { label: 'Force' }, dailyUsed: true } as never);
    expect(await send('!concours')).toBe('🏆 Concours : prochainement disponible.');
    expect(services.contestService.getCurrent).not.toHaveBeenCalled();
    expect(chat.publishGameResult).toHaveBeenCalledTimes(2);
  });

  it.each([
    '!concours open A', '!concours rejoindre A', '!concours participant A', '!concours participer A',
    '!concours spectateur', '!concours quitter', '!concours pret', '!concours start', '!concours lancer',
    '!concours annuler', '!concours cancel', '!concours basique', '!concours basic', '!concours risque',
    '!concours risqué', '!concours risk', '!concours soutenir Autre', '!concours autre',
  ])('keeps %s neutral without any Contest call', async command => {
    const { chat, services, send } = harness();
    expect(await send(command)).toBe('🏆 Concours : prochainement disponible.');
    expect(services.contestService.getCurrent).not.toHaveBeenCalled();
    expect(chat.publishGameResult).toHaveBeenCalledWith(commandId, '🏆 Concours : prochainement disponible.');
  });

  it('accepts the Event theme name from the owner with French ligatures', async () => {
    const { services, send } = harness();
    const view = await services.eventService.getCurrent();
    services.eventService.getCurrent.mockResolvedValue({ ...view, festival: { ...view.festival, key: 'new-year' }, gameC: { ...view.gameC, theme: { label: 'Vœu' } } } as never);
    expect(await send('!event voeu Autre "bonjour"')).toContain('envoie un vœu du Nouvel An à Autre');
    expect(services.eventService.sendGameC).toHaveBeenCalledWith(actor, 'other', 'bonjour', commandId, 'INTERNAL_CHAT');
  });

  it.each(['!combat boss non', '!combat auto encore', '!ami ajouter', '!stella', '!element inconnu'])('publishes syntax for malformed %s', async command => {
    const { send } = harness();
    expect(await send(command)).toContain('Syntaxe :');
  });
});

describe('Favor consultation without domain mutations', () => {
  it.each([false, true])('formats self available/claimed = %s from the shared projection', async claimedToday => {
    const { services, send, chat } = harness();
    services.socialService.favor.mockResolvedValue({ access: 'ALLOWED', data: { active: true, daysRemaining: 180, maxDays: 180, dailyPrimogems: '800', claimedToday, claimStatus: claimedToday ? 'CLAIMED' : 'AVAILABLE' } } as never);
    expect(await send('!faveur')).toBe(`Faveur de l’Astre : 180 jours restants / 180 · +800 Primogemmes/jour · récompense du jour ${claimedToday ? 'reçue' : 'disponible'}.`);
    expect(services.socialService.favor).toHaveBeenCalledWith(actor, 'self');
    expect(services.socialService.profile).not.toHaveBeenCalled();
    expect(chat.rememberCommandRefreshScopes).not.toHaveBeenCalled();
  });
  it('returns self inactive and unknown player without loading a profile', async () => {
    const { send, services } = harness();
    expect(await send('!faveur')).toBe('Faveur de l’Astre : inactive.');
    expect(await send('!faveur introuvable')).toBe('Joueur introuvable.');
    expect(services.socialService.favor).toHaveBeenCalledOnce();
  });
  it.each(['Autre', '@Autre', 'Autre Joueur'])('uses the player reference and privacy projection for %s', async name => {
    const { send, services, chat } = harness();
    const displayName = name.replace('@', '');
    services.socialService.directory.mockResolvedValue({ players: [{ id: 'other', displayName }], page: 1, totalPages: 1 });
    services.socialService.favor.mockResolvedValue({ access: 'ALLOWED', data: { active: true, daysRemaining: 30, maxDays: 180, claimedToday: true } } as never);
    expect(await send('!faveur ' + name)).toBe(displayName + ' : Faveur active · 30 jours restants.');
    services.socialService.favor.mockResolvedValue({ access: 'ALLOWED', data: { active: false, daysRemaining: 0, maxDays: 180 } });
    expect(await send('!faveur ' + name)).toBe(displayName + ' : aucune Faveur active.');
    services.socialService.favor.mockResolvedValue({ access: 'PRIVATE' } as never);
    expect(await send('!faveur ' + name)).toBe('La Faveur de ' + displayName + ' est privée.');
    expect(services.socialService.profile).not.toHaveBeenCalled();
    expect(chat.rememberCommandRefreshScopes).not.toHaveBeenCalled();
  });
});
