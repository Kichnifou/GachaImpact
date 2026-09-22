import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { elementKeys } from '../../domain/economy/resources.js';
import { BusinessError } from '../errors.js';
import { AppError } from '../../api/errors.js';
import type { GetCurrentGacha, PerformGachaPull } from '../gacha/gacha-services.js';
import type { GetCurrentPlayerBox } from '../box/box-services.js';
import type { GetCurrentPlayerTeams } from '../team/team-services.js';
import type { GetCurrentPlayerInventory } from '../inventory/inventory-services.js';
import type { GetCurrentPlayerBank, TransferPlayerBank } from '../banking/banking-services.js';
import type { GetCurrentPlayerShop, PurchaseShopItem } from '../shop/shop-services.js';
import type { SocialService } from '../social/social-service.js';
import type { CombatService } from '../combat/daily-combat-service.js';
import type { MonthlyBossService } from '../combat/monthly-boss-service.js';
import type { ExpeditionService } from '../expedition/expedition-service.js';
import type { ContestService } from '../contest/contest-service.js';
import type { EventService } from '../event/event-service.js';
import type { GiftCodeService } from '../gift-code/gift-code-service.js';
import type { GetDailyChallenge } from '../daily-challenge/daily-challenge-services.js';
import type { ConvertPersonalParticles } from '../daily-challenge/daily-challenge-services.js';
import type { GetTodayWheelState } from '../wheel/get-today-wheel-state.js';
import { SourceChannel } from '../../../generated/prisma/client.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import { chatHelp, findChatCommand } from './chat-command-registry.js';
import type { GlobalChatService } from './global-chat-service.js';

export type ChatCommandServices = Readonly<{
  getCurrentGacha: Pick<GetCurrentGacha, 'execute'>;
  performGachaPullChat: Pick<PerformGachaPull, 'execute'>;
  getCurrentPlayerBox: Pick<GetCurrentPlayerBox, 'execute'>;
  getCurrentPlayerTeams: Pick<GetCurrentPlayerTeams, 'execute'>;
  getCurrentPlayerInventory: Pick<GetCurrentPlayerInventory, 'execute'>;
  getCurrentPlayerBank: Pick<GetCurrentPlayerBank, 'execute'>;
  depositPlayerBankChat: Pick<TransferPlayerBank, 'execute'>;
  withdrawPlayerBankChat: Pick<TransferPlayerBank, 'execute'>;
  getCurrentPlayerShop: Pick<GetCurrentPlayerShop, 'execute'>;
  purchaseShopItemChat: Pick<PurchaseShopItem, 'execute'>;
  socialService: Pick<SocialService, 'actor' | 'directory' | 'connected' | 'profile' | 'friends'>;
  dailyCombatService: Pick<CombatService, 'getDaily'>;
  monthlyBossService: Pick<MonthlyBossService, 'getCurrent'>;
  expeditionService: Pick<ExpeditionService, 'getState'>;
  contestService: Pick<ContestService, 'getCurrent'>;
  eventService: Pick<EventService, 'getCurrent' | 'getRanking'>;
  giftCodeService: Pick<GiftCodeService, 'listForPlayer' | 'claim'>;
  getDailyChallenge: Pick<GetDailyChallenge, 'execute'>;
  getTodayWheelState: Pick<GetTodayWheelState, 'execute'>;
  convertPersonalParticlesChat: Pick<ConvertPersonalParticles, 'execute'>;
}>;

const syntax = (usage: string) => `Syntaxe : ${usage}.`;
const oneLine = (value: string) => {
  const characters = Array.from(value.replace(/[\r\n\u2028\u2029]/gu, ' ').trim());
  return characters.length <= 500 ? characters.join('') : `${characters.slice(0, 499).join('')}…`;
};
const names = (values: readonly string[], limit = 8) =>
  `${values.slice(0, limit).join(', ') || 'aucun'}${values.length > limit ? `, et ${values.length - limit} autres` : ''}`;
const noArgs = (args: readonly string[], usage: string) => args.length ? syntax(usage) : null;
const statusLabel = (status: string) => ({
  AVAILABLE: 'disponible', ACTIVE: 'en cours', COMPLETED: 'terminé',
  TODO: 'à faire', IN_PROGRESS: 'en cours', BLOCKED: 'bloqué',
  IDLE: 'à faire', RUNNING: 'en cours', READY: 'prêt', LOBBY: 'salon ouvert',
}[status] ?? status.toLocaleLowerCase('fr-FR'));

/** Server-only: persist the player intent, execute through domain owners, publish one public result. */
export class ChatCommandDispatcher {
  constructor(private readonly chat: GlobalChatService, private readonly services: ChatCommandServices) {}

  async send(identity: AuthenticatedIdentity, content: string, idempotencyKey: string) {
    const sent = await this.chat.send(identity, content, idempotencyKey);
    if (sent.message.messageType !== 'COMMAND') return { ...sent, result: null };
    const existing = await this.chat.findGameResult(sent.message.id);
    if (existing) return { ...sent, result: existing };
    const response = await this.resolve(identity, sent.message.content!, sent.message.id);
    const published = await this.chat.publishGameResult(sent.message.id, oneLine(response));
    return { ...sent, result: published.message };
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
        case 'help': return args.length <= 1 ? chatHelp(args[0]) : syntax('!help [categorie|commande]');
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
        case 'pull': {
          if (args.length > 1 || args[0] && !['1', '10'].includes(args[0])) return syntax(definition.syntax);
          const count = args[0] ? Number(args[0]) : 1;
          const result = await this.services.performGachaPullChat.execute(identity, count, commandMessageId);
          return `Invocation ×${count} : ${names(result.results.map(pull => pull.character ? `${pull.character.name} ${pull.rarity}★` : `${pull.resourceAmount} ${pull.resourceKey}`), 10)}. Coût : ${result.operation.primogemCost} Primogemmes.`;
        }
        case 'box': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const box = await this.services.getCurrentPlayerBox.execute(identity);
          return `Box : ${box.summary.totalOwned} personnages (${box.summary.fiveStars} 5★, ${box.summary.fourStars} 4★, ${box.summary.c6} C6). ${names(box.characters.map(c => `${c.name} C${c.constellation}`))}.`;
        }
        case 'team': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const state = await this.services.getCurrentPlayerTeams.execute(identity);
          const active = state.teams.find(team => team.active);
          return active ? `Team ${active.position}${active.name ? ` « ${active.name} »` : ''} : ${names(active.slots.flatMap(slot => slot.character ? [slot.character.name] : []), 4)} (${active.slots.filter(slot => slot.character).length}/4).` : 'Aucune Team active.';
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
        case 'infos': {
          const target = args.join(' ').trim();
          if (!target) return syntax(definition.syntax);
          const actor = await this.services.socialService.actor(identity);
          const self = ['me', 'moi'].includes(normalizePlayerSearch(target));
          const found = self ? actor : (await this.services.socialService.directory(identity, { q: target, page: 1 })).players.find(p => normalizePlayerSearch(p.displayName) === normalizePlayerSearch(target));
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
          if (args.length > 1 || args.length === 1 && args[0]!.toLocaleLowerCase('fr-FR') !== 'top') return syntax(definition.syntax);
          if (args.length) {
            const ranking = await this.services.eventService.getRanking(identity);
            return `Festival Top 10 : ${names(ranking.entries.map(entry => `${entry.rank}. ${entry.displayName} ${entry.points} pts`), 10)}.`;
          }
          const event = await this.services.eventService.getCurrent(identity);
          return `${event.festival.emoji} ${event.festival.title} : ${event.participation.joined ? `${event.participation.points} points, ${event.currency.amount} ${event.festival.currency.label}` : 'inscription disponible'}. !event top pour le classement.`;
        }
        case 'expedition': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const view = await this.services.expeditionService.getState(identity);
          return view.operationalStatus === 'IDLE' ? `Expédition : ${view.departureUsedToday ? 'départ utilisé aujourd’hui' : 'prête à partir'}.` :
            `Expédition : ${view.activeCharacter?.name ?? 'personnage'} · ${view.operationalStatus === 'READY' ? 'à récupérer' : `en cours, ${view.remainingSeconds} s restantes`}.`;
        }
        case 'concours': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const view = await this.services.contestService.getCurrent(identity);
          return view.active ? `Concours : ${statusLabel(view.active.status)} · ${view.active.participants.length}/4 participants · thème ${view.theme.label}.` :
            `Concours : aucun en cours · thème ${view.theme.label}${view.dailyUsed ? ' · participation du jour utilisée' : ''}.`;
        }
        case 'combat': {
          if (args.length > 1) return syntax(definition.syntax);
          const mode = args[0]?.toLocaleLowerCase('fr-FR') ?? '';
          if (mode === 'boss') {
            const boss = await this.services.monthlyBossService.getCurrent(identity);
            return `Boss ${boss.boss.name} : ${boss.boss.currentHp}/${boss.boss.maxHp} PV · résistance ${boss.boss.resistanceElementKey} · attaque ${boss.attackState === 'AVAILABLE' ? 'disponible' : 'indisponible'}${boss.preview ? ` · dégâts prévus ${boss.preview.totalDamage}` : ''}.`;
          }
          if (mode && !['info', 'stat', 'stats'].includes(mode)) return syntax(definition.syntax);
          const combat = await this.services.dailyCombatService.getDaily(identity);
          if (mode === 'stat' || mode === 'stats') return `Combat : ${combat.playerStats.totalFights} combats, ${combat.playerStats.totalWins} victoires, ${combat.playerStats.totalManualWins} manuelles, ${combat.playerStats.totalLosses} défaites.`;
          if (mode === 'info') return `Combat : Team ${combat.loadout.slots.filter(slot => slot.character).length}/4 · ${combat.preview ? `chance ${combat.preview.finalHalfPoints / 2}%` : 'composition incomplète'}.`;
          return `Combat du jour : ${statusLabel(combat.status)} · ennemis : ${names(combat.encounter.enemies.map(enemy => enemy.character.name), 4)} · ${combat.canFight ? 'prêt à combattre' : 'combat indisponible'}.`;
        }
        case 'quotis': {
          const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
          const [wheel, challenge, combat, expedition] = await Promise.all([
            this.services.getTodayWheelState.execute(identity), this.services.getDailyChallenge.execute(identity),
            this.services.dailyCombatService.getDaily(identity), this.services.expeditionService.getState(identity),
          ]);
          return `Quotidiennes : Roue ${wheel.spun ? 'faite' : 'à faire'} · Défi ${statusLabel(challenge.status)} · Combat ${statusLabel(combat.status)} · Expédition ${statusLabel(expedition.operationalStatus)}.`;
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
