import type { ElementKey } from '../../domain/economy/resources.js';

export const chatElementEmojis: Readonly<Record<ElementKey, string>> = { pyro: '🔥', hydro: '💧', cryo: '❄️', electro: '⚡', anemo: '🌪️', geo: '☄️', dendro: '🌿' };
export const chatElementNames: Readonly<Record<ElementKey, string>> = { pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Electro', anemo: 'Anemo', geo: 'Geo', dendro: 'Dendro' };
export const chatLine = (value: string) => value.replace(/[\r\n\u2028\u2029]/gu, ' ').trim();

/** Opt-in packing: each entry is indivisible, even when its name contains spaces or commas. */
export function logicalChatParts(prefix: string, entries: readonly { text: string; separator: string }[], continuation: string, limit = 500): readonly string[] {
  const parts: string[] = [];
  let current = chatLine(prefix), occupied = false;
  for (const entry of entries) {
    const text = chatLine(entry.text);
    const addition = `${occupied ? entry.separator : ' '}${text}`;
    if (occupied && Array.from(current + addition).length > limit) {
      parts.push(current);
      current = chatLine(continuation); occupied = false;
    }
    current += `${occupied ? entry.separator : ' '}${text}`;
    if (Array.from(current).length > 500) throw new Error('A Chat entry exceeds the channel limit.');
    occupied = true;
  }
  if (current) parts.push(current);
  return parts;
}
