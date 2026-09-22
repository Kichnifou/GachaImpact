export const chatHelpCategories = ['progression', 'gacha', 'ressources', 'collection', 'equipe', 'activites', 'social', 'events', 'classements', 'twitch'] as const;
export type ChatHelpCategory = typeof chatHelpCategories[number];
export type CommandAvailability = 'READY' | 'NOT_CONNECTED' | 'NOT_PHYSICAL' | 'TWITCH_ONLY';
export type ChatCommandDefinition = Readonly<{
  name: string;
  aliases: readonly string[];
  category: ChatHelpCategory;
  syntax: string;
  internalChat: CommandAvailability;
  twitch: boolean;
  permission: 'PLAYER' | 'ADMIN';
  adminOnlySubcommands?: readonly string[];
  handler: string | null;
}>;

const command = (name: string, category: ChatHelpCategory, syntax: string, internalChat: CommandAvailability,
  aliases: readonly string[] = [], twitch = true, permission: 'PLAYER' | 'ADMIN' = 'PLAYER'): ChatCommandDefinition =>
  { return { name, aliases, category, syntax, internalChat, twitch, permission, handler: internalChat === 'READY' ? name : null }; };

/** Canonical roots from command-reference.md. The handler field is the only Help availability source. */
export const chatCommandRegistry: readonly ChatCommandDefinition[] = [
  command('help', 'progression', '!help [categorie|commande]', 'READY'),
  command('element', 'progression', '!element pyro|hydro|cryo|electro|anemo|geo|dendro', 'NOT_CONNECTED'),
  command('convertir', 'ressources', '!convertir <montant>', 'READY'),
  command('echanger', 'ressources', '!echanger [pseudo] [montant]', 'NOT_CONNECTED'),
  command('banniere', 'gacha', '!banniere', 'READY', ['bannière']),
  command('select', 'gacha', '!select <nom>', 'NOT_CONNECTED'),
  command('vote', 'gacha', '!vote <nom>', 'NOT_CONNECTED'),
  command('pity', 'gacha', '!pity', 'READY'),
  command('pull', 'gacha', '!pull [1|10]', 'READY'),
  command('box', 'collection', '!box', 'READY'),
  command('obtention', 'collection', '!obtention <personnage>', 'NOT_CONNECTED'),
  command('stella', 'collection', '!stella <nom exact>', 'NOT_CONNECTED'),
  command('legende', 'collection', '!legende', 'NOT_PHYSICAL', ['légende']),
  command('concours', 'activites', '!concours', 'READY'),
  command('top', 'classements', '!top [categorie]', 'NOT_CONNECTED'),
  { ...command('giveaway', 'twitch', '!giveaway stats', 'TWITCH_ONLY'), adminOnlySubcommands: ['open', 'close', 'reroll'] },
  command('wish', 'twitch', '!wish', 'TWITCH_ONLY'),
  command('code', 'activites', '!code [CODE]', 'READY'),
  command('event', 'events', '!event [top]', 'READY'),
  command('team', 'equipe', '!team', 'READY'),
  command('passifs', 'equipe', '!passifs', 'NOT_CONNECTED'),
  command('banque', 'ressources', '!banque [deposer|retirer <montant|max>]', 'READY'),
  command('sac', 'ressources', '!sac', 'READY'),
  command('coffre', 'ressources', '!coffre', 'READY'),
  command('shop', 'ressources', '!shop [page|primos <quantite|max>|ticket]', 'READY'),
  command('mission', 'activites', '!mission [B|A|S|Z]', 'NOT_PHYSICAL'),
  command('faveur', 'progression', '!faveur [pseudo]', 'NOT_PHYSICAL'),
  command('roue', 'activites', '!roue', 'NOT_CONNECTED'),
  command('quotis', 'activites', '!quotis', 'READY'),
  command('expedition', 'activites', '!expedition', 'READY'),
  command('combat', 'equipe', '!combat [info|boss|stat]', 'READY'),
  command('ami', 'social', '!ami [liste|demandes|ajouter|coeur]', 'NOT_CONNECTED'),
  command('infos', 'social', '!infos <pseudo>', 'READY', ['info']),
  command('liste', 'social', '!liste <element|online> [page]', 'READY'),
];

export function findChatCommand(token: string): ChatCommandDefinition | undefined {
  const normalized = token.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR');
  return chatCommandRegistry.find(entry => [entry.name, ...entry.aliases].some(alias => alias.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR') === normalized));
}

export function chatHelp(token?: string): string {
  if (!token) return `Aide : ${chatHelpCategories.join(' · ')}. Utilise !help <categorie> ou !help <commande>.`;
  const definition = findChatCommand(token);
  if (definition && definition.internalChat === 'READY' && definition.permission === 'PLAYER') return `Aide ${definition.name} : ${definition.syntax}.`;
  const category = chatHelpCategories.find(value => value === token.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR'));
  if (category) {
    const available = chatCommandRegistry.filter(entry => entry.category === category && entry.internalChat === 'READY' && entry.permission === 'PLAYER');
    return available.length ? `${category} : ${available.map(entry => `!${entry.name}`).join(', ')}. Utilise !help <commande>.` : `${category} : aucune commande disponible dans le Chat actuellement.`;
  }
  return 'Commande inconnue. Utilise !help.';
}
