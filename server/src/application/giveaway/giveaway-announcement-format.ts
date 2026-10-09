import { giveawayRankingEntries } from '../../domain/giveaway/giveaway.js';
import { logicalTwitchParts } from '../chat/chat-list-result.js';
import { twitchResponseEntries } from '../twitch/twitch-response-format.js';

/** Freeze the wire text once, and retain an exceptional atom privately. */
export const giveawayAnnouncementText = (value: string) => {
  const entry = twitchResponseEntries(value)[0];
  if (!entry) return null;
  return { text: entry.text, fullText: entry.fullText ?? null };
};

export function giveawayRankingAnnouncements(ranked: Parameters<typeof giveawayRankingEntries>[0]) {
  return twitchResponseEntries(logicalTwitchParts('💬 Activité Giveaway :', giveawayRankingEntries(ranked).map(text => ({ text, separator: ' | ' })),
    '💬 Activité Giveaway (suite) :')).map(entry => ({ text: entry.text, fullText: entry.fullText ?? null }));
}
