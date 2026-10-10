import { isElementKey } from '../../domain/economy/resources.js';
import { eventCurrencyUnit } from '../../domain/event/currency-presentation.js';
import { chatNumber } from './chat-command-format.js';
import { chatElementEmojis, chatElementNames, chatLength, chatLine, chatResponseLimit, logicalChatParts } from './chat-list-result.js';

// Match the persisted edition label, never today's Festival or a live balance.
const currencies: Readonly<Record<string, readonly [string, string]>> = {
  'Éclats de Fortune': ['new-year', '🎆'], 'Cœurs Étincelants': ['hearts', '💖'],
  'Bourgeons Mystiques': ['spring', '🌱'], 'Œufs Enchantés': ['bells', '🥚'],
  'Pétales Magiques': ['flowers', '🌸'], 'Coquillages Dorés': ['summer', '🏝️'],
  'Étoiles Tombées': ['stars', '⭐'], 'Reliques d’Exploration': ['adventurers', '🧭'],
  'Jetons de Récolte': ['harvest', '🌾'], 'Bonbons Maudits': ['shadows', '🎃'],
  'Feuilles Anciennes': ['mists', '🍁'], 'Étoiles de Noël': ['christmas', '🎄'],
};
type Reward = Readonly<{ resourceKey: string; amount: string; displayName: string }>;
export function codeRewardText(reward: Reward): string {
  const amount = BigInt(reward.amount), value = `+${chatNumber(amount)}`;
  if (reward.resourceKey === 'moras') return `🪙 ${value} Mora${amount === 1n ? '' : 's'}`;
  if (reward.resourceKey === 'primogems') return `💠 ${value} Primogemme${amount === 1n ? '' : 's'}`;
  if (reward.resourceKey === 'masterless-stella-fortuna') return `✨ ${value} Masterless Stella Fortuna`;
  if (reward.resourceKey === 'event_points') return `⭐ ${value} point${amount === 1n ? '' : 's'} Event`;
  if (reward.resourceKey === 'event_currency') {
    const theme = currencies[reward.displayName];
    return `${theme?.[1] ?? '🎁'} ${value} ${amount === 1n && theme ? eventCurrencyUnit(theme[0]) : reward.displayName}`;
  }
  const element = reward.resourceKey.replace(/^particles_/u, '');
  if (isElementKey(element)) return `${element === 'dendro' ? '🌱' : chatElementEmojis[element]} ${value} particule${amount === 1n ? '' : 's'} ${chatElementNames[element]}`;
  return `🎁 ${value} ${reward.displayName}`;
}

/** Pack whole rewards with their group title repeated on every continuation. */
export function codeRewardParts(prefix: string, direct: readonly string[], milestones: readonly string[], notes: readonly string[]): string | readonly string[] {
  const groups = [[prefix],
    ...(direct.length ? [logicalChatParts('🎁 Code :', direct.map(text => ({ text, separator: ' · ' })), '🎁 Code (suite) :')] : []),
    ...(milestones.length ? [logicalChatParts('🏅 Paliers :', milestones.map(text => ({ text, separator: ' · ' })), '🏅 Paliers (suite) :')] : []),
    ...notes.map(codeNoteParts)];
  const parts: string[] = [];
  for (const group of groups) for (const text of group) {
    const last = parts.at(-1);
    if (last && chatLength(last + ' | ' + text) <= chatResponseLimit()) parts[parts.length - 1] = last + ' | ' + text;
    else parts.push(text);
  }
  return parts.length === 1 ? parts[0]! : parts;
}

function codeNoteParts(note: string): readonly string[] {
  let text = chatLine(note);
  if (chatLength(text) <= chatResponseLimit()) return [text];
  const prefix = '🎁 Code · Note (suite) :', capacity = chatResponseLimit() - chatLength(prefix) - 1, parts: string[] = [];
  while (text) {
    const chars = Array.from(text), available = chars.slice(0, capacity).join('');
    const lastSpace = available.lastIndexOf(' ');
    const cut = chars.length > capacity && lastSpace > 0 ? Array.from(available.slice(0, lastSpace)).length : capacity;
    parts.push(`${prefix} ${chars.slice(0, cut).join('').trim()}`);
    text = chars.slice(cut).join('').trim();
  }
  return parts;
}
