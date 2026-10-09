import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import type { ChatCommandServices } from './chat-command-dispatcher.js';
import { getBusinessDate } from '../../domain/time/business-date.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { chatElementEmojis, chatLength, logicalChatParts, TWITCH_RESPONSE_LIMIT } from './chat-list-result.js';
import { commandSource } from '../player/player-command-execution.js';
import { entryParts, durationText, sacCommand } from './chat-command-format.js';
import { pullChatResult } from './gacha-command-result.js';
import { viewTeam } from './team-command.js';
import { BusinessError } from '../errors.js';
import { optionalRecoveryDomain } from '../player/player-recovery-readiness.js';
import { AppError } from '../../api/errors.js';
import { bossDailyState, expeditionDailyState, eventHasActionableContentToday } from '../../domain/dailies/daily-completion.js';
export type PlayerCommandServices = Pick<ChatCommandServices, 'getCurrentGacha' | 'performGachaPullChat' | 'getCurrentPlayerTeams' | 'getCurrentPlayerInventory' | 'expeditionService' | 'getTodayWheelState' | 'getDailyChallenge' | 'dailyCombatService' | 'monthlyBossService' | 'getTodayDailyReward' | 'eventService'> & { socialService: Pick<ChatCommandServices['socialService'], 'actor' | 'friends' | 'favor'> };
export type PlayerCommandHandler = 'pity' | 'banniere' | 'pull' | 'team' | 'sac' | 'expedition' | 'quotis';
const syntax = (usage: string) => `Syntaxe : ${usage}.`;
const noArgs = (args: readonly string[], usage: string) => args.length ? syntax(usage) : null;
export function parsePullCount(args: readonly string[]): number | null {
  if (args.length > 1 || args[0] && !/^(?:[1-9]|10)$/u.test(args[0])) return null;
  return args[0] ? Number(args[0]) : 1;
}
export function playerCommandError(error: unknown, handler: string): string | undefined {
  if (handler === 'banniere' && error instanceof BusinessError && error.code === 'GACHA_BANNER_UNAVAILABLE') return '⚠️ Aucune bannière n’est active pour le moment.';
  const oneLine = (text: string) => text.replace(/[\r\n\u2028\u2029]/gu, ' ').trim();
  if (error instanceof BusinessError && !error.code.includes('IDEMPOTENCY')) return /^(No |A |The |Player |Could )/u.test(error.message) ? 'Action impossible pour le moment.' : oneLine(error.message);
  if (error instanceof AppError && !error.code.includes('IDEMPOTENCY')) return oneLine(error.message);
  return undefined;
}
export function expeditionCommandSummary(view: Awaited<ReturnType<PlayerCommandServices['expeditionService']['getState']>>) {
  return view.operationalStatus === 'IDLE' ? `🧭 Expédition : ${view.departureUsedToday ? 'départ utilisé aujourd’hui. Reviens demain !' : 'Envoie un personnage avec !expedition NomPerso. Retour : !expedition retour.'}` :
            `🧭 Expédition : ${view.activeCharacter?.name ?? 'personnage'} · ${view.operationalStatus === 'READY' ? 'à récupérer avec !expedition retour' : `en cours, retour dans ${durationText(view.remainingSeconds)}`}.`;
}

export async function resolvePlayerCommand(identity: PlayerExecutionActor, handler: PlayerCommandHandler, args: readonly string[], usage: string, commandMessageId: string, services: PlayerCommandServices, rememberName: (name: string) => Promise<string> = async name => name): Promise<string | readonly string[]> {
  const definition = { syntax: usage };
  switch (handler) {
    case 'pity': {
      const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
      const { playerState: p } = await services.getCurrentGacha.execute(identity);
      const actor = await services.socialService.actor(identity);
      return `✅ ${actor.displayName}, pity : 5★ ${p.pity5}/90 | 4★ ${p.pity4}/10 | 🎯 Garantie 5★ : ${p.guaranteedFeatured5 ? 'oui' : 'non'} | ✨ Capture : ${p.captureProgress}/3.`;
    }
    case 'banniere': {
      const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
      const { banner, playerState } = await services.getCurrentGacha.execute(identity);
      const characterText = (character: { elementKey: string; name: string }) => `${isElementKey(character.elementKey) ? chatElementEmojis[character.elementKey] : ''} ${character.name}`.trim();
      const dateText = (instant: Date) => { const [, month, day] = getBusinessDate(instant).split('-'); return `${day}/${month}`; };
      // endsAt is exclusive; use the last covered instant for the inclusive Paris date, including DST weeks.
      const period = `${dateText(banner.startsAt)} → ${dateText(new Date(banner.endsAt.getTime() - 1))}`;
      const target = banner.featuredFiveStars.find(c => c.id === playerState.selectedBannerCharacterId);
      const targetText = target ? `5★ ciblé : ${characterText(target)}` : 'Utilise !select nom_du_perso pour choisir ton 5★ ciblé.';
      const text = `🎯 Bannières (${period}) | ⭐⭐⭐⭐⭐ ${banner.featuredFiveStars.map(characterText).join(', ')} | ⭐⭐⭐⭐ ${banner.featuredFourStars.map(characterText).join(', ')} | ${targetText}`;
      if (commandSource('INTERNAL_CHAT') !== 'TWITCH' || chatLength(text) <= TWITCH_RESPONSE_LIMIT) return text;
      return logicalChatParts(`🎯 Bannières (${period}) |`, [
        ...banner.featuredFiveStars.map(character => ({ text: `⭐⭐⭐⭐⭐ ${characterText(character)}`, separator: ', ' })),
        ...banner.featuredFourStars.map(character => ({ text: `⭐⭐⭐⭐ ${characterText(character)}`, separator: ', ' })),
        { text: targetText, separator: ' | ' },
      ], '🎯 Bannières (suite) :');
    }
    case 'pull': {
      const count = parsePullCount(args);
      if (count === null) return syntax(definition.syntax);
      const actor = await services.socialService.actor(identity);
      const actorName = await rememberName(actor.displayName);
      const result = await services.performGachaPullChat.execute(identity, count, commandMessageId);
      return pullChatResult(actorName, result);
    }
    case 'quotis': {
      const invalid = noArgs(args, definition.syntax); if (invalid) return invalid;
      const actor = await services.socialService.actor(identity);
      const [wheel, challenge, combat, expedition, reward, friends, event, favor, boss] = await Promise.all([
        services.getTodayWheelState.execute(identity), services.getDailyChallenge.execute(identity),
        services.dailyCombatService.getDaily(identity), services.expeditionService.getState(identity),
        services.getTodayDailyReward.execute(identity), services.socialService.friends(identity),
        optionalRecoveryDomain(services.eventService.getCurrent(identity)), services.socialService.favor(identity, actor.id),
        optionalRecoveryDomain(services.monthlyBossService.getCurrentForChat(identity)),
      ]);
      const mark = (state: string) => state === 'completed' ? '✅' : state === 'ineligible' ? '➖' : '⏳';
      return entryParts('📅 Quotidiennes :', [
        `Récompense ${reward.claimed ? '✅' : '⏳'}`, `Roue ${wheel.spun ? '✅' : '⏳'}`,
        `Shop ${challenge.status === 'COMPLETED' ? '✅' : '⏳'}`, `Combat ${combat.status === 'COMPLETED' ? '✅' : combat.status === 'BLOCKED' ? '➖' : '⏳'}`,
        boss ? `Boss ${mark(bossDailyState(boss))}` : 'Boss : temporairement indisponible', `Expédition ${mark(expeditionDailyState(expedition))}`,
        `Amitié ${friends.summary.available === 0 ? '✅' : '⏳ · ' + friends.summary.available + ' cœur(s) à envoyer'}`,
        event ? `Event ${eventHasActionableContentToday(event) ? '⏳' : '✅'}${event.participation.joined ? '' : ' · non inscrit'}` : 'Event : temporairement indisponible',
        `Faveur ${favor.access === 'ALLOWED' && favor.data.active ? favor.data.claimedToday ? '✅' : '⏳' : '➖'}`,
      ], '📅 Quotidiennes (suite) :');
    }
    case 'team': {
      if (args.length) return syntax(usage);
      const [actor, state] = await Promise.all([services.socialService.actor(identity), services.getCurrentPlayerTeams.execute(identity)]);
      const team = state.teams.find(row => row.active);
      return team ? viewTeam(actor.displayName, team) : `⚠️ ${actor.displayName}, cette Team est introuvable.`;
    }
    case 'sac': return args.length ? syntax(usage) : sacCommand(identity, services);
    case 'expedition': return args.length ? syntax(usage) : expeditionCommandSummary(await services.expeditionService.getState(identity));
  }
}
