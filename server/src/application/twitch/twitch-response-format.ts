import { chatLength, chatLine, TWITCH_RESPONSE_LIMIT } from '../chat/chat-list-result.js';

export type TwitchResponseEntry = { text: string; fullText?: string };

/** Producers pack semantic entries. This final gate never guesses boundaries in
 * player names, free text, codes or emoji. Oversized atoms remain in the receipt. */
export function twitchResponseEntries(value: string | readonly string[]): TwitchResponseEntry[] {
  return (typeof value === 'string' ? [value] : value).flatMap((original, index) => {
    const text = chatLine(original);
    if (!text) return [];
    const length = chatLength(text);
    if (length <= TWITCH_RESPONSE_LIMIT) return [{ text }];
    return [{ text: `⚠️ Entrée ${index + 1} trop longue (${length} caractères) pour Twitch. Contenu intégral conservé ; restitution à vérifier avec un modérateur.`, fullText: original }];
  });
}

export function twitchResponseSegments(value: string | readonly string[]): string[] {
  return twitchResponseEntries(value).map(entry => entry.text);
}
