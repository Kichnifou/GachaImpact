import { resolvePlayerCommand, expeditionCommandSummary, playerCommandError } from './player-command-core.js';
import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { elementKeys } from '../../domain/economy/resources.js';
import { EVENT_GAME_B_MAX_ATTEMPTS } from '../../domain/event/game-b.js';
import { shopChatSummary } from './shop-command-summary.js';
import { tradeEligibilityText } from './trade-eligibility-result.js';
import { AppError } from '../../api/errors.js';
import type { GetCharacters, GetCurrentGacha, PerformGachaPull, SetGachaTarget } from '../gacha/gacha-services.js';
import type { BannerVoteService } from '../gacha/banner-vote-service.js';
import type { GetCurrentPlayerBox, UseMasterlessStella, SetBoxCharacterFavorite, SetBoxSortPreference } from '../box/box-services.js';
import type { GetCurrentPlayerTeams, ActivatePlayerTeam, RenamePlayerTeam, CreateNextPlayerTeam, SetPlayerTeamSlot, RemovePlayerTeamSlot, ClearPlayerTeam } from '../team/team-services.js';
import type { GetCurrentPlayerInventory } from '../inventory/inventory-services.js';
import type { GetCurrentPlayerBank, TransferPlayerBank } from '../banking/banking-services.js';
import type { GetCurrentPlayerShop, PurchaseShopItem } from '../shop/shop-services.js';
import type { SocialService } from '../social/social-service.js';
import type { TradeService } from '../trades/trade-service.js';
import type { GetCurrentPlayer } from '../player/get-current-player.js';
import type { ChoosePlayerElement } from '../player/choose-player-element.js';
import type { CombatService } from '../combat/daily-combat-service.js';
import type { MonthlyBossService } from '../combat/monthly-boss-service.js';
import type { ExpeditionService } from '../expedition/expedition-service.js';
import type { ContestService } from '../contest/contest-service.js';
import type { EventService } from '../event/event-service.js';
import type { GiftCodeService } from '../gift-code/gift-code-service.js';
import type { GetDailyChallenge, PurchaseDailyChallenge, SwitchDailyChallenge } from '../daily-challenge/daily-challenge-services.js';
import type { GetCurrentPlayerMissions } from '../missions/get-current-player-missions.js';
import type { PermanentMissionProjection, PermanentMissionProjectionEntry } from '../missions/permanent-mission-service.js';
import type { ConvertPersonalParticles } from '../daily-challenge/daily-challenge-services.js';
import type { GetTodayWheelState } from '../wheel/get-today-wheel-state.js';
import type { SpinDailyWheel } from '../wheel/spin-daily-wheel.js';
import type { GetTodayDailyReward } from '../daily-reward/get-today-daily-reward.js';
import { SourceChannel } from '../../../generated/prisma/client.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import { playerReferenceName, samePlayerReference } from './player-reference.js';
import { findRanking, rankingRegistry, type RankingService } from '../ranking/ranking-service.js';
import { boxCommand } from './box-command.js';
import { characterLabel, stellaChatResult } from './gacha-command-result.js';
import { entryParts } from './chat-command-format.js';
import { chatNumber, durationText } from './chat-command-format.js';
import { teamCommand } from './team-command.js';
import { bankCommand, codeCommand, coffreCommand } from './resource-commands.js';
import { chatElementEmojis } from './chat-list-result.js';
import { passifsCommand, sacCommand, resourceText } from './chat-command-format.js';
import { chatElementNames } from './chat-list-result.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { amiCommand } from './ami-command.js';
import { chatHelp, findChatCommand } from './chat-command-registry.js';
import type { GlobalChatService } from './global-chat-service.js';
import type { ChatMentionInput } from './global-chat-service.js';

export type ChatCommandServices = Readonly<{
  getCurrentGacha: Pick<GetCurrentGacha, 'execute'>;
  getCharacters: Pick<GetCharacters, 'execute'>;
  setGachaTarget: Pick<SetGachaTarget, 'execute'>;
  bannerVotes: Pick<BannerVoteService, 'getCurrent' | 'vote'>;
  performGachaPullChat: Pick<PerformGachaPull, 'execute'>;
  getCurrentPlayerBox: Pick<GetCurrentPlayerBox, 'execute'>;
  setBoxCharacterFavorite: Pick<SetBoxCharacterFavorite, 'execute'>;
  setBoxSortPreference: Pick<SetBoxSortPreference, 'execute'>;
  useMasterlessStella: Pick<UseMasterlessStella, 'execute'>;
  getCurrentPlayerTeams: Pick<GetCurrentPlayerTeams, 'execute'>;
  activatePlayerTeam: Pick<ActivatePlayerTeam, 'execute'>;
  renamePlayerTeam: Pick<RenamePlayerTeam, 'execute'>;
  createNextPlayerTeam: Pick<CreateNextPlayerTeam, 'execute'>;
  setPlayerTeamSlot: Pick<SetPlayerTeamSlot, 'execute'>;
  removePlayerTeamSlot: Pick<RemovePlayerTeamSlot, 'execute'>;
  clearPlayerTeam: Pick<ClearPlayerTeam, 'execute'>;
  getCurrentPlayerInventory: Pick<GetCurrentPlayerInventory, 'execute'>;
  getCurrentPlayerBank: Pick<GetCurrentPlayerBank, 'execute'>;
  depositPlayerBankChat: Pick<TransferPlayerBank, 'execute'>;
  withdrawPlayerBankChat: Pick<TransferPlayerBank, 'execute'>;
  getCurrentPlayerShop: Pick<GetCurrentPlayerShop, 'execute'>;
  purchaseShopItemChat: Pick<PurchaseShopItem, 'execute'>;
  socialService: Pick<SocialService, 'actor' | 'directory' | 'connected' | 'profile' | 'favor' | 'legends' | 'friends' | 'friendship'>;
  rankingService: Pick<RankingService, 'chatTop' | 'personal'>;
  tradeService: Pick<TradeService, 'create' | 'mutate' | 'all' | 'snapshot' | 'partners' | 'eligibility'>;
  tradePlayer: Pick<GetCurrentPlayer, 'execute'>;
  choosePlayerElement: Pick<ChoosePlayerElement, 'execute'>;
  dailyCombatService: Pick<CombatService, 'getDaily' | 'previewActiveTeam' | 'getElementMatrix' | 'fight'>;
  monthlyBossService: Pick<MonthlyBossService, 'getCurrentForChat' | 'attackWithActiveTeam'>;
  expeditionService: Pick<ExpeditionService, 'getState' | 'start' | 'claim'>;
  contestService: Pick<ContestService, 'getCurrent'>;
  eventService: Pick<EventService, 'getCurrent' | 'getRanking' | 'join' | 'attemptGameA' | 'attemptGameB' | 'searchGameCRecipients' | 'sendGameC' | 'claimCalendar' | 'convertShop' | 'purchaseCollection'>;
  giftCodeService: Pick<GiftCodeService, 'listForPlayer' | 'claim'>;
  getDailyChallenge: Pick<GetDailyChallenge, 'execute'>;
  purchaseDailyChallenge: Pick<PurchaseDailyChallenge, 'execute'>;
  switchDailyChallenge: Pick<SwitchDailyChallenge, 'execute'>;
  getCurrentPlayerMissions: Pick<GetCurrentPlayerMissions, 'execute'>;
  getTodayWheelState: Pick<GetTodayWheelState, 'execute'>;
  getTodayDailyReward: Pick<GetTodayDailyReward, 'execute'>;
  spinDailyWheelChat: Pick<SpinDailyWheel, 'execute'>;
  convertPersonalParticlesChat: Pick<ConvertPersonalParticles, 'execute'>;
}>;

const syntax = (usage: string) => `Syntaxe : ${usage}.`;
const oneLine = (value: string) => value.replace(/[\r\n\u2028\u2029]/gu, ' ').trim();
const names = (values: readonly string[], limit = 8, separator = ', ') =>
  `${values.slice(0, limit).join(separator) || 'aucun'}${values.length > limit ? `${separator}et ${values.length - limit} autres` : ''}`;
const noArgs = (args: readonly string[], usage: string) => args.length ? syntax(usage) : null;
const statusLabel = (status: string) => ({
  AVAILABLE: 'disponible', ACTIVE: 'en cours', COMPLETED: 'terminé',
  TODO: 'à faire', IN_PROGRESS: 'en cours', BLOCKED: 'bloqué',
  IDLE: 'à faire', RUNNING: 'en cours', READY: 'prêt', LOBBY: 'salon ouvert',
}[status] ?? status.toLocaleLowerCase('fr-FR'));
const orderedMissions = (missions: readonly PermanentMissionProjectionEntry[]) => [
  ...missions.filter(mission => mission.status !== 'COMPLETED'),
  ...missions.filter(mission => mission.status === 'COMPLETED'),
];
const missionState = (mission: PermanentMissionProjectionEntry) => mission.status === 'COMPLETED' ? '✅' : mission.status === 'ACTIVE' ? '▶' : '🔒';
const missionRankText = (rank: 'B' | 'A' | 'S' | 'Z', missions: readonly PermanentMissionProjectionEntry[]) =>
  entryParts(`🎯 Missions ${rank} :`, orderedMissions(missions).map(mission => `${missionState(mission)} ${mission.displayName} ${chatNumber(mission.progress)}/${chatNumber(mission.target)}`), `🎯 Missions ${rank} (suite) :`);
const completedCount = (missions: readonly PermanentMissionProjectionEntry[]) => missions.filter(mission => mission.status === 'COMPLETED').length;
const missionSummary = (view: PermanentMissionProjection) => {
  const z = view.z.status === 'LOCKED' ? 'verrouillé' : view.z.status === 'COMPLETED' ? 'terminé' : `${completedCount(view.z.missions)}/4 terminées`;
  return `Permanentes : B ${completedCount(view.ranks.B)}/9 terminées · A ${completedCount(view.ranks.A)}/9 · S ${completedCount(view.ranks.S)}/9 · Z ${z}`;
};
const dailyChallengeSummary = (challenge: Awaited<ReturnType<GetDailyChallenge['execute']>>) => {
  if (!challenge.challenge) return 'Défi : disponible, non attribué';
  if (challenge.status === 'COMPLETED') return `Défi : ${challenge.challenge.displayName} terminé`;
  return `Défi : ${challenge.challenge.displayName} ${challenge.challenge.progress}/${challenge.challenge.target}`;
};
const named = <T extends { name: string }>(items: readonly T[], raw: string, fuzzy = false): T | null => {
  const fold = (value: string) => fuzzy ? normalizePlayerSearch(value).replaceAll('œ', 'oe').replaceAll('æ', 'ae').replace(/[^a-z0-9]/gu, '') : normalizePlayerSearch(value);
  const query = fold(raw);
  if (!query) return null;
  const exact = items.find(item => fold(item.name) === query);
  if (exact) return exact;
  if (fuzzy) {
    const phrases = items.filter(item => query.includes(fold(item.name))).sort((a,b) => fold(b.name).length - fold(a.name).length);
    if (phrases[0] && fold(phrases[0].name).length !== (phrases[1] ? fold(phrases[1].name).length : -1)) return phrases[0];
  }
  const partial = items.filter(item => fold(item.name).includes(query));
  if (partial.length === 1) return partial[0]!;
  if (!fuzzy || partial.length > 1) return null;
  const scored = items.map(item => ({ item, distance: editDistance(query, fold(item.name)) }))
    .sort((a, b) => a.distance - b.distance);
  return scored[0] && scored[0].distance <= (query.length <= 4 ? 1 : query.length <= 8 ? 2 : 3) && scored[1]?.distance !== scored[0].distance ? scored[0].item : null;
};
const editDistance = (left: string, right: string): number => {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const next = [row];
    for (let column = 1; column <= right.length; column += 1) {
      next[column] = Math.min(next[column - 1]! + 1, previous[column]! + 1,
        previous[column - 1]! + Number(left[row - 1] !== right[column - 1]));
    }
    previous = next;
  }
  return previous[right.length]!;
};

/** Server-only: persist the player intent, execute through domain owners, publish public results. */
export class ChatCommandDispatcher {
  constructor(private readonly chat: GlobalChatService, private readonly services: ChatCommandServices) {}

  private async player(identity: AuthenticatedIdentity, name: string) {
    const query = playerReferenceName(name);
    for (let page = 1; ; page += 1) {
      const directory = await this.services.socialService.directory(identity, { q: query, page });
      const found = directory.players.find(entry => samePlayerReference(entry.displayName, name));
      if (found) return found;
      if (page >= directory.totalPages) return null;
    }
  }

  async send(identity: AuthenticatedIdentity, content: string, idempotencyKey: string, replyToMessageId?: string | null, mentions: readonly ChatMentionInput[] = []) {
    const sent = await this.chat.send(identity, content, idempotencyKey, replyToMessageId, mentions);
    if (sent.message.messageType !== 'COMMAND') return { ...sent, result: null, results: [] };
    const existing = await this.chat.findGameResult(sent.message.id);
    if (existing) return { ...sent, refreshScopes: await this.chat.commandRefreshScopes(sent.message.id), result: existing, results: await this.chat.findGameResults(sent.message.id) };
    const response = await this.resolve(identity, sent.message.content!, sent.message.id);
    const missions = await this.chat.commandMissionCompletions(sent.message.id);
    let resultContent: string | string[];
    if (typeof response === 'string') resultContent = oneLine([response, ...missions].join(' '));
    else {
      resultContent = response.map(oneLine);
      for (const mission of missions.map(oneLine)) {
        const last = resultContent.at(-1)!;
        if (Array.from(`${last} ${mission}`).length <= 500) resultContent[resultContent.length - 1] = `${last} ${mission}`;
        else resultContent.push(mission);
      }
    }
    const published = await this.chat.publishGameResult(sent.message.id, resultContent);
    return { ...sent, refreshScopes: await this.chat.commandRefreshScopes(sent.message.id), result: published.message, results: published.messages };
  }

  async clear(identity: AuthenticatedIdentity, content: string, idempotencyKey: string, replyToMessageId?: string | null) {
    if (replyToMessageId) throw new AppError('La commande !clear ne répond pas à un message.', 400, 'CHAT_INVALID');
    return this.chat.clear(identity, content, idempotencyKey);
  }

  private async resolve(identity: AuthenticatedIdentity, content: string, commandMessageId: string): Promise<string | readonly string[]> {
    const [rawRoot = '', ...args] = content.slice(1).trim().split(/\s+/u);
    const definition = findChatCommand(rawRoot);
    if (!definition) return 'Commande inconnue. Utilise !help.';
    if (definition.internalChat === 'TWITCH_ONLY') return 'Cette commande est réservée à Twitch.';
    if (definition.internalChat === 'NOT_PHYSICAL') return 'Cette fonctionnalité n’est pas encore disponible.';
    if (!definition.handler) return 'Cette commande n’est pas encore disponible dans le Chat.';
    try {
      switch (definition.handler) {
        case 'legende': {
          const actor = await this.services.socialService.actor(identity);
          let target: { id: string; displayName: string } | null = actor;
          let characterName = '';
          if (args.length && !['me', 'moi'].includes(args[0]!.toLocaleLowerCase('fr-FR'))) {
            target = null;
            for (let length = args.length; length > 0; length -= 1) {
              target = await this.player(identity, args.slice(0, length).join(' '));
              if (target) { characterName = args.slice(length).join(' '); break; }
            }
          } else characterName = args.slice(1).join(' ');
          if (!target) return 'Joueur introuvable.';
          const view = await this.services.socialService.legends(identity, target.id, Boolean(characterName));
          if (view.access === 'PRIVATE') return 'Les Légendes de ce joueur sont privées.';
          if (!characterName) return entryParts(`🏆 Légendes de ${target.displayName} :`, view.data.characters.map(character => characterLabel(character)), `🏆 Légendes de ${target.displayName} (suite) :`);
          const legend = view.data.legends.find(row => normalizePlayerSearch(row.character.name) === normalizePlayerSearch(characterName));
          if (!legend) return 'Légende introuvable parmi les personnages C6 accessibles.';
          const stats = legend.stats;
          return entryParts(`🏆 ${characterLabel(legend.character)} :`, [`Force ${stats.strength}, Intelligence ${stats.intelligence}, Beauté ${stats.beauty}, Charisme ${stats.charisma}, Popularité ${stats.popularity}`, `Concours ${legend.totals.contests}, victoires ${legend.totals.wins}`, ...Object.entries(legend.themes).map(([key, theme]) => `${({ strength: 'Force', intelligence: 'Intelligence', beauty: 'Beauté', charisma: 'Charisme', popularity: 'Popularité' } as Record<string, string>)[key.toLowerCase()] ?? 'Concours'} : ${theme.title ?? 'Sans titre'} (${theme.wins}/${theme.participations} victoires)`)], `🏆 ${legend.character.name} (suite) :`);
        }
        case 'top': {
          if (args.length > 1) return syntax(definition.syntax);
          if (!args.length) return `Classements : ${rankingRegistry.map(metric => metric.aliases[0]).join(', ')}. Utilise !top <metrique> ou !top me.`;
          const actor = await this.services.socialService.actor(identity);
          if (args[0]?.toLocaleLowerCase('fr-FR') === 'me') return this.services.rankingService.personal(actor.id);
          const metric = findRanking(args[0]!);
          return metric ? this.services.rankingService.chatTop(metric, actor.id) : 'Métrique inconnue. Utilise !top.';
        }
        case 'faveur': {
          const actor = await this.services.socialService.actor(identity);
          const target = args.length ? await this.player(identity, args.join(' ')) : actor;
          if (!target) return 'Joueur introuvable.';
          const view = await this.services.socialService.favor(identity, target.id);
          if (view.access === 'PRIVATE') return `La Faveur de ${target.displayName} est privée.`;
          const favor = view.data;
          if (target.id !== actor.id) return favor.active ? `${target.displayName} : Faveur active · ${favor.daysRemaining} jours restants.` : `${target.displayName} : aucune Faveur active.`;
          return favor.active ? `Faveur de l’Astre : ${favor.daysRemaining} jours restants / ${favor.maxDays} · +${favor.dailyPrimogems} Primogemmes/jour · récompense du jour ${favor.claimedToday ? 'reçue' : 'disponible'}.` : 'Faveur de l’Astre : inactive.';
        }
        case 'help': return args.length <= 1 ? chatHelp(args[0]) : syntax('!help [categorie|commande]');
        case 'element': {
          const element = normalizePlayerSearch(args[0] ?? '');
          if (args.length !== 1 || !isElementKey(element)) return syntax(definition.syntax);
          const actor = await this.services.socialService.actor(identity);
          if (actor.elementKey && actor.elementKey !== element) return `⚠️ ${actor.displayName}, tu as déjà choisi ton élément : ${isElementKey(actor.elementKey) ? chatElementEmojis[actor.elementKey] + ' ' + chatElementNames[actor.elementKey] : 'permanent'}.`;
          const result = await this.services.choosePlayerElement.execute(identity, element);
          if (!result.alreadySelected) await this.chat.rememberCommandRefreshScopes(commandMessageId, ['player', 'resources', 'progression']);
          return result.alreadySelected ? `⚠️ ${actor.displayName}, tu as déjà choisi ton élément : ${chatElementEmojis[element]} ${chatElementNames[element]}.`
            : `✅ ${actor.displayName} a choisi l’élément ${chatElementEmojis[element]} ${chatElementNames[element]}. Utilise !banniere pour voir les personnages disponibles.`;
        }
        case 'pity': return await resolvePlayerCommand(identity, 'pity', args, definition.syntax, commandMessageId, this.services, name => this.chat.rememberCommandText(commandMessageId, 'action', name));
        case 'banniere': return await resolvePlayerCommand(identity, 'banniere', args, definition.syntax, commandMessageId, this.services, name => this.chat.rememberCommandText(commandMessageId, 'action', name));
        case 'select': {
          const { banner, playerState } = await this.services.getCurrentGacha.execute(identity);
          if (!args.length) {
            const current = banner.featuredFiveStars.find(character => character.id === playerState.selectedBannerCharacterId)?.name ?? 'aucune';
            return `Cible actuelle : ${current}. Choix : ${names(banner.featuredFiveStars.map(character => character.name), 4)}. ${definition.syntax}.`;
          }
          const character = banner.featuredFiveStars.find(entry => normalizePlayerSearch(entry.name) === normalizePlayerSearch(args.join(' ')));
          const characterId = await this.chat.rememberCommandText(commandMessageId, 'targetId', character?.id ?? '');
          if (!characterId) return `Personnage 5★ introuvable sur la bannière. ${definition.syntax}.`;
          const disposition = await this.chat.rememberCommandText(commandMessageId, 'action', characterId === playerState.selectedBannerCharacterId ? 'already' : 'selected');
          await this.services.setGachaTarget.execute(identity, characterId, commandMessageId, SourceChannel.INTERNAL_CHAT);
          await this.chat.rememberCommandRefreshScopes(commandMessageId, ['gacha']);
          const name = character?.id === characterId ? character.name : (await this.services.getCharacters.execute()).find(entry => entry.id === characterId)?.name ?? args.join(' ');
          return disposition === 'already' ? `⚠️ ${name} est déjà ciblé.` : `✅ Cible 5★ sélectionnée : ${name}. Utilise !pull pour invoquer.`;
        }
        case 'vote': {
          const [vote, catalog] = await Promise.all([this.services.bannerVotes.getCurrent(identity), this.services.getCharacters.execute()]);
          const candidates = vote.candidates.flatMap(candidate => {
            const character = catalog.find(entry => entry.id === candidate.characterId);
            return character ? [{ ...candidate, name: character.name }] : [];
          });
          if (!args.length) {
            const ranked = candidates.filter(entry => entry.voteCount > 0).sort((a,b) => b.voteCount - a.voteCount || a.name.localeCompare(b.name, 'fr'));
            return ranked.length ? entryParts('🗳️ Votes bannière :', ranked.map(entry => `${entry.name} (${entry.voteCount} vote${entry.voteCount > 1 ? 's' : ''})`), '🗳️ Votes suite :') : '🗳️ Aucun vote enregistré pour cette semaine. Utilise !vote <nom du personnage 5★>.';
          }
          const character = named(candidates, args.join(' '), true);
          const characterId = await this.chat.rememberCommandText(commandMessageId, 'targetId', character?.characterId ?? '');
          const disposition = await this.chat.rememberCommandText(commandMessageId, 'action', JSON.stringify({ rotationId: vote.bannerRotationId, already: Boolean(vote.ownVote), name: character?.name ?? args.join(' ') }));
          const intent = disposition.startsWith('{') ? JSON.parse(disposition) as { rotationId: string; already: boolean; name?: string } : { rotationId: disposition, already: false };
          if (intent.already) return `⚠️ Ton vote est déjà utilisé pour ${catalog.find(entry => entry.id === vote.ownVote?.characterId)?.name ?? 'cette semaine'}.`;
          if (!characterId) return `Candidat de vote introuvable ou ambigu. ${definition.syntax}.`;
          await this.services.bannerVotes.vote(identity, characterId, intent.rotationId, SourceChannel.INTERNAL_CHAT);
          await this.chat.rememberCommandRefreshScopes(commandMessageId, ['bannerVotes']);
          return `✅ Vote enregistré pour ${intent.name ?? catalog.find(entry => entry.id === characterId)?.name ?? args.join(' ')}.`;
        }
        case 'pull': return await resolvePlayerCommand(identity, 'pull', args, definition.syntax, commandMessageId, this.services, name => this.chat.rememberCommandText(commandMessageId, 'action', name));
        case 'box': return await boxCommand(identity, args, commandMessageId, this.services, this.chat, syntax(definition.syntax));
        case 'obtention': {
          if (!args.length) return syntax(definition.syntax);
          const box = await this.services.getCurrentPlayerBox.execute(identity);
          const character = box.characters.find(entry => normalizePlayerSearch(entry.name) === normalizePlayerSearch(args.join(' ')));
          return character ? `📅 ${characterLabel(character)} : première obtention le ${character.firstObtainedAt.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.` : 'Ce personnage ne fait pas partie de votre Box.';
        }
        case 'stella': {
          if (!args.length) return syntax(definition.syntax);
          const box = await this.services.getCurrentPlayerBox.execute(identity);
          const character = box.characters.find(entry => normalizePlayerSearch(entry.name) === normalizePlayerSearch(args.join(' ')));
          const characterId = await this.chat.rememberCommandText(commandMessageId, 'targetId', character?.id ?? '');
          if (!characterId) return 'Ce personnage ne fait pas partie de votre Box.';
          const result = await this.services.useMasterlessStella.execute(identity, characterId, commandMessageId);
          const actor = await this.services.socialService.actor(identity);
          return stellaChatResult(actor.displayName, result);
        }
        case 'team': {
          if (!args.length) return await resolvePlayerCommand(identity, 'team', args, definition.syntax, commandMessageId, this.services);
          return teamCommand(identity, args, commandMessageId, this.services, this.chat, syntax(definition.syntax));
        }
        case 'passifs': {
          return passifsCommand(args, syntax(definition.syntax));
        }
        case 'roue': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const today = await this.services.getTodayWheelState.execute(identity);
          const action = await this.chat.rememberCommandText(commandMessageId, 'action', today.spun ? 'reminder' : 'spin');
          const result = await this.services.spinDailyWheelChat.execute(identity, commandMessageId);
          const reward = result.resultType === 'nothing' ? 'aucun gain' : resourceText(result.resourceKey!, result.amount!);
          return action === 'reminder' || result.alreadySpun && !result.alreadyProcessed ? `⚠️ Roue déjà utilisée aujourd’hui · résultat : ${reward}. Prochaine Roue demain.` : `🎡 Roue du jour : ${result.resultType === 'nothing' ? '' : '+'}${reward}.`;
        }
        case 'sac': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          return sacCommand(identity, this.services);
        }
        case 'coffre': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          return await coffreCommand(identity, this.services);
        }
        case 'shop': {
          const action = args[0]?.toLocaleLowerCase('fr-FR');
          if (action === 'mission' || action === 'switch') {
            if (args.length !== 1) return syntax(definition.syntax);
            const result = await (action === 'mission' ? this.services.purchaseDailyChallenge : this.services.switchDailyChallenge).execute(identity, commandMessageId, SourceChannel.INTERNAL_CHAT);
            const actor = await this.services.socialService.actor(identity);
            const challenge = result.view.challenge;
            await this.chat.rememberCommandRefreshScopes(commandMessageId, ['dailyChallenge', 'resources', 'shop']);
            return `✅ ${actor.displayName}, ${action === 'mission' ? 'Défi attribué' : 'nouveau Défi'} : ${challenge?.displayName ?? 'attribué'}${challenge ? ` (${challenge.progress}/${challenge.target}) · récompense ${resourceText('primogems', challenge.rewardPrimogems)}` : ''}${result.spentMoras !== undefined ? ` · coût ${resourceText('moras', result.spentMoras)}` : ''} · reste ${resourceText('moras', result.resources.moras)}${result.view.nextSwitchCost !== null ? ` · 🔄 prochain switch : ${resourceText('moras', result.view.nextSwitchCost)}` : ''}.`;
          }
          if (action === 'primos' || action === 'ticket') {
            const max = normalizePlayerSearch(args[1] ?? '') === 'max';
            if (action === 'ticket' && args.length !== 1 || action === 'primos' && (args.length !== 2 || !max && !/^[1-9]\d*$/u.test(args[1]!))) return syntax(definition.syntax);
            const view = await this.services.getCurrentPlayerShop.execute(identity);
            const item = view.items.find(entry => entry.externalKey === (action === 'primos' ? 'primogem-bundle' : 'reward-ticket'));
            const itemId = await this.chat.rememberCommandText(commandMessageId, 'targetId', item?.id ?? '');
            if (!itemId || !item?.available && !await this.chat.hasConfirmedCommandMutation(commandMessageId)) return 'Cet article Boutique est actuellement indisponible.';
            const quantity = action === 'ticket' ? 1n : max
              ? await this.chat.rememberCommandQuantity(commandMessageId, item ? view.resources.moras / item.priceAmount : 0n) : BigInt(args[1]!);
            if (quantity < 1n) return 'Vous ne possédez pas assez de Moras dans votre portefeuille.';
            const result = await this.services.purchaseShopItemChat.execute(identity, itemId, quantity, commandMessageId);
            const effect = result.purchase.effect;
            const reward = effect.type === 'ticket_pity5' ? `+${effect.grantedAmount} pity 5★ (${effect.pity5After}/90)` : resourceText(effect.resourceKey, effect.amount);
            return `🛒 Boutique : ${chatNumber(result.purchase.quantity)} × ${result.purchase.displayName} acheté pour ${resourceText('moras', result.purchase.totalPrice)} · ${reward}${result.walletMorasAfter !== undefined ? ' · reste ' + resourceText('moras', result.walletMorasAfter) : ''}.`;
          }
          if (args.length > 1 || args[0] && !/^[1-9]\d*$/u.test(args[0])) return syntax(definition.syntax);
          const page = args[0] ? Number(args[0]) : 1;
          if (!Number.isSafeInteger(page)) return syntax(definition.syntax);
          if (!args.length) return shopChatSummary(identity, this.services);
          const view = await this.services.getCurrentPlayerShop.execute(identity);
          const available = view.items;
          const pages = Math.max(1, Math.ceil(available.length / 5));
          if (page > pages) return `Boutique : page ${page} indisponible (${pages} page${pages > 1 ? 's' : ''}).`;
          return entryParts(`🛒 Boutique ${page}/${pages} :`, available.slice((page - 1) * 5, page * 5).map(item => `${item.displayName} (${resourceText('moras', item.priceAmount)})${item.available ? '' : ' · indisponible'}`), `🛒 Boutique ${page}/${pages} (suite) :`);
        }
        case 'banque': return await bankCommand(identity, args, commandMessageId, this.services, this.chat, syntax(definition.syntax));
        case 'convertir': {
          if (args.length !== 1 || !/^[1-9]\d*$/u.test(args[0]!)) return syntax(definition.syntax);
          const amount = BigInt(args[0]!);
          const result = await this.services.convertPersonalParticlesChat.execute(identity, amount, commandMessageId);
          const actor = await this.services.socialService.actor(identity);
          return `✅ ${actor.displayName} convertit ${isElementKey(actor.elementKey ?? '') ? resourceText('particles_' + actor.elementKey, amount) : amount + ' particules personnelles'} en ${resourceText('primogems', amount)} (${result.resources.primogems}).`;
        }
        case 'ami': return await amiCommand(identity, args, commandMessageId, this.services.socialService, this.chat,
          raw => this.player(identity, raw), (values, limit) => names(values, limit, ' · '), syntax(definition.syntax));
        case 'echanger': {
          const actor = await this.services.tradePlayer.execute(identity);
          const action = normalizePlayerSearch(args[0] ?? '');
          if (!args.length) {
            const partners = await this.services.tradeService.partners(actor.id);
            const entries = [...partners.partners];
            for (let page = 2; page <= partners.totalPages; page += 1) entries.push(...(await this.services.tradeService.partners(actor.id, '', page)).partners);
            return entryParts('🤝 Partenaires échangeables :', entries.map(player => `${player.displayName} (${chatNumber(BigInt(player.maximum))})`), '🤝 Partenaires échangeables (suite) :');
          }
          if (action === 'liste' && args.length === 1) {
            const state = await this.services.tradeService.snapshot(actor.id);
            return entryParts('🤝 Échanges :', [...(state.received.length ? state.received.map(request => `📥 ${request.sender.displayName} (${chatNumber(BigInt(request.currentAmount))})`) : ['📥 reçus : aucun']), ...(state.sent.length ? state.sent.map(request => `📤 ${request.recipient.displayName} (${chatNumber(BigInt(request.currentAmount))})`) : ['📤 envoyés : aucun'])], '🤝 Échanges (suite) :');
          }
          if (['accepter', 'annuler', 'refuser'].includes(action) && (args.length === 1 || args.length === 2 && ['all', 'tout', 'tous', '@all'].includes(normalizePlayerSearch(args[1]!)))) {
            const result = await this.services.tradeService.all(actor.id, action === 'accepter' ? 'accept' : action === 'annuler' ? 'cancel' : 'refuse', commandMessageId, 'INTERNAL_CHAT');
            const completed = result.results.filter(entry => entry.state !== 'UNAVAILABLE');
            return entryParts(`🤝 Échanges : ${completed.length}/${result.results.length} ${action === 'accepter' ? 'acceptés' : action === 'annuler' ? 'annulés' : 'refusés'}`, result.results.map(entry => `${entry.state === 'UNAVAILABLE' ? '⚠️ indisponible' : action === 'accepter' ? '✅ accepté' : action === 'annuler' ? 'annulé' : 'refusé'}${(action === 'annuler' ? entry.recipient : entry.sender)?.displayName ? ' · ' + (action === 'annuler' ? entry.recipient : entry.sender)!.displayName : ''}${entry.amount ? ' · ' + resourceText(entry.recipientResourceKey ?? '', entry.amount) : ''}`), '🤝 Échanges (suite) :');
          }
          if (['accepter', 'annuler', 'refuser'].includes(action)) {
            const state = await this.services.tradeService.snapshot(actor.id);
            const requests = action === 'annuler' ? state.sent : state.received;
            const raw = args.slice(1).join(' ');
            const request = raw ? requests.find(entry => samePlayerReference(action === 'annuler' ? entry.recipient.displayName : entry.sender.displayName, raw)) : requests.length === 1 ? requests[0] : null;
            const requestId = await this.chat.rememberCommandText(commandMessageId, 'targetId', request?.id ?? '');
            if (!requestId) return raw ? 'Demande d’échange introuvable.' : syntax(definition.syntax);
            const result = await this.services.tradeService.mutate(actor.id, requestId, action === 'accepter' ? 'accept' : action === 'annuler' ? 'cancel' : 'refuse', commandMessageId, 'INTERNAL_CHAT');
            return `🤝 Échange ${result.state === 'ACCEPTED' ? 'accepté' : result.state === 'CANCELLED' ? 'annulé' : result.state === 'REFUSED' ? 'refusé' : 'indisponible'}${(action === 'annuler' ? result.recipient : result.sender)?.displayName ? ' avec ' + (action === 'annuler' ? result.recipient : result.sender)!.displayName : ''} : ${resourceText(result.recipientResourceKey ?? '', result.amount)}.`;
          }
          const amountToken = args.at(-1)!;
          const hasAmount = args.length > 1 && /^[1-9]\d*$/u.test(amountToken);
          const explicitMax = args.length > 1 && amountToken.toLocaleLowerCase('fr-FR') === 'max';
          if (args.length > 1 && /^-?\d+$/u.test(amountToken) && !hasAmount) return syntax(definition.syntax);
          const name = hasAmount || explicitMax ? args.slice(0, -1).join(' ') : args.join(' ');
          const eligibility = await this.services.tradeService.eligibility(actor.id, playerReferenceName(name));
          const targetId = await this.chat.rememberCommandText(commandMessageId, 'targetId', eligibility.player?.id ?? '');
          if (!await this.chat.hasConfirmedCommandMutation(commandMessageId) && !eligibility.eligible) return tradeEligibilityText(eligibility);
          if (!targetId) return 'Joueur introuvable.';
          const result = await this.services.tradeService.create(actor.id, targetId, hasAmount ? BigInt(amountToken) : undefined, commandMessageId, 'INTERNAL_CHAT');
          return `Demande d’échange envoyée à ${result.recipient?.displayName ?? eligibility.player?.displayName ?? name} : ${resourceText(result.senderResourceKey ?? '', result.amount)} réservées contre ${resourceText(result.recipientResourceKey ?? '', result.amount)}.`;
        }
        case 'infos': {
          const target = args.join(' ').trim();
          if (!target) return syntax(definition.syntax);
          const actor = await this.services.socialService.actor(identity);
          const self = ['me', 'moi'].includes(normalizePlayerSearch(target));
          const found = self ? actor : await this.player(identity, target);
          if (!found) return 'Joueur introuvable.';
          const [profile, friends] = await Promise.all([this.services.socialService.profile(identity, found.id), this.services.socialService.friends(identity)]);
          const pieces = [`${profile.player.displayName} · niveau ${profile.player.level} · ${isElementKey(profile.player.elementKey ?? '') ? characterLabel({name: chatElementNames[profile.player.elementKey as typeof elementKeys[number]], elementKey: profile.player.elementKey!}) : 'élément non choisi'}`];
          if (profile.box.access === 'ALLOWED') pieces.push(`${profile.box.data.length} personnages`);
          if (profile.team.access === 'ALLOWED' && profile.team.data) pieces.push(...profile.team.data.slots.flatMap(slot => slot.character ? [`Team ${slot.position} : ${characterLabel(slot.character)}`] : []));
          if (profile.statistics.access === 'ALLOWED') pieces.push(`${profile.statistics.data.totalPulls ?? '—'} Pulls, ${profile.statistics.data.combatWins ?? '—'} victoires Combat`);
          const friendship = friends.friends.find(friend => friend.playerId === found.id);
          if (friendship) pieces.push(`amitié niveau ${friendship.level}`);
          return entryParts('ℹ️', pieces, 'ℹ️ Infos (suite) :', ' · ');
        }
        case 'liste': {
          if (args.length < 1 || args.length > 2 || args[1] && !/^[1-9]\d*$/u.test(args[1])) return syntax(definition.syntax);
          const page = args[1] ? Number(args[1]) : 1;
          if (!Number.isSafeInteger(page)) return syntax(definition.syntax);
          const key = normalizePlayerSearch(args[0]!);
          if (['element', 'elements'].includes(key) && args.length === 1) return 'Éléments : ' + elementKeys.map(element => '!liste ' + element).join(' | ');
          if (key === 'online') {
            const result = await this.services.socialService.connected(identity);
            const slice = result.players.slice((page - 1) * 20, page * 20);
            const pages = Math.max(1, Math.ceil(result.total / 20));
            if (page > pages) return `En ligne : page ${page} indisponible (${pages} pages).`;
            return entryParts(`En ligne ${page}/${pages} :`, slice.map(p => `${p.status === 'ONLINE' ? '🟢' : '🟡'} ${p.displayName}`), `En ligne ${page}/${pages} (suite) :`);
          }
          if (!elementKeys.includes(key as typeof elementKeys[number])) return syntax(definition.syntax);
          const result = await this.services.socialService.directory(identity, { q: '', element: key, page });
          return entryParts(`${chatElementEmojis[key as typeof elementKeys[number]]} ${chatElementNames[key as typeof elementKeys[number]]} ${result.page}/${result.totalPages} :`, result.players.map(p => p.displayName), `${chatElementNames[key as typeof elementKeys[number]]} ${result.page}/${result.totalPages} (suite) :`);
        }
        case 'code': return await codeCommand(identity, args, commandMessageId, this.services, this.chat, syntax(definition.syntax));
        case 'event': {
          const action = normalizePlayerSearch(args[0] ?? '');
          if (action === 'top' && args.length === 1) {
            const ranking = await this.services.eventService.getRanking(identity);
            return entryParts('🏆 Festival Top 10 :', ranking.entries.map(entry => `${entry.rank}. ${entry.displayName} ${chatNumber(entry.points)} pts`), '🏆 Festival Top 10 (suite) :');
          }
          const current = await this.services.eventService.getCurrent(identity);
          const context = args.length ? JSON.parse(await this.chat.rememberCommandText(commandMessageId, 'eventContext', JSON.stringify({ festival: current.festival, a: current.gameA.theme, b: current.gameB.theme, c: current.gameC.theme }))) as { festival: typeof current.festival; a: typeof current.gameA.theme; b: typeof current.gameB.theme; c: typeof current.gameC.theme } : null;
          const event = context ? { ...current, festival: context.festival, gameA: { ...current.gameA, theme: context.a }, gameB: { ...current.gameB, theme: context.b }, gameC: { ...current.gameC, theme: context.c } } : current;
          if (action === 'go' && args.length === 1) {
            const intent = await this.chat.rememberCommandText(commandMessageId, 'action', event.participation.joined ? 'alreadyJoined' : 'join');
            const joined = await this.services.eventService.join(identity, commandMessageId, SourceChannel.INTERNAL_CHAT);
            return `${intent === 'alreadyJoined' || joined.creditedCurrency === 0 ? '⚠️ Déjà inscrit' : '✅ Inscription enregistrée'} · ${joined.festival.title}${joined.creditedCurrency ? ' · +' + joined.creditedCurrency + ' ' + joined.festival.currency.emoji + ' ' + joined.festival.currency.label : ''} · solde ${joined.currency.amount} ${joined.festival.currency.label}.`;
          }
          if (action === 'sac' && args.length === 1) {
            if (!event.participation.joined) return `Inscrivez-vous au ${event.festival.title} avec !event go pour consulter votre sac.`;
            const ranking = await this.services.eventService.getRanking(identity);
            const next = event.milestones.thresholds.find(row => !row.reached);
            return entryParts(`🎒 ${event.festival.title} :`, [`${event.participation.points} points`, `${event.currency.amount} ${event.festival.currency.emoji} ${event.festival.currency.label}`, `Rang ${ranking.self?.rank ?? 'indisponible'}`, next ? `Prochain palier : ${next.points} points` : 'Tous les paliers atteints', `Collection ${event.shop.collection.obtainedThisEdition ? 'obtenue' : 'à obtenir'}`], `${event.festival.title} · sac (suite) :`);
          }
          if (['boutique', 'shop'].includes(action) && args.length === 1) return `Boutique ${event.festival.title} : ${event.currency.amount} ${event.festival.currency.emoji} ${event.festival.currency.label} · 1 = ${resourceText('primogems', event.shop.rates.primogems)} ou ${resourceText('moras', event.shop.rates.moras)} · Collection ${event.shop.collection.cost}.`;
          if (['primos', 'primo', 'primogems', 'moras', 'mora'].includes(action)) {
            const max = normalizePlayerSearch(args[1] ?? '') === 'max';
            if (args.length !== 2 || !max && !/^[1-9]\d*$/u.test(args[1]!)) return syntax(definition.syntax);
            const amount = max ? await this.chat.rememberCommandQuantity(commandMessageId, BigInt(event.currency.amount)) : BigInt(args[1]!);
            if (amount < 1n || amount > BigInt(Number.MAX_SAFE_INTEGER)) return 'Quantité de monnaie Festival indisponible.';
            const result = await this.services.eventService.convertShop(identity, ['moras', 'mora'].includes(action) ? 'MORAS' : 'PRIMOGEMS', Number(amount), commandMessageId, SourceChannel.INTERNAL_CHAT);
            return `✅ ${result.festival.title} : ${amount} ${result.festival.currency.emoji} ${result.festival.currency.label} converties en ${resourceText(result.conversion.resourceKey, result.conversion.amount)} · solde ${result.currency.amount}.`;
          }
          if (action === 'collection' && args.length === 1) {
            const result = await this.services.eventService.purchaseCollection(identity, commandMessageId, SourceChannel.INTERNAL_CHAT);
            return `${result.festival.title} : ${result.shop.collection.label} obtenue pour ${result.shop.collection.cost} ${result.festival.currency.label}.`;
          }
          if (action === 'calendrier' && args.length === 1) {
            const result = await this.services.eventService.claimCalendar(identity, commandMessageId, SourceChannel.INTERNAL_CHAT);
            return `Calendrier ${result.festival.title} : jour ${result.calendarClaim.day}, +${result.calendarClaim.reward} ${result.festival.currency.label}.`;
          }
          const foldTheme = (value: string) => normalizePlayerSearch(value).replaceAll('œ', 'oe').replaceAll('æ', 'ae');
          const thematic = (label: string) => args.slice(0, label.split(/\s+/u).length).map(foldTheme).join(' ') === foldTheme(label);
          const legacyC = ({ hearts: 'motdoux', flowers: 'motprintemps' } as Record<string, string>)[event.festival.key];
          if (thematic(event.gameA.theme.label) || thematic(event.gameA.theme.key)) {
            if (args.length !== event.gameA.theme.label.split(/\s+/u).length && !(action === foldTheme(event.gameA.theme.key) && args.length === 1)) return syntax(`!event ${event.gameA.theme.label}`);
            const result = await this.services.eventService.attemptGameA(identity, commandMessageId, SourceChannel.INTERNAL_CHAT);
            return `${event.gameA.theme.label} : ${result.attempt.succeeded ? `✅ réussite · +${result.attempt.reward.points} point(s) et +${result.attempt.reward.currency} ${event.festival.currency.emoji} ${event.festival.currency.label}` : 'essai sans gain'}.`;
          }
          if (thematic(event.gameB.theme.label)) {
            const offset = event.gameB.theme.label.split(/\s+/u).length;
            if (args.length === offset) return entryParts(`${event.gameB.theme.label} : ${event.gameB.solvedToday ? 'code découvert' : event.gameB.attemptsRemaining + ' essai(s) restant(s)'} · !event ${event.gameB.theme.label} <code 5 bits>`, event.gameB.solvedToday ? [`Code : ${event.gameB.resolvedCode}`] : event.gameB.remainingCodes, `${event.gameB.theme.label} · codes encore possibles :`, ', ');
            if (args.length !== offset + 1 || !/^[01]{5}$/u.test(args[offset]!)) return syntax(`!event ${event.gameB.theme.label} <code 5 bits>`);
            const result = await this.services.eventService.attemptGameB(identity, args[offset]!, commandMessageId, SourceChannel.INTERNAL_CHAT);
            return `${event.gameB.theme.label} : ${result.attempt.kind === 'CORRECT' ? `✅ code trouvé · chaque participant inscrit reçoit +${result.attempt.reward.points} point(s) et +${result.attempt.reward.currency} ${event.festival.currency.emoji} ${event.festival.currency.label}` : result.attempt.kind === 'ALREADY_TESTED' ? '⚠️ code déjà testé · aucun essai consommé' : 'code incorrect · aucun gain'}.`;
          }
          if (thematic(event.gameC.theme.label) || legacyC && action === legacyC) {
            const offset = legacyC && action === legacyC ? 1 : event.gameC.theme.label.split(/\s+/u).length;
            const match = args.slice(offset).join(' ').match(/^(.+?)\s+"([^"\r\n]+)"$/u);
            if (!match) return syntax(`!event ${event.gameC.theme.label} <pseudo> "message"`);
            const recipientName = match[1]!.trim();
            let recipient: { playerId: string; displayName: string } | null = null;
            for (let page = 1; ; page += 1) {
              const search = await this.services.eventService.searchGameCRecipients(identity, { q: playerReferenceName(recipientName), sort: 'name', direction: 'asc', page });
              recipient = search.recipients.find(entry => samePlayerReference(entry.displayName, recipientName)) ?? null;
              if (recipient || page >= search.totalPages) break;
            }
            const recipientId = await this.chat.rememberCommandText(commandMessageId, 'targetId', recipient?.playerId ?? '');
            if (!recipientId) return 'Destinataire Event introuvable ou indisponible.';
            const recipientLabel = await this.chat.rememberCommandText(commandMessageId, 'action', recipient?.displayName ?? recipientName);
            const result = await this.services.eventService.sendGameC(identity, recipientId, match[2]!, commandMessageId, SourceChannel.INTERNAL_CHAT);
            return `${event.gameC.theme.label} envoyé à ${recipientLabel} · +${result.reward.points} point(s) et +${result.reward.currency} ${event.festival.currency.emoji} ${event.festival.currency.label}.`;
          }
          if (args.length) return syntax(definition.syntax);
          const nextMilestone = event.milestones.thresholds.find(row => !row.reached);
          return entryParts(`${event.festival.emoji} ${event.festival.title} :`, [event.participation.joined ? `${event.participation.points} points · ${event.currency.amount} ${event.festival.currency.label}` : 'Rejoindre avec !event go', `Fin : ${new Date(event.edition.endsAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')}`, ...(event.participation.joined ? [nextMilestone ? `Prochain palier : ${nextMilestone.points} points` : 'Tous les paliers atteints', `${event.gameA.theme.label} ${event.gameA.completedToday ? '✅' : event.gameA.canAttempt ? '⏳' : '⏳ hors fenêtre ou en attente'}`, `${event.gameB.theme.label} : ${event.gameB.attemptsRemaining}/${EVENT_GAME_B_MAX_ATTEMPTS} essais restants`, `${event.gameC.theme.label} : ${event.gameC.sentToday ? 'envoyé ✅' : 'à envoyer'}`, `Bonus quotidien ${event.dailyBonus.claimedToday ? '✅' : 'à récupérer'}`] : []), `Jeux : !event ${event.gameA.theme.label} ; !event ${event.gameB.theme.label} <code> ; !event ${event.gameC.theme.label} <pseudo> "message"`, '!event boutique · !event top'], `${event.festival.title} (suite) :`);
        }
        case 'expedition': {
          const view = await this.services.expeditionService.getState(identity);
          if (args.length) {
            const target = args.join(' ');
            const branch = await this.chat.rememberCommandText(commandMessageId, 'action',
              normalizePlayerSearch(target) === 'retour' || view.operationalStatus === 'READY' && normalizePlayerSearch(view.activeCharacter?.name ?? '') === normalizePlayerSearch(target) ? 'claim' : 'start');
            if (branch === 'claim') {
              const result = await this.services.expeditionService.claim(identity, commandMessageId, SourceChannel.INTERNAL_CHAT);
              return `✅ Expédition récupérée : +${resourceText(result.reward.resourceKey, result.reward.amount)}.`;
            }
            if (!await this.chat.hasConfirmedCommandMutation(commandMessageId)) {
              if (view.operationalStatus === 'RUNNING') return `⚠️ Une expédition est déjà en cours avec ${view.activeCharacter?.name ?? 'personnage'} · retour dans ${durationText(view.remainingSeconds)}.`;
              if (view.operationalStatus === 'READY') return `⚠️ L’expédition de ${view.activeCharacter?.name ?? 'personnage'} est prête à être récupérée avec !expedition retour.`;
            }
            const box = await this.services.getCurrentPlayerBox.execute(identity);
            const character = box.characters.find(entry => normalizePlayerSearch(entry.name) === normalizePlayerSearch(target));
            const characterId = await this.chat.rememberCommandText(commandMessageId, 'targetId', character?.id ?? '');
            if (!characterId) return `Personnage introuvable dans votre Box. ${definition.syntax}.`;
            await this.services.expeditionService.start(identity, characterId, commandMessageId, SourceChannel.INTERNAL_CHAT);
            return `Expédition lancée avec ${character?.name ?? target}. Retour dans 20 heures.`;
          }
          return expeditionCommandSummary(view);
        }
        case 'concours': {
          if (args.length) return 'Le Concours se joue dans l’interface. Utilise !concours pour consulter son état.';
          const view = await this.services.contestService.getCurrent(identity);
          return view.active ? `Concours : ${statusLabel(view.active.status)} · ${view.active.participants.length}/4 participants · thème ${view.theme.label}. Participation dans Activités > Concours : https://gachaimpact.pages.dev/#activities/contest` :
            `Concours : aucun en cours · thème ${view.theme.label}${view.dailyUsed ? ' · participation du jour utilisée' : ' · participation du jour non utilisée'}. Participation dans Activités > Concours : https://gachaimpact.pages.dev/#activities/contest`;
        }
        case 'combat': {
          if (args.length > 2) return syntax(definition.syntax);
          const rawMode = normalizePlayerSearch(args[0] ?? '');
          const mode = ({ infos: 'info', element: 'elements', faiblesse: 'elements', faiblesses: 'elements' } as Record<string, string>)[rawMode] ?? rawMode;
          if (mode === 'help' || mode === 'aide') return args.length === 1 ? `Combat : !combat, !combat info, !combat go, !combat auto, !combat elements, !combat stat, !combat boss, !combat boss go.` : syntax(definition.syntax);
          if (mode === 'boss') {
            if (args.length === 2 && args[1]?.toLocaleLowerCase('fr-FR') !== 'go') return syntax(definition.syntax);
            if (args.length === 2) {
              const result = await this.services.monthlyBossService.attackWithActiveTeam(identity, commandMessageId, SourceChannel.INTERNAL_CHAT);
              return entryParts(`⚔️ Boss ${result.view.boss.name} :`, [`${chatNumber(result.result.damage)} dégâts infligés`, ...(result.result.defeated ? ['🏆 vaincu', `Récompense : +${resourceText('primogems', result.view.reward.primogems)} et +${resourceText('moras', result.view.reward.moras)}`] : [])], '⚔️ Boss (suite) :');
            }
            const boss = await this.services.monthlyBossService.getCurrentForChat(identity);
            if (boss.status === 'DEFEATED') {
              const summary = boss.defeatedSummary;
              return entryParts(`🏆 Boss ${boss.boss.name} · ${boss.boss.monthStart} :`, [`vaincu au jour ${summary?.victoryDayCount ?? '—'} · ${summary?.daysRemainingAfterVictory ?? '—'} jours restants`, `Résistance ${characterLabel({ name: chatElementNames[boss.boss.resistanceElementKey], elementKey: boss.boss.resistanceElementKey })}`, ...(boss.boss.defeatedAt ? [`Victoire le ${boss.boss.defeatedAt.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}`] : []), ...(summary ? [`${summary.community.participantCount} participants · ${chatNumber(summary.community.attackCount)} attaques · ${chatNumber(summary.community.totalDamage)} dégâts`, `Coup final : ${summary.records.finalBlow?.displayName ?? 'indisponible'}`] : []), ...(boss.participation ? [`Votre contribution : ${chatNumber(boss.participation.totalDamage)} dégâts · rang ${boss.participation.rank} · meilleur coup ${chatNumber(boss.participation.bestHit)}`] : ['Vous n’avez pas participé à ce Boss'])], '🏆 Boss vaincu (suite) :');
            }
            return `Boss ${boss.boss.name} : ${chatNumber(boss.boss.currentHp)}/${chatNumber(boss.boss.maxHp)} PV · résistance ${characterLabel({ name: chatElementNames[boss.boss.resistanceElementKey], elementKey: boss.boss.resistanceElementKey })} · attaque ${boss.attackState === 'AVAILABLE' ? 'disponible' : 'indisponible'}${boss.preview ? ` · dégâts prévus ${chatNumber(boss.preview.totalDamage)}` : ''}.`;
          }
          if (args.length > 1 && mode !== 'elements' || mode && !['info', 'stat', 'stats', 'go', 'auto', 'elements'].includes(mode)) return syntax(definition.syntax);
          if (mode === 'info') {
            const preview = await this.services.dailyCombatService.previewActiveTeam(identity);
            if (!preview) return 'Combat : Team active incomplète, indisponible ou avec personnage KO.';
            const teams = await this.services.getCurrentPlayerTeams.execute(identity);
            const active = teams.teams.find(team => team.active);
            return entryParts(`Combat : Team active · chance ${preview.finalHalfPoints / 2}%`, active?.slots.flatMap(slot => slot.character ? [characterLabel(slot.character)] : []) ?? [], 'Combat · Team active (suite) :');
          }
          if (mode === 'go' || mode === 'auto') {
            const result = await this.services.dailyCombatService.fight(identity, commandMessageId, mode === 'go' ? 'ACTIVE_TEAM' : 'AUTO', SourceChannel.INTERNAL_CHAT);
            return entryParts(`⚔️ Combat ${mode === 'auto' ? 'auto' : 'manuel'} :`, [`${result.result.won ? '🏆 victoire' : 'défaite · personnages utilisés KO pour le Combat du jour'} · chance ${result.result.chanceHalfPoints / 2}%`, ...(result.result.won ? [`+${resourceText('primogems', result.view.reward.primogems)} et +${resourceText('moras', result.view.reward.moras)}`] : [])], '⚔️ Combat (suite) :');
          }
          if (mode === 'elements') {
            const matrix = await this.services.dailyCombatService.getElementMatrix();
            const filter = normalizePlayerSearch(args[1] ?? '');
            if (filter && !isElementKey(filter)) return syntax('!combat elements [element]');
            const label = (key: typeof elementKeys[number]) => `${chatElementEmojis[key]} ${chatElementNames[key]}`;
            return entryParts('Combat · matrice (défenseur → faiblesse / résistance) :', matrix.filter(row => !filter || row.element === filter).map(row => `${label(row.element)} → ${row.weakAgainstElements.map(label).join(', ') || 'aucune'} / ${row.resistantAgainstElements.map(label).join(', ') || 'aucune'}`), 'Combat · matrice (suite) :');
          }
          const combat = await this.services.dailyCombatService.getDaily(identity);
          if (mode === 'stat' || mode === 'stats') {
            const boss = await this.services.monthlyBossService.getCurrentForChat(identity);
            const community = boss.publicSummary?.community;
            return entryParts('⚔️ Combat :', [`${chatNumber(combat.playerStats.totalFights)} combats · ${chatNumber(combat.playerStats.totalWins)} victoires · ${chatNumber(combat.playerStats.totalManualWins)} manuelles · ${chatNumber(combat.playerStats.totalLosses)} défaites`, `Boss : ${chatNumber(boss.playerStats.totalDamage)} dégâts · ${chatNumber(boss.playerStats.totalAttacks)} attaques`, `Boss : ${chatNumber(boss.playerStats.totalParticipated)} participations · ${chatNumber(boss.playerStats.totalRewarded)} victoires · ${chatNumber(boss.playerStats.finalBlows)} coups finaux · meilleur coup ${chatNumber(boss.playerStats.bestHit)}`, ...(community ? [`Boss actuel (public) : ${community.participantCount} participants · ${chatNumber(community.attackCount)} attaques · ${chatNumber(community.totalDamage)} dégâts`] : [])], '⚔️ Combat · statistiques (suite) :');
          }
          const activePreview = combat.status === 'COMPLETED' ? null : await this.services.dailyCombatService.previewActiveTeam(identity);
          const actions = [activePreview ? '!combat go' : null, combat.status !== 'COMPLETED' && combat.availableCharacterCount >= 4 ? '!combat auto' : null].filter(Boolean);
          return entryParts(`Combat du jour : ${statusLabel(combat.status)} · ${actions.length ? `actions : ${actions.join(', ')}` : 'aucune tentative disponible'} · ennemis :`, combat.encounter.enemies.map(enemy => characterLabel(enemy.character)), 'Combat du jour · ennemis (suite) :');
        }
        case 'quotis': return await resolvePlayerCommand(identity, 'quotis', args, definition.syntax, commandMessageId, this.services, name => this.chat.rememberCommandText(commandMessageId, 'action', name));
        case 'mission': {
          if (args.length > 1) return syntax(definition.syntax);
          const rawRank = normalizePlayerSearch(args[0] ?? '').toLocaleUpperCase('fr-FR');
          const requested = ['RECAP', 'RESUME'].includes(rawRank) ? 'RESUME' : rawRank || undefined;
          if (requested && !['B', 'A', 'S', 'Z', 'RESUME'].includes(requested)) return syntax(definition.syntax);
          const view = await this.services.getCurrentPlayerMissions.execute(identity);
          if (view.catchUpApplied) await this.chat.rememberCommandRefreshScopes(commandMessageId, ['resources']);
          if (!requested || requested === 'RESUME') {
            const challenge = await this.services.getDailyChallenge.execute(identity);
            return `${dailyChallengeSummary(challenge)} · ${missionSummary(view)}.`;
          }
          if (requested === 'Z') return view.z.status === 'LOCKED'
            ? 'Rang Z verrouillé : accessible après accomplissement de toutes les missions B, A et S.'
            : missionRankText('Z', view.z.missions);
          const rank = requested as 'B' | 'A' | 'S';
          return missionRankText(rank, view.ranks[rank]);
        }
        default: return 'Cette commande n’est pas encore disponible dans le Chat.';
      }
    } catch (error) {
      if (await this.chat.hasConfirmedCommandMutation(commandMessageId)) throw error;
      const text = playerCommandError(error, definition.handler);
      if (text !== undefined) return text;
      throw error;
    }
  }
}
