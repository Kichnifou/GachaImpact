import { chatLength, chatLine, TWITCH_RESPONSE_LIMIT } from '../chat/chat-list-result.js';

export type TwitchResponseEntry = { text: string; fullText?: string };

type ReplyNames = { parent_user_name?: string; parent_user_login?: string; thread_user_name?: string; thread_user_login?: string };
/** Twitch adds @thread-starter (or @chatter for a new thread) to replies.
 * Only signed EventSub names supply this allowance, never Player.displayName.
 * Reserve the full accepted name bound if any reply authority is unavailable. */
export function twitchReplyBodyLimit(event: { chatter_user_name?: string; chatter_user_login?: string; reply?: ReplyNames | null }): number {
  const longest = (...names: (string | undefined)[]) => {
    const lengths = names.filter((name): name is string => Boolean(name?.trim())).map(chatLength);
    return lengths.length && lengths.every(length => length <= 128) ? Math.max(...lengths) : 128;
  };
  const lengths = [longest(event.chatter_user_name, event.chatter_user_login)];
  if (event.reply) lengths.push(longest(event.reply.parent_user_name, event.reply.parent_user_login),
    longest(event.reply.thread_user_name, event.reply.thread_user_login));
  return TWITCH_RESPONSE_LIMIT - 2 - Math.max(...lengths);
}

/** Producers pack semantic entries. This final gate never guesses boundaries in
 * player names, free text, codes or emoji. Oversized atoms remain in the receipt. */
export function twitchResponseEntries(value: string | readonly string[], bodyLimit = TWITCH_RESPONSE_LIMIT): TwitchResponseEntry[] {
  return (typeof value === 'string' ? [value] : value).flatMap((original, index) => {
    const text = chatLine(original);
    if (!text) return [];
    const length = chatLength(text);
    if (length <= bodyLimit) return [{ text }];
    return [{ text: `⚠️ Entrée ${index + 1} trop longue (${length} caractères) pour Twitch. Contenu intégral conservé ; restitution à vérifier avec un modérateur.`, fullText: original }];
  });
}

export function twitchResponseSegments(value: string | readonly string[], bodyLimit = TWITCH_RESPONSE_LIMIT): string[] {
  return twitchResponseEntries(value, bodyLimit).map(entry => entry.text);
}
