import type { ElementKey } from '../../domain/economy/resources.js';
import { commandSource } from '../player/player-command-execution.js';

export const chatElementEmojis: Readonly<Record<ElementKey, string>> = { pyro: '🔥', hydro: '💧', cryo: '❄️', electro: '⚡', anemo: '🌪️', geo: '☄️', dendro: '🌿' };
export const chatElementNames: Readonly<Record<ElementKey, string>> = { pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Electro', anemo: 'Anemo', geo: 'Geo', dendro: 'Dendro' };
export const chatLine = (value: string) => value.replace(/[\r\n\u2028\u2029]/gu, ' ').trim();
export const TWITCH_RESPONSE_LIMIT = 450;
export const chatResponseLimit = () => commandSource('INTERNAL_CHAT') === 'TWITCH' ? TWITCH_RESPONSE_LIMIT : 500;
export const chatLength = (value: string) => Array.from(value).length;

/** Opt-in packing: each entry is indivisible, even when its name contains spaces or commas. */
export function logicalChatParts(prefix: string, entries: readonly { text: string; separator: string }[], continuation: string, limit = chatResponseLimit()): readonly string[] {
  const twitch = commandSource('INTERNAL_CHAT') === 'TWITCH';
  return packChatParts(prefix, entries, continuation, twitch ? Math.min(limit, TWITCH_RESPONSE_LIMIT) : limit, twitch);
}

/** Explicit transport presentation, also usable outside a Player command scope. */
export function logicalTwitchParts(prefix: string, entries: readonly { text: string; separator: string }[], continuation: string): readonly string[] {
  return packChatParts(prefix, entries, continuation, TWITCH_RESPONSE_LIMIT, true);
}

function packChatParts(prefix: string, entries: readonly { text: string; separator: string }[], continuation: string, limit: number, twitch: boolean): readonly string[] {
  const parts: string[] = [];
  let current = chatLine(prefix), occupied = false;
  for (const entry of entries) {
    if (twitch && !current) current = chatLine(continuation);
    const text = chatLine(entry.text);
    const addition = `${occupied ? entry.separator : ' '}${text}`;
    if ((occupied || twitch) && chatLength(current + addition) > limit) {
      if (current) parts.push(current);
      current = chatLine(continuation); occupied = false;
    }
    if (twitch && chatLength(`${current} ${text}`) > limit) {
      // An exceptional atom is kept whole for the transport's explicit overflow
      // receipt. Never throw after a committed reward or split a name/token.
      if (current && current !== chatLine(continuation)) parts.push(current);
      parts.push(text);
      current = ''; occupied = false;
      continue;
    }
    current += `${occupied ? entry.separator : ' '}${text}`;
    if (!twitch && chatLength(current) > 500) throw new Error('A Chat entry exceeds the channel limit.');
    occupied = true;
  }
  if (current) parts.push(current);
  return parts;
}
