import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import { elementKeys, isElementKey } from '../../domain/economy/resources.js';
import { listTeamPassiveDefinitions } from '../../domain/team/team-passives.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import type { ChatCommandServices } from './chat-command-dispatcher.js';
import { chatElementEmojis, chatElementNames, logicalChatParts } from './chat-list-result.js';

export const chatNumber = (value: bigint | number) => value.toLocaleString('fr-FR').replace(/[\u00a0\u202f]/gu, ' ');
export function resourceText(key: string, amount: bigint | string | number): string {
  const value = typeof amount === 'string' ? chatNumber(BigInt(amount)) : chatNumber(amount);
  if (key === 'primogems') return `💠${value} Primogemmes`;
  if (key === 'moras') return `🪙${value} Moras`;
  if (key === 'xp') return `${value} XP`;
  const element = key.replace(/^particles_/u, '');
  return isElementKey(element) ? `${value} particules ${chatElementEmojis[element]} ${chatElementNames[element]}` : `${value} ressources`;
}
export function durationText(seconds: number): string {
  const minutes = Math.max(0, Math.ceil(seconds / 60));
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60), rest = minutes % 60;
  return [days ? `${days} j` : '', hours ? `${hours} h` : '', rest || !days && !hours ? `${rest} min` : ''].filter(Boolean).join(' ');
}
export const entryParts = (prefix: string, entries: readonly string[], continuation: string, separator = ' | ') =>
  logicalChatParts(prefix, entries.map(text => ({ text, separator })), continuation);

export function passifsCommand(args: readonly string[], syntax: string): string | readonly string[] {
  const element = normalizePlayerSearch(args[0] ?? '');
  if (args.length > 1 || element && !isElementKey(element)) return syntax;
  const definitions = listTeamPassiveDefinitions().filter(row => !element || row.elementKey === element);
  return entryParts('🧩 Passifs :', definitions.map(row => `${chatElementEmojis[row.elementKey]} ${row.displayName} : 1 perso — ${row.levelOne} ; 2 persos — ${row.levelTwo}`), '🧩 Passifs suite :');
}

export async function sacCommand(identity: AuthenticatedIdentity, services: ChatCommandServices): Promise<readonly string[]> {
  const [actor, inventory] = await Promise.all([services.socialService.actor(identity), services.getCurrentPlayerInventory.execute(identity)]);
  const amount = (key: string) => inventory.resources.find(row => row.key === key)?.amount ?? 0n;
  const primogems = amount('primogems');
  const primary = isElementKey(actor.elementKey ?? '') ? actor.elementKey : null;
  const elements = [...elementKeys].sort((a, b) => a === primary ? -1 : b === primary ? 1 : elementKeys.indexOf(a) - elementKeys.indexOf(b));
  const entries = [`${resourceText('primogems', primogems)} (${chatNumber(primogems / 160n)} vœux)`, resourceText('moras', amount('moras')),
    ...elements.map(key => resourceText(`particles_${key}`, amount(`particles_${key}`))),
    ...inventory.items.filter(row => row.section === 'objects' && row.quantity > 0n).map(row => `${row.displayName} (x${row.quantity})`)];
  return entryParts(`✅ ${actor.displayName}, sac :`, entries, '🎒 Sac suite :');
}
