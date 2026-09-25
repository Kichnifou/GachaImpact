import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { elementKeys } from '../../domain/economy/resources.js';
import { BusinessError } from '../errors.js';
import { AppError } from '../../api/errors.js';
import type { GetCharacters, GetCurrentGacha, PerformGachaPull, SetGachaTarget } from '../gacha/gacha-services.js';
import type { BannerVoteService } from '../gacha/banner-vote-service.js';
import type { GetCurrentPlayerBox, UseMasterlessStella } from '../box/box-services.js';
import type { GetCurrentPlayerTeams } from '../team/team-services.js';
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
import type { GetDailyChallenge } from '../daily-challenge/daily-challenge-services.js';
import type { GetCurrentPlayerMissions } from '../missions/get-current-player-missions.js';
import type { PermanentMissionProjection, PermanentMissionProjectionEntry } from '../missions/permanent-mission-service.js';
import type { ConvertPersonalParticles } from '../daily-challenge/daily-challenge-services.js';
import type { GetTodayWheelState } from '../wheel/get-today-wheel-state.js';
import type { SpinDailyWheel } from '../wheel/spin-daily-wheel.js';
import { SourceChannel } from '../../../generated/prisma/client.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import { playerReferenceName, samePlayerReference } from './player-reference.js';
import { findRanking, rankingRegistry, type RankingService } from '../ranking/ranking-service.js';
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
  useMasterlessStella: Pick<UseMasterlessStella, 'execute'>;
  getCurrentPlayerTeams: Pick<GetCurrentPlayerTeams, 'execute'>;
  getCurrentPlayerInventory: Pick<GetCurrentPlayerInventory, 'execute'>;
  getCurrentPlayerBank: Pick<GetCurrentPlayerBank, 'execute'>;
  depositPlayerBankChat: Pick<TransferPlayerBank, 'execute'>;
  withdrawPlayerBankChat: Pick<TransferPlayerBank, 'execute'>;
  getCurrentPlayerShop: Pick<GetCurrentPlayerShop, 'execute'>;
  purchaseShopItemChat: Pick<PurchaseShopItem, 'execute'>;
  socialService: Pick<SocialService, 'actor' | 'directory' | 'connected' | 'profile' | 'friends' | 'friendship'>;
  rankingService: Pick<RankingService, 'chatTop' | 'personal'>;
  tradeService: Pick<TradeService, 'create' | 'mutate' | 'all' | 'snapshot' | 'partners'>;
  tradePlayer: Pick<GetCurrentPlayer, 'execute'>;
  choosePlayerElement: Pick<ChoosePlayerElement, 'execute'>;
  dailyCombatService: Pick<CombatService, 'getDaily' | 'previewActiveTeam' | 'getElementMatrix' | 'fight'>;
  monthlyBossService: Pick<MonthlyBossService, 'getCurrentForChat' | 'attackWithActiveTeam'>;
  expeditionService: Pick<ExpeditionService, 'getState' | 'start' | 'claim'>;
  contestService: Pick<ContestService, 'getCurrent'>;
  eventService: Pick<EventService, 'getCurrent' | 'getRanking' | 'join' | 'attemptGameA' | 'attemptGameB' | 'searchGameCRecipients' | 'sendGameC' | 'claimCalendar' | 'convertShop' | 'purchaseCollection'>;
  giftCodeService: Pick<GiftCodeService, 'listForPlayer' | 'claim'>;
  getDailyChallenge: Pick<GetDailyChallenge, 'execute'>;
  getCurrentPlayerMissions: Pick<GetCurrentPlayerMissions, 'execute'>;
  getTodayWheelState: Pick<GetTodayWheelState, 'execute'>;
  spinDailyWheelChat: Pick<SpinDailyWheel, 'execute'>;
  convertPersonalParticlesChat: Pick<ConvertPersonalParticles, 'execute'>;
}>;

const syntax = (usage: string) => `Syntaxe : ${usage}.`;
const oneLine = (value: string) => value.replace(/[\r\n\u2028\u2029]/gu, ' ').trim();
const names = (values: readonly string[], limit = 8) =>
  `${values.slice(0, limit).join(', ') || 'aucun'}${values.length > limit ? `, et ${values.length - limit} autres` : ''}`;
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
  `Missions ${rank} : ${orderedMissions(missions).map(mission => `${missionState(mission)} ${mission.displayName} ${mission.progress}/${mission.target}`).join(' · ')}.`;
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
  const query = normalizePlayerSearch(raw);
  if (!query) return null;
  const exact = items.find(item => normalizePlayerSearch(item.name) === query);
  if (exact) return exact;
  const partial = items.filter(item => normalizePlayerSearch(item.name).includes(query));
  if (partial.length === 1) return partial[0]!;
  if (!fuzzy || partial.length > 1) return null;
  const scored = items.map(item => ({ item, distance: editDistance(query, normalizePlayerSearch(item.name)) }))
    .sort((a, b) => a.distance - b.distance);
  return scored[0] && scored[0].distance <= Math.min(3, Math.floor(query.length / 3)) && scored[1]?.distance !== scored[0].distance ? scored[0].item : null;
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
    const published = await this.chat.publishGameResult(sent.message.id, oneLine(response));
    return { ...sent, refreshScopes: await this.chat.commandRefreshScopes(sent.message.id), result: published.message, results: published.messages };
  }

  async clear(identity: AuthenticatedIdentity, content: string, idempotencyKey: string, replyToMessageId?: string | null) {
    if (replyToMessageId) throw new AppError('La commande !clear ne répond pas à un message.', 400, 'CHAT_INVALID');
    return this.chat.clear(identity, content, idempotencyKey);
  }

  private async resolve(identity: AuthenticatedIdentity, content: string, commandMessageId: string): Promise<string> {
    const [rawRoot = '', ...args] = content.slice(1).trim().split(/\s+/u);
    const definition = findChatCommand(rawRoot);
    if (!definition) return 'Commande inconnue. Utilise !help.';
    if (definition.internalChat === 'TWITCH_ONLY') return 'Cette commande est réservée à Twitch.';
    if (definition.internalChat === 'NOT_PHYSICAL') return 'Cette fonctionnalité n’est pas encore disponible.';
    if (!definition.handler) return 'Cette commande n’est pas encore disponible dans le Chat.';
    try {
      switch (definition.handler) {
        case 'top': {
          if (args.length > 1) return syntax(definition.syntax);
          if (!args.length) return `Classements : ${rankingRegistry.map(metric => metric.aliases[0]).join(', ')}. Utilise !top <metrique> ou !top me.`;
          const actor = await this.services.socialService.actor(identity);
          if (args[0]?.toLocaleLowerCase('fr-FR') === 'me') return this.services.rankingService.personal(actor.id);
          const metric = findRanking(args[0]!);
          return metric ? this.services.rankingService.chatTop(metric, actor.id) : 'Métrique inconnue. Utilise !top.';
        }
        case 'help': return args.length <= 1 ? chatHelp(args[0]) : syntax('!help [categorie|commande]');
        case 'element': {
          if (args.length !== 1 || !elementKeys.includes(args[0]!.toLocaleLowerCase('fr-FR') as typeof elementKeys[number])) return syntax(definition.syntax);
          const result = await this.services.choosePlayerElement.execute(identity, args[0]!.toLocaleLowerCase('fr-FR'));
          if (!result.alreadySelected) await this.chat.rememberCommandRefreshScopes(commandMessageId, ['player', 'resources', 'progression']);
          return `Élément permanent : ${result.elementKey}.`;
        }
        case 'pity': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const { playerState: p } = await this.services.getCurrentGacha.execute(identity);
          return `Pity 5★ : ${p.pity5}/90 · 4★ : ${p.pity4}/10 · Garantie 5★ : ${p.guaranteedFeatured5 ? 'oui' : 'non'} · Capture : ${p.captureProgress}/3.`;
        }
        case 'banniere': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const { banner, playerState } = await this.services.getCurrentGacha.execute(identity);
          const target = banner.featuredFiveStars.find(c => c.id === playerState.selectedBannerCharacterId)?.name ?? 'aucune';
          return `Bannière : 5★ ${names(banner.featuredFiveStars.map(c => c.name), 4)} · 4★ ${names(banner.featuredFourStars.map(c => c.name), 6)} · Cible : ${target}.`;
        }
        case 'select': {
          const { banner, playerState } = await this.services.getCurrentGacha.execute(identity);
          if (!args.length) {
            const current = banner.featuredFiveStars.find(character => character.id === playerState.selectedBannerCharacterId)?.name ?? 'aucune';
            return `Cible actuelle : ${current}. Choix : ${names(banner.featuredFiveStars.map(character => character.name), 4)}. ${definition.syntax}.`;
          }
          const character = named(banner.featuredFiveStars, args.join(' '));
          const characterId = await this.chat.rememberCommandText(commandMessageId, 'targetId', character?.id ?? '');
          if (!characterId) return `Personnage 5★ introuvable sur la bannière. ${definition.syntax}.`;
          await this.services.setGachaTarget.execute(identity, characterId, commandMessageId, SourceChannel.INTERNAL_CHAT);
          const name = character?.id === characterId ? character.name : (await this.services.getCharacters.execute()).find(entry => entry.id === characterId)?.name ?? args.join(' ');
          return `Cible 5★ sélectionnée : ${name}.`;
        }
        case 'vote': {
          const [vote, catalog] = await Promise.all([this.services.bannerVotes.getCurrent(identity), this.services.getCharacters.execute()]);
          const candidates = vote.candidates.flatMap(candidate => {
            const character = catalog.find(entry => entry.id === candidate.characterId);
            return character ? [{ ...candidate, name: character.name }] : [];
          });
          if (!args.length) return `Vote bannière : ${vote.ownVote ? 'déjà utilisé' : 'disponible'}. Candidats : ${names(candidates.map(candidate => `${candidate.name} (${candidate.voteCount})`), 6)}. ${definition.syntax}.`;
          const character = named(candidates, args.join(' '), true);
          const characterId = await this.chat.rememberCommandText(commandMessageId, 'targetId', character?.characterId ?? '');
          if (!characterId) return `Candidat de vote introuvable ou ambigu. ${definition.syntax}.`;
          const rotationId = await this.chat.rememberCommandText(commandMessageId, 'action', vote.bannerRotationId);
          const voted = await this.services.bannerVotes.vote(identity, characterId, rotationId, SourceChannel.INTERNAL_CHAT);
          if (!voted.alreadyProcessed) await this.chat.rememberCommandRefreshScopes(commandMessageId, ['bannerVotes']);
          return `Vote enregistré pour ${catalog.find(entry => entry.id === characterId)?.name ?? args.join(' ')}.`;
        }
        case 'pull': {
          if (args.length > 1 || args[0] && !/^(?:[1-9]|10)$/u.test(args[0])) return syntax(definition.syntax);
          const count = args[0] ? Number(args[0]) : 1;
          const result = await this.services.performGachaPullChat.execute(identity, count, commandMessageId);
          return `Invocation ×${count} : ${names(result.results.map(pull => pull.character ? `${pull.character.name} ${pull.rarity}★` : `${pull.resourceAmount} ${pull.resourceKey}`), 10)}. Coût : ${result.operation.primogemCost} Primogemmes.`;
        }
        case 'box': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const box = await this.services.getCurrentPlayerBox.execute(identity);
          return `Box : ${box.summary.totalOwned} personnages (${box.summary.fiveStars} 5★, ${box.summary.fourStars} 4★, ${box.summary.c6} C6). ${names(box.characters.map(c => `${c.name} C${c.constellation}`))}.`;
        }
        case 'obtention': {
          if (!args.length) return syntax(definition.syntax);
          const box = await this.services.getCurrentPlayerBox.execute(identity);
          const character = box.characters.find(entry => normalizePlayerSearch(entry.name) === normalizePlayerSearch(args.join(' ')));
          return character ? `${character.name} : première obtention le ${character.firstObtainedAt.toISOString().slice(0, 10)}.` : 'Ce personnage ne fait pas partie de votre Box.';
        }
        case 'stella': {
          if (!args.length) return syntax(definition.syntax);
          const box = await this.services.getCurrentPlayerBox.execute(identity);
          const character = box.characters.find(entry => normalizePlayerSearch(entry.name) === normalizePlayerSearch(args.join(' ')));
          const characterId = await this.chat.rememberCommandText(commandMessageId, 'targetId', character?.id ?? '');
          if (!characterId) return 'Ce personnage ne fait pas partie de votre Box.';
          const result = await this.services.useMasterlessStella.execute(identity, characterId, commandMessageId);
          return `Stella utilisée sur ${result.character.name} : C${result.character.constellation} · Stella restantes : ${result.stellaRemaining}.`;
        }
        case 'team': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const state = await this.services.getCurrentPlayerTeams.execute(identity);
          const active = state.teams.find(team => team.active);
          return active ? `Team ${active.position}${active.name ? ` « ${active.name} »` : ''} : ${names(active.slots.flatMap(slot => slot.character ? [slot.character.name] : []), 4)} (${active.slots.filter(slot => slot.character).length}/4).` : 'Aucune Team active.';
        }
        case 'passifs': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const state = await this.services.getCurrentPlayerTeams.execute(identity);
          const active = state.teams.find(team => team.active);
          return active ? `Passifs Team ${active.position} : ${names(active.passives.map(passive => `${passive.displayName} ×${passive.stacks} (${passive.description})`), 7)}.` : 'Aucune Team active.';
        }
        case 'roue': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const result = await this.services.spinDailyWheelChat.execute(identity, commandMessageId);
          return result.resultType === 'nothing' ? 'Roue du jour : aucun gain.' :
            `Roue du jour : ${result.amount} ${result.resourceKey}.`;
        }
        case 'sac': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const inventory = await this.services.getCurrentPlayerInventory.execute(identity);
          const primos = inventory.resources.find(r => r.key === 'primogems')?.amount ?? 0n;
          const moras = inventory.resources.find(r => r.key === 'moras')?.amount ?? 0n;
          const particles = inventory.resources.filter(r => r.elementKey && r.amount > 0n).map(r => `${r.displayName} ${r.amount}`);
          return `Sac : ${primos} Primogemmes (${primos / 160n} invocations), ${moras} Moras. Particules : ${names(particles, 7)}. Objets : ${inventory.items.filter(i => i.section === 'objects' && i.quantity > 0n).length}.`;
        }
        case 'coffre': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const inventory = await this.services.getCurrentPlayerInventory.execute(identity);
          const items = inventory.items.filter(i => i.section === 'collection' && i.quantity > 0n).sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'));
          return `Coffre : ${items.length} objets. ${names(items.map(i => `${i.displayName} ×${i.quantity}`))}.`;
        }
        case 'shop': {
          const action = args[0]?.toLocaleLowerCase('fr-FR');
          if (action === 'primos' || action === 'ticket') {
            if (action === 'ticket' && args.length !== 1 || action === 'primos' && (args.length !== 2 || args[1] !== 'max' && !/^[1-9]\d*$/u.test(args[1]!))) return syntax(definition.syntax);
            const view = await this.services.getCurrentPlayerShop.execute(identity);
            const item = view.items.find(entry => entry.externalKey === (action === 'primos' ? 'primogem-bundle' : 'reward-ticket'));
            if (!item || !item.available && !await this.chat.hasConfirmedCommandMutation(commandMessageId)) return 'Cet article Boutique est actuellement indisponible.';
            const quantity = action === 'ticket' ? 1n : args[1] === 'max'
              ? await this.chat.rememberCommandQuantity(commandMessageId, view.resources.moras / item.priceAmount) : BigInt(args[1]!);
            if (quantity < 1n) return 'Vous ne possédez pas assez de Moras dans votre portefeuille.';
            const result = await this.services.purchaseShopItemChat.execute(identity, item.id, quantity, commandMessageId);
            const effect = result.purchase.effect;
            const reward = effect.type === 'resource_bundle' ? `${effect.amount} ${effect.resourceKey}` : effect.type === 'ticket_pity5' ? `+${effect.grantedAmount} pity 5★` : `${effect.amount} ${effect.label}`;
            return `Boutique : ${result.purchase.quantity} × ${result.purchase.displayName} acheté pour ${result.purchase.totalPrice} Moras · ${reward}.`;
          }
          if (args.length > 1 || args[0] && !/^[1-9]\d*$/u.test(args[0])) return syntax(definition.syntax);
          const page = args[0] ? Number(args[0]) : 1;
          if (!Number.isSafeInteger(page)) return syntax(definition.syntax);
          const view = await this.services.getCurrentPlayerShop.execute(identity);
          const available = view.items.filter(item => item.available);
          const pages = Math.max(1, Math.ceil(available.length / 5));
          if (page > pages) return `Boutique : page ${page} indisponible (${pages} page${pages > 1 ? 's' : ''}).`;
          return `Boutique ${page}/${pages} : ${names(available.slice((page - 1) * 5, page * 5).map(item => `${item.displayName} (${item.priceAmount} Moras)`), 5)}.`;
        }
        case 'banque': {
          if (!args.length) {
            const bank = await this.services.getCurrentPlayerBank.execute(identity);
            return `🏦 Banque : ${bank.bankMoras} Moras · Portefeuille : ${bank.walletMoras} Moras · Intérêt estimé (3 %) : +${bank.estimatedInterest}. !banque deposer <montant|max> / !banque retirer <montant|max>.`;
          }
          if (args.length !== 2 || !['deposer', 'retirer'].includes(args[0]!.toLocaleLowerCase('fr-FR'))) return syntax(definition.syntax);
          const value = args[1]!.toLocaleLowerCase('fr-FR');
          if (value !== 'max' && !/^[1-9]\d*$/u.test(value)) return syntax(definition.syntax);
          const amount = value === 'max' ? 'max' as const : BigInt(value);
          const result = args[0]!.toLocaleLowerCase('fr-FR') === 'deposer'
            ? await this.services.depositPlayerBankChat.execute(identity, amount, commandMessageId)
            : await this.services.withdrawPlayerBankChat.execute(identity, amount, commandMessageId);
          return `Banque : ${result.bankMoras} Moras · Portefeuille : ${result.walletMoras} Moras.`;
        }
        case 'convertir': {
          if (args.length !== 1 || !/^[1-9]\d*$/u.test(args[0]!)) return syntax(definition.syntax);
          const amount = BigInt(args[0]!);
          const result = await this.services.convertPersonalParticlesChat.execute(identity, amount, commandMessageId);
          return `${amount} particules converties en ${amount} Primogemmes. Nouveau total : ${result.resources.primogems}.`;
        }
        case 'ami': {
          const actor = await this.services.socialService.actor(identity);
          const state = await this.services.socialService.friends(identity);
          const label = (id: string) => state.players.find(player => player.id === id)?.displayName ?? 'Joueur';
          const action = args[0]?.toLocaleLowerCase('fr-FR') ?? '';
          if (!action) return `Amis : ${state.summary.activeFriends} · cœurs disponibles : ${state.summary.available} · demandes : ${state.requests.length}. !ami liste / !ami demandes.`;
          if (action === 'liste' && args.length === 1) return `Amis : ${names(state.friends.map(friend => `${label(friend.playerId)} niveau ${friend.level}`))}.`;
          if (action === 'demandes' && args.length === 1) return `Demandes : ${names(state.requests.map(request => `${label(request.playerId)} (${request.direction === 'RECEIVED' ? 'reçue' : 'envoyée'})`))}.`;
          if (action === 'coeur') {
            const raw = args.slice(1).join(' ');
            if (!raw) return syntax(definition.syntax);
            const target = normalizePlayerSearch(raw) === 'all' ? 'all' : state.players.find(player => samePlayerReference(player.displayName, raw))?.id;
            const targetId = await this.chat.rememberCommandText(commandMessageId, 'targetId', target ?? '');
            if (!targetId) return 'Ami introuvable.';
            const result = await this.services.socialService.friendship.sendHearts(actor.id, targetId, commandMessageId, 'INTERNAL_CHAT');
            if (result.sent > 0) await this.chat.rememberCommandRefreshScopes(commandMessageId, ['social', 'resources', 'notifications']);
            return result.message ? `${result.message} Niveau ${result.level} · +5 Primogemmes chacun.` : `Cœurs : ${result.sent} envoyés, ${result.alreadySent} déjà faits, ${result.unavailable} indisponibles · +${result.senderReward} Primogemmes.`;
          }
          const mutation = { ajouter: 'ADD', accepter: 'ACCEPT', refuser: 'REFUSE', annuler: 'CANCEL', retirer: 'REMOVE' } as const;
          if (action in mutation) {
            const raw = args.slice(1).join(' ');
            if (!raw) return syntax(definition.syntax);
            const target = await this.player(identity, raw);
            const targetId = await this.chat.rememberCommandText(commandMessageId, 'targetId', target?.id ?? '');
            if (!targetId) return 'Joueur introuvable.';
            const result = await this.services.socialService.friendship.mutate(actor.id, targetId, mutation[action as keyof typeof mutation], commandMessageId, 'INTERNAL_CHAT');
            return `Amitié avec ${target?.displayName ?? raw} : ${statusLabel(result.state)}.`;
          }
          const raw = action === 'voir' ? args.slice(1).join(' ') : args.join(' ');
          if (!raw) return syntax(definition.syntax);
          const target = await this.player(identity, raw);
          if (!target) return 'Joueur introuvable.';
          const friend = state.friends.find(entry => entry.playerId === target.id);
          const request = state.requests.find(entry => entry.playerId === target.id);
          return friend ? `${target.displayName} : amitié niveau ${friend.level} (${friend.tier}) · cœur ${friend.heartSent ? 'déjà envoyé' : 'disponible'}.` :
            request ? `${target.displayName} : demande ${request.direction === 'RECEIVED' ? 'reçue' : 'envoyée'}.` : `${target.displayName} : aucune relation d’amitié.`;
        }
        case 'echanger': {
          const actor = await this.services.tradePlayer.execute(identity);
          const action = args[0]?.toLocaleLowerCase('fr-FR') ?? '';
          if (!args.length) {
            const partners = await this.services.tradeService.partners(actor.id);
            return `Partenaires échangeables : ${names(partners.partners.map(player => `${player.displayName} (max ${player.maximum})`))}.`;
          }
          if (action === 'liste' && args.length === 1) {
            const state = await this.services.tradeService.snapshot(actor.id);
            return `Échanges : reçus ${names(state.received.map(request => `${request.sender.displayName} (${request.currentAmount})`))} · envoyés ${names(state.sent.map(request => `${request.recipient.displayName} (${request.currentAmount})`))}.`;
          }
          if (action === 'accepter' && args.length === 1) {
            const result = await this.services.tradeService.all(actor.id, 'accept', commandMessageId, 'INTERNAL_CHAT');
            return `Échanges reçus : ${result.results.filter(entry => entry.state === 'ACCEPTED').length} acceptés sur ${result.results.length}.`;
          }
          if (action === 'accepter' || action === 'annuler') {
            const state = await this.services.tradeService.snapshot(actor.id);
            const requests = action === 'accepter' ? state.received : state.sent;
            const raw = args.slice(1).join(' ');
            const request = raw ? requests.find(entry => samePlayerReference(action === 'accepter' ? entry.sender.displayName : entry.recipient.displayName, raw)) : requests.length === 1 ? requests[0] : null;
            const requestId = await this.chat.rememberCommandText(commandMessageId, 'targetId', request?.id ?? '');
            if (!requestId) return raw ? 'Demande d’échange introuvable.' : syntax(definition.syntax);
            const result = await this.services.tradeService.mutate(actor.id, requestId, action === 'accepter' ? 'accept' : 'cancel', commandMessageId, 'INTERNAL_CHAT');
            return `Échange ${result.state === 'ACCEPTED' ? 'accepté' : result.state === 'CANCELLED' ? 'annulé' : 'indisponible'} : ${result.amount} particules.`;
          }
          const amountToken = args.at(-1)!;
          const hasAmount = args.length > 1 && /^[1-9]\d*$/u.test(amountToken);
          const explicitMax = args.length > 1 && amountToken.toLocaleLowerCase('fr-FR') === 'max';
          if (args.length > 1 && /^-?\d+$/u.test(amountToken) && !hasAmount) return syntax(definition.syntax);
          const name = hasAmount || explicitMax ? args.slice(0, -1).join(' ') : args.join(' ');
          const partners = await this.services.tradeService.partners(actor.id, playerReferenceName(name));
          const target = partners.partners.find(player => samePlayerReference(player.displayName, name));
          const targetId = await this.chat.rememberCommandText(commandMessageId, 'targetId', target?.id ?? '');
          if (!targetId) return 'Partenaire échangeable introuvable.';
          const result = await this.services.tradeService.create(actor.id, targetId, hasAmount ? BigInt(amountToken) : undefined, commandMessageId, 'INTERNAL_CHAT');
          return `Demande d’échange envoyée à ${target?.displayName ?? name} : ${result.amount} particules.`;
        }
        case 'infos': {
          const target = args.join(' ').trim();
          if (!target) return syntax(definition.syntax);
          const actor = await this.services.socialService.actor(identity);
          const self = ['me', 'moi'].includes(normalizePlayerSearch(target));
          const found = self ? actor : await this.player(identity, target);
          if (!found) return 'Joueur introuvable.';
          const [profile, friends] = await Promise.all([this.services.socialService.profile(identity, found.id), this.services.socialService.friends(identity)]);
          const pieces = [`${profile.player.displayName} · niveau ${profile.player.level} · ${profile.player.elementKey ?? 'élément inconnu'}`];
          if (profile.box.access === 'ALLOWED') pieces.push(`${profile.box.data.length} personnages`);
          if (profile.team.access === 'ALLOWED' && profile.team.data) pieces.push(`Team : ${names(profile.team.data.slots.flatMap(slot => slot.character ? [slot.character.name] : []), 4)}`);
          if (profile.statistics.access === 'ALLOWED') pieces.push(`${profile.statistics.data.totalPulls ?? '—'} Pulls, ${profile.statistics.data.combatWins ?? '—'} victoires Combat`);
          const friendship = friends.friends.find(friend => friend.playerId === found.id);
          if (friendship) pieces.push(`amitié niveau ${friendship.level}`);
          return pieces.join(' · ') + '.';
        }
        case 'liste': {
          if (args.length < 1 || args.length > 2 || args[1] && !/^[1-9]\d*$/u.test(args[1])) return syntax(definition.syntax);
          const page = args[1] ? Number(args[1]) : 1;
          if (!Number.isSafeInteger(page)) return syntax(definition.syntax);
          const key = args[0]!.toLocaleLowerCase('fr-FR');
          if (key === 'online') {
            const result = await this.services.socialService.connected(identity);
            const slice = result.players.slice((page - 1) * 20, page * 20);
            return `En ligne ${page}/${Math.max(1, Math.ceil(result.total / 20))} : ${names(slice.map(p => `${p.status === 'ONLINE' ? '🟢' : '🟡'} ${p.displayName}`))}.`;
          }
          if (!elementKeys.includes(key as typeof elementKeys[number])) return syntax(definition.syntax);
          const result = await this.services.socialService.directory(identity, { q: '', element: key, page });
          return `${key} ${result.page}/${result.totalPages} : ${names(result.players.map(p => p.displayName))}.`;
        }
        case 'code': {
          if (args.length > 1) return syntax(definition.syntax);
          const codes = await this.services.giftCodeService.listForPlayer(identity);
          if (!args.length) return `Codes disponibles : ${names(codes.available.map(code => code.token))}. Récupérés : ${codes.claimed.length}.`;
          const normalized = args[0]!.toUpperCase().replace(/\s+/gu, '-');
          const code = [...codes.available, ...codes.claimed].find(entry => entry.token.toUpperCase() === normalized);
          if (!code) return 'Ce code cadeau n’est pas disponible.';
          if (code.claimed && !await this.chat.hasConfirmedCommandMutation(commandMessageId)) return `Code ${code.token} déjà récupéré.`;
          await this.services.giftCodeService.claim(identity, code.editionId, commandMessageId, SourceChannel.INTERNAL_CHAT);
          return `Code ${code.token} récupéré : ${names(code.rewards.map(reward => `${reward.amount} ${reward.displayName}`), 5)}.`;
        }
        case 'event': {
          const action = normalizePlayerSearch(args[0] ?? '');
          if (action === 'top' && args.length === 1) {
            const ranking = await this.services.eventService.getRanking(identity);
            return `Festival Top 10 : ${names(ranking.entries.map(entry => `${entry.rank}. ${entry.displayName} ${entry.points} pts`), 10)}.`;
          }
          const event = await this.services.eventService.getCurrent(identity);
          if (action === 'go' && args.length === 1) {
            const joined = await this.services.eventService.join(identity, commandMessageId);
            return `${joined.festival.title} : inscription enregistrée · ${joined.currency.amount} ${joined.festival.currency.label}.`;
          }
          if (action === 'sac' && args.length === 1) return event.participation.joined
            ? `${event.festival.title} : ${event.participation.points} points · ${event.currency.amount} ${event.festival.currency.label} · Collection ${event.shop.collection.obtainedThisEdition ? 'obtenue' : 'à obtenir'}.`
            : `Inscrivez-vous au ${event.festival.title} avec !event go pour consulter votre sac.`;
          if (action === 'boutique' && args.length === 1) return `Boutique ${event.festival.title} : ${event.currency.amount} ${event.festival.currency.label} · 1 = ${event.shop.rates.primogems} Primogemmes ou ${event.shop.rates.moras} Moras · Collection ${event.shop.collection.cost}.`;
          if (['primos', 'moras'].includes(action)) {
            if (args.length !== 2 || args[1] !== 'max' && !/^[1-9]\d*$/u.test(args[1]!)) return syntax(definition.syntax);
            const amount = args[1] === 'max' ? await this.chat.rememberCommandQuantity(commandMessageId, BigInt(event.currency.amount)) : BigInt(args[1]!);
            if (amount < 1n || amount > BigInt(Number.MAX_SAFE_INTEGER)) return 'Quantité de monnaie Festival indisponible.';
            const result = await this.services.eventService.convertShop(identity, action === 'primos' ? 'PRIMOGEMS' : 'MORAS', Number(amount), commandMessageId);
            return `${event.festival.title} : ${amount} ${event.festival.currency.label} converties en ${amount * BigInt(action === 'primos' ? event.shop.rates.primogems : event.shop.rates.moras)} ${action === 'primos' ? 'Primogemmes' : 'Moras'} · solde ${result.currency.amount}.`;
          }
          if (action === 'collection' && args.length === 1) {
            const result = await this.services.eventService.purchaseCollection(identity, commandMessageId);
            return `${result.festival.title} : ${result.shop.collection.label} obtenue pour ${result.shop.collection.cost} ${result.festival.currency.label}.`;
          }
          if (action === 'calendrier' && args.length === 1) {
            const result = await this.services.eventService.claimCalendar(identity, commandMessageId);
            return `Calendrier ${result.festival.title} : jour ${result.calendarClaim.day}, +${result.calendarClaim.reward} ${result.festival.currency.label}.`;
          }
          const foldTheme = (value: string) => normalizePlayerSearch(value).replaceAll('œ', 'oe').replaceAll('æ', 'ae');
          const thematic = (label: string) => args.slice(0, label.split(/\s+/u).length).map(foldTheme).join(' ') === foldTheme(label);
          if ((thematic(event.gameA.theme.label) || thematic(event.gameA.theme.key)) && args.length === 1) {
            const result = await this.services.eventService.attemptGameA(identity, commandMessageId);
            return `${event.gameA.theme.label} : ${result.attempt.succeeded ? 'réussite' : 'essai sans gain'}.`;
          }
          if (thematic(event.gameB.theme.label)) {
            const offset = event.gameB.theme.label.split(/\s+/u).length;
            if (args.length !== offset + 1 || !/^[01]{5}$/u.test(args[offset]!)) return syntax(`!event ${event.gameB.theme.label} <code 5 bits>`);
            const result = await this.services.eventService.attemptGameB(identity, args[offset]!, commandMessageId);
            return `${event.gameB.theme.label} : ${result.attempt.kind === 'CORRECT' ? 'code trouvé' : result.attempt.kind === 'ALREADY_TESTED' ? 'code déjà testé' : 'code incorrect'}.`;
          }
          if (thematic(event.gameC.theme.label)) {
            const offset = event.gameC.theme.label.split(/\s+/u).length;
            const match = args.slice(offset).join(' ').match(/^(.+?)\s+"([^"\r\n]+)"$/u);
            if (!match) return syntax(`!event ${event.gameC.theme.label} <pseudo> "message"`);
            const recipientName = match[1]!.trim();
            let recipient: { playerId: string; displayName: string } | null = null;
            for (let page = 1; page <= 50; page += 1) {
              const search = await this.services.eventService.searchGameCRecipients(identity, { q: playerReferenceName(recipientName), sort: 'name', direction: 'asc', page });
              recipient = search.recipients.find(entry => samePlayerReference(entry.displayName, recipientName)) ?? null;
              if (recipient || page >= search.totalPages) break;
            }
            const recipientId = await this.chat.rememberCommandText(commandMessageId, 'targetId', recipient?.playerId ?? '');
            if (!recipientId) return 'Destinataire Event introuvable ou indisponible.';
            await this.services.eventService.sendGameC(identity, recipientId, match[2]!, commandMessageId);
            return `${event.gameC.theme.label} envoyé à ${recipient?.displayName ?? recipientName}.`;
          }
          if (args.length) return syntax(definition.syntax);
          return `${event.festival.emoji} ${event.festival.title} : ${event.participation.joined ? `${event.participation.points} points, ${event.currency.amount} ${event.festival.currency.label}` : 'inscription disponible'}. Jeux : ${event.gameA.theme.label}, ${event.gameB.theme.label}, ${event.gameC.theme.label}. !event top pour le classement.`;
        }
        case 'expedition': {
          const view = await this.services.expeditionService.getState(identity);
          if (args.length) {
            const target = args.join(' ');
            const branch = await this.chat.rememberCommandText(commandMessageId, 'action',
              normalizePlayerSearch(target) === 'retour' || view.operationalStatus === 'READY' && normalizePlayerSearch(view.activeCharacter?.name ?? '') === normalizePlayerSearch(target) ? 'claim' : 'start');
            if (branch === 'claim') {
              const result = await this.services.expeditionService.claim(identity, commandMessageId, SourceChannel.INTERNAL_CHAT);
              return `Expédition récupérée : ${result.reward.amount} ${result.reward.resourceKey}.`;
            }
            const box = await this.services.getCurrentPlayerBox.execute(identity);
            const character = box.characters.find(entry => normalizePlayerSearch(entry.name) === normalizePlayerSearch(target));
            const characterId = await this.chat.rememberCommandText(commandMessageId, 'targetId', character?.id ?? '');
            if (!characterId) return `Personnage introuvable dans votre Box. ${definition.syntax}.`;
            await this.services.expeditionService.start(identity, characterId, commandMessageId, SourceChannel.INTERNAL_CHAT);
            return `Expédition lancée avec ${character?.name ?? target}. Retour dans 20 heures.`;
          }
          return view.operationalStatus === 'IDLE' ? `Expédition : ${view.departureUsedToday ? 'départ utilisé aujourd’hui' : 'prête à partir'}.` :
            `Expédition : ${view.activeCharacter?.name ?? 'personnage'} · ${view.operationalStatus === 'READY' ? 'à récupérer' : `en cours, ${view.remainingSeconds} s restantes`}.`;
        }
        case 'concours': {
          if (args.length) return 'Le Concours se joue dans l’interface. Utilise !concours pour consulter son état.';
          const view = await this.services.contestService.getCurrent(identity);
          return view.active ? `Concours : ${statusLabel(view.active.status)} · ${view.active.participants.length}/4 participants · thème ${view.theme.label}. Participation dans Activités > Concours.` :
            `Concours : aucun en cours · thème ${view.theme.label}${view.dailyUsed ? ' · participation du jour utilisée' : ' · participation du jour non utilisée'}. Participation dans Activités > Concours.`;
        }
        case 'combat': {
          if (args.length > 2) return syntax(definition.syntax);
          const mode = args[0]?.toLocaleLowerCase('fr-FR') ?? '';
          if (mode === 'help' || mode === 'aide') return args.length === 1 ? `Combat : !combat, !combat info, !combat go, !combat auto, !combat elements, !combat stat, !combat boss, !combat boss go.` : syntax(definition.syntax);
          if (mode === 'boss') {
            if (args.length === 2 && args[1]?.toLocaleLowerCase('fr-FR') !== 'go') return syntax(definition.syntax);
            if (args.length === 2) {
              const result = await this.services.monthlyBossService.attackWithActiveTeam(identity, commandMessageId, SourceChannel.INTERNAL_CHAT);
              return `Boss ${result.view.boss.name} : ${result.result.damage} dégâts infligés${result.result.defeated ? ' · vaincu' : ''}.`;
            }
            const boss = await this.services.monthlyBossService.getCurrentForChat(identity);
            if (boss.status === 'DEFEATED') return `Boss ${boss.boss.name} vaincu au jour ${boss.defeatedSummary?.victoryDayCount ?? '—'} · ${boss.defeatedSummary?.daysRemainingAfterVictory ?? '—'} jours restants · ${boss.defeatedSummary?.community.participantCount ?? 0} participants · ${boss.defeatedSummary?.community.totalDamage ?? 0n} dégâts · votre contribution ${boss.participation?.totalDamage ?? 0n}${boss.defeatedSummary?.records.topContributor ? ` · meilleur contributeur ${boss.defeatedSummary.records.topContributor.displayName}` : ''}.`;
            return `Boss ${boss.boss.name} : ${boss.boss.currentHp}/${boss.boss.maxHp} PV · résistance ${boss.boss.resistanceElementKey} · attaque ${boss.attackState === 'AVAILABLE' ? 'disponible' : 'indisponible'}${boss.preview ? ` · dégâts prévus ${boss.preview.totalDamage}` : ''}.`;
          }
          if (args.length > 1 || mode && !['info', 'stat', 'stats', 'go', 'auto', 'elements'].includes(mode)) return syntax(definition.syntax);
          if (mode === 'info') {
            const preview = await this.services.dailyCombatService.previewActiveTeam(identity);
            return preview ? `Combat : Team active complète · chance ${preview.finalHalfPoints / 2}%.` : 'Combat : Team active incomplète, indisponible ou avec personnage KO.';
          }
          if (mode === 'go' || mode === 'auto') {
            const result = await this.services.dailyCombatService.fight(identity, commandMessageId, mode === 'go' ? 'ACTIVE_TEAM' : 'AUTO', SourceChannel.INTERNAL_CHAT);
            return `Combat ${mode === 'auto' ? 'auto' : 'manuel'} : ${result.result.won ? 'victoire' : 'défaite'} · chance ${result.result.chanceHalfPoints / 2}%${result.result.won ? ' · +800 Primogemmes et +20 000 Moras' : ''}.`;
          }
          if (mode === 'elements') {
            const matrix = await this.services.dailyCombatService.getElementMatrix();
            return `Combat · matrice (défenseur → faiblesse / résistance) : ${matrix.map(row => `${row.element} → ${row.weakAgainstElements.join(',') || 'aucune'} / ${row.resistantAgainstElements.join(',') || 'aucune'}`).join(' · ')}.`;
          }
          const combat = await this.services.dailyCombatService.getDaily(identity);
          if (mode === 'stat' || mode === 'stats') {
            const boss = await this.services.monthlyBossService.getCurrentForChat(identity);
            return `Combat : ${combat.playerStats.totalFights} combats, ${combat.playerStats.totalWins} victoires, ${combat.playerStats.totalManualWins} manuelles, ${combat.playerStats.totalLosses} défaites. Boss : ${boss.playerStats.totalDamage} dégâts, ${boss.playerStats.totalAttacks} attaques, ${boss.playerStats.totalParticipated} participations, ${boss.playerStats.totalRewarded} victoires, ${boss.playerStats.finalBlows} coups finaux, meilleur coup ${boss.playerStats.bestHit}.`;
          }
          const activePreview = combat.status === 'COMPLETED' ? null : await this.services.dailyCombatService.previewActiveTeam(identity);
          const actions = [activePreview ? '!combat go' : null, combat.status !== 'COMPLETED' && combat.availableCharacterCount >= 4 ? '!combat auto' : null].filter(Boolean);
          return `Combat du jour : ${statusLabel(combat.status)} · ennemis : ${names(combat.encounter.enemies.map(enemy => enemy.character.name), 4)} · ${actions.length ? `actions : ${actions.join(', ')}` : 'aucune tentative disponible'}.`;
        }
        case 'quotis': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const [wheel, challenge, combat, expedition] = await Promise.all([
            this.services.getTodayWheelState.execute(identity), this.services.getDailyChallenge.execute(identity),
            this.services.dailyCombatService.getDaily(identity), this.services.expeditionService.getState(identity),
          ]);
          return `Quotidiennes : Roue ${wheel.spun ? 'faite' : 'à faire'} · Défi ${statusLabel(challenge.status)} · Combat ${statusLabel(combat.status)} · Expédition ${statusLabel(expedition.operationalStatus)}.`;
        }
        case 'mission': {
          if (args.length > 1) return syntax(definition.syntax);
          const requested = args[0]?.toLocaleUpperCase('fr-FR');
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
      if (error instanceof BusinessError && !error.code.includes('IDEMPOTENCY')) return /^(No |A |The |Player |Could )/u.test(error.message) ? 'Action impossible pour le moment.' : oneLine(error.message);
      if (error instanceof AppError && !error.code.includes('IDEMPOTENCY')) return oneLine(error.message);
      throw error;
    }
  }
}
