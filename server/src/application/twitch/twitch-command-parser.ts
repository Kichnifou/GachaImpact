import { parseChatCommand } from '../chat/chat-command-registry.js';

/** A standalone COMBINING GRAPHEME JOINER was observed on a repeated command.
 * Remove only trailing tokens made entirely of that character. Keep
 * names, emoji joiners, visible arguments and the observer's raw-text hash intact. */
export function parseTwitchChatCommand(content: string) {
  const parsed = parseChatCommand(content);
  while (parsed.args.length && /^\u034f+$/u.test(parsed.args.at(-1)!)) parsed.args.pop();
  return parsed;
}
