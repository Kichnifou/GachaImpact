import { BusinessError } from '../errors.js';
import type { EventService } from '../event/event-service.js';
import { EVENT_GAME_B_MAX_ATTEMPTS } from '../../domain/event/game-b.js';
import { eventChatThemes } from './event-command-themes.js';

type EventView = Awaited<ReturnType<EventService['getCurrent']>>;
type Phrase = keyof typeof eventChatThemes['shadows'];
export function eventPhrase(event: EventView, phrase: Phrase, player: string, values: Record<string, string | number> = {}): string {
  const theme = eventChatThemes[event.festival.key as keyof typeof eventChatThemes];
  const windows = event.gameA.windows.map(window => `${eventClock(window.startAt)}–${eventClock(window.endAt)}`);
  const replacements: Record<string, string | number> = { username: player, maximum: EVENT_GAME_B_MAX_ATTEMPTS,
    triesLeft: event.gameB.attemptsRemaining, winningCode: event.gameB.resolvedCode ?? 'indisponible',
    window1: windows[0] ?? 'indisponible', window2: windows[1] ?? 'indisponible', window3: windows[2] ?? 'indisponible', ...values };
  return (theme?.[phrase] ?? `${event.festival.emoji} ${player} · ${event.gameA.theme.label}`)
    .replace(/\{(\w+)\}/gu, (token, key: string) => String(replacements[key] ?? token));
}
export function eventClock(date: string): string {
  return new Date(date).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
}
export function eventCommandError(error: unknown, event: EventView, player: string): string | undefined {
  if (!(error instanceof BusinessError)) return undefined;
  switch (error.code) {
    case 'EVENT_NOT_JOINED': return `⚠️ ${player}, inscris-toi au ${event.festival.title} avec !event go !`;
    case 'EVENT_GAME_A_ALREADY_COMPLETED': return `⚠️ ${eventPhrase(event, 'gameAAlready', player)}`;
    case 'EVENT_GAME_A_OUTSIDE_WINDOW': return eventPhrase(event, 'gameAOutside', player);
    case 'EVENT_GAME_A_COOLDOWN': return `⚠️ ${player}, patiente ${Math.max(1, Math.ceil(event.gameA.cooldownRemainingMs / 1000))} seconde(s) avant de retenter ${event.gameA.theme.label}.`;
    case 'EVENT_GAME_B_INVALID_CODE': return `⚠️ ${player}, le code doit contenir exactement 5 chiffres 0 ou 1. Exemple : !event ${event.gameB.theme.label} 01010`;
    case 'EVENT_GAME_B_ALREADY_SOLVED': return eventPhrase(event, 'gameBAlreadyFound', player);
    case 'EVENT_GAME_B_NO_ATTEMPTS': return `⚠️ ${player}, tu as utilisé tes ${EVENT_GAME_B_MAX_ATTEMPTS} essais du jour pour ${event.gameB.theme.label}. Reviens demain !`;
    case 'EVENT_GAME_C_CONTACT_UNAVAILABLE': return `⚠️ ${player}, destinataire introuvable ou indisponible pour ${event.gameC.theme.label}.`;
    case 'EVENT_GAME_C_INVALID_MESSAGE': return `⚠️ ${player}, le message doit contenir entre 1 et 500 caractères.`;
    case 'EVENT_GAME_C_ALREADY_SENT': return `⚠️ ${eventPhrase(event, 'gameCAlready', player)}`;
    case 'EVENT_CALENDAR_UNAVAILABLE': return `⚠️ ${player}, aucune case du calendrier n’est disponible actuellement.`;
    case 'EVENT_CALENDAR_ALREADY_CLAIMED': return `⚠️ ${player}, tu as déjà ouvert la case du jour ! Reviens demain.`;
    case 'EVENT_SHOP_INSUFFICIENT_CURRENCY': return `⚠️ ${player}, tu n’as pas assez de ${event.festival.currency.emoji} ${event.festival.currency.label}.`;
    case 'EVENT_COLLECTION_ALREADY_OBTAINED': return `⚠️ ${player}, tu as déjà obtenu ${event.shop.collection.label} pour cette édition.`;
    case 'EVENT_COLLECTION_UNAVAILABLE': return `⚠️ ${player}, la collection n’est pas disponible actuellement.`;
    default: return undefined;
  }
}
