export type GiveawayCommand = 'WISH' | 'STATS' | 'OPEN' | 'CLOSE' | 'HELP' | 'OTHER_COMMAND' | 'MESSAGE';

/** Twitch text is classified only in memory. A leading ! always excludes activity counting. */
export function classifyGiveawayText(text: string): GiveawayCommand {
  const trimmed = text.trim();
  if (!trimmed) return 'OTHER_COMMAND';
  if (!trimmed.startsWith('!')) return 'MESSAGE';
  const parts = trimmed.toLocaleLowerCase('fr-FR').split(/\s+/);
  if (parts[0] === '!wish' && parts.length === 1) return 'WISH';
  if (!['!giveaway', '!ga'].includes(parts[0]!)) return 'OTHER_COMMAND';
  if (parts.length === 2 && (parts[1] === 'stats' || parts[1] === 'stat')) return 'STATS';
  if (parts.length === 2 && (parts[1] === 'open' || parts[1] === 'ouvrir')) return 'OPEN';
  if (parts.length === 2 && (parts[1] === 'close' || parts[1] === 'fermer')) return 'CLOSE';
  return 'HELP';
}

export function giveawayRanked<T extends { messageCount: bigint; playerId: string; displayName: string }>(rows: readonly T[]) {
  const ordered = [...rows].sort((a, b) => a.messageCount === b.messageCount
    ? a.displayName.localeCompare(b.displayName, 'fr') || a.playerId.localeCompare(b.playerId)
    : a.messageCount > b.messageCount ? -1 : 1);
  let previous = -1n;
  let rank = 0;
  return ordered.map((row, index) => {
    if (row.messageCount !== previous) rank = index + 1;
    previous = row.messageCount;
    return { ...row, rank, amount: BigInt(rank === 1 ? 2000 : rank === 2 ? 1500 : rank === 3 ? 1000 : 500) };
  });
}

export function oneLine(text: string): string {
  return text.replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
}

export function resultText(winner: string | null): string {
  return winner ? oneLine(`🌠 Célestia a choisi ${winner} parmi tous les voyageurs ! +💠1 600 primos !`)
    : 'ℹ️ Le giveaway est terminé. Aucun joueur éligible n’a participé au tirage !wish.';
}

export function giveawayRankingEntries(ranked: readonly { displayName: string; rank: number; messageCount: bigint; amount: bigint; elementKey: string }[]): string[] {
  if (!ranked.length) return ['aucun joueur éligible n’a envoyé de message.'];
  const podium = ranked.filter(row => row.rank <= 3).slice(0, 3).map(row =>
    `${row.rank}e ${row.displayName} (${row.messageCount} messages) +${row.amount} particules ${row.elementKey}`);
  const remaining = ranked.length - podium.length;
  return [...podium, ...(remaining ? [`${remaining} autre(s) joueur(s) récompensé(s)`] : [])];
}

export function rankingText(ranked: Parameters<typeof giveawayRankingEntries>[0]): string {
  return oneLine(`💬 Activité Giveaway : ${giveawayRankingEntries(ranked).join(' | ')}`);
}
