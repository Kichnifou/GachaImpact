import { chatCommandRegistry, chatHelpCategories, type ChatCommandDefinition, type ChatHelpCategory } from './chat-command-metadata.js';
export { chatCommandRegistry, chatHelpCategories } from './chat-command-metadata.js';
export type { ChatCommandDefinition, ChatHelpCategory, CommandAvailability } from './chat-command-metadata.js';

const normalize = (token: string) => token.replace(/^!/, '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR');
const categoryAliases: Readonly<Record<string, ChatHelpCategory>> = { xp: 'progression', pulls: 'gacha', resources: 'ressources', codes: 'events', gift: 'twitch', stats: 'classements', quotidiennes: 'activites', daily: 'activites', boutique: 'ressources', box: 'collection', shop: 'ressources', top: 'classements' };
export function findChatCommand(token: string): ChatCommandDefinition | undefined {
  return chatCommandRegistry.find(entry => [entry.name, ...entry.aliases].some(alias => normalize(alias) === normalize(token)));
}
export function parseChatCommand(content: string) {
  const [root = '', ...args] = content.slice(1).trim().split(/\s+/u);
  return { root, args, definition: findChatCommand(root) };
}
export function commandHelp(definition: ChatCommandDefinition): string {
  if (definition.permission !== 'PLAYER') return 'Aide inconnue. Utilise !help pour voir les catégories.';
  if (definition.internalChat === 'TWITCH_ONLY') return 'Sur Twitch uniquement : '+definition.syntax+'. '+definition.summary;
  if (definition.internalChat !== 'READY') return 'Cette commande n’est pas disponible dans le Chat actuellement.';
  return 'Aide '+definition.name+' : '+definition.syntax+'. '+definition.summary;
}
export function chatHelp(token?: string): string {
  if (!token) return 'Aide : '+chatHelpCategories.join(' · ')+'. Utilise !help <categorie> ou !help <commande>.';
  const definition = findChatCommand(token);
  if (definition) return commandHelp(definition);
  const normalized = normalize(token);
  const category = chatHelpCategories.find(value => value === normalized) ?? categoryAliases[normalized];
  if (category === 'twitch') return 'Twitch : !wish et !giveaway stats uniquement sur Twitch. Faveur s’acquiert via les subscriptions compatibles ; Gift Suprême via la récompense de chaîne. !faveur permet la consultation dans le Chat.';
  if (category) {
    const available = chatCommandRegistry.filter(entry => entry.category === category && entry.internalChat === 'READY' && entry.permission === 'PLAYER');
    return category+' : '+available.map(entry => '!'+entry.name).join(', ')+'. Utilise !help <commande>.';
  }
  return 'Aide inconnue. Utilise !help pour voir les catégories.';
}
