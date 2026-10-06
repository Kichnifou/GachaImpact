/** The announcement is frozen with the participation receipt, before any outbound send. */
export function wishChatResult(outcome: string, name: string, count: number): string {
  if (outcome === 'JOINED') return `🌠 ${name} formule un vœu auprès de Célestia... | 🎁 ${count} participant(s)`;
  if (outcome === 'ALREADY_JOINED') return `⚠️ ${name}, tu participes déjà au Giveaway.`;
  if (outcome === 'NO_OPEN') return '⚠️ Aucun Giveaway n’est actuellement ouvert.';
  if (outcome === 'NO_ELEMENT') return '⚠️ Choisis ton élément dans GachaImpact avant !wish.';
  return '⚠️ Ton profil GachaImpact actif et lié à Twitch est requis pour !wish.';
}
