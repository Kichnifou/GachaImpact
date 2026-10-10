export const chatHelpCategories = ['progression', 'gacha', 'ressources', 'collection', 'equipe', 'activites', 'social', 'events', 'classements', 'twitch'] as const;
export type ChatHelpCategory = typeof chatHelpCategories[number];
export type CommandAvailability = 'READY' | 'NOT_CONNECTED' | 'NOT_PHYSICAL' | 'TWITCH_ONLY';
export type ChatCommandDefinition = Readonly<{
  name: string;
  aliases: readonly string[];
  category: ChatHelpCategory;
  syntax: string;
  summary: string;
  internalChat: CommandAvailability;
  twitch: boolean;
  permission: 'PLAYER' | 'ADMIN';
  adminOnlySubcommands?: readonly string[];
  handler: string | null;
}>;

const summaries: Readonly<Record<string, string>> = {
  "help": "Retrouvez les catégories ou l’aide d’une commande.",
  "element": "Choisissez votre élément permanent.",
  "banniere": "Consultez la rotation et ses personnages.",
  "select": "Consultez ou choisissez votre cible d’Invocation.",
  "vote": "Consultez ou votez pour une prochaine cible.",
  "pull": "Invoquez sur votre bannière avec vos Primogemmes.",
  "pity": "Consultez Pity, Garantie et Capture.",
  "sac": "Consultez vos ressources et objets.",
  "convertir": "Convertissez vos particules personnelles.",
  "banque": "Consultez votre Banque ou transférez vos Moras.",
  "echanger": "Consultez et gérez vos échanges de particules.",
  "shop": "Consultez la Boutique et ses achats disponibles.",
  "coffre": "Consultez vos objets de Collection.",
  "box": "Consultez vos personnages possédés.",
  "obtention": "Retrouvez les obtentions d’un personnage.",
  "stella": "Utilisez une Stella sur un personnage admissible.",
  "legende": "Consultez les personnages 5★ C6 et leur progression Concours.",
  "team": "Consultez, activez et organisez vos Teams.",
  "passifs": "Consultez les règles générales des passifs élémentaires.",
  "combat": "Consultez ou jouez Combat et Boss.",
  "quotis": "Retrouvez vos activités quotidiennes.",
  "mission": "Consultez les Missions permanentes et leur progression.",
  "expedition": "Consultez, lancez ou terminez votre Expédition.",
  "roue": "Consultez ou faites tourner votre Roue quotidienne.",
  "ami": "Consultez et gérez vos relations d’amitié.",
  "infos": "Consultez les informations autorisées d’un joueur.",
  "liste": "Recherchez les joueurs par élément ou présence.",
  "event": "Consultez et jouez le Festival en cours.",
  "concours": "Concours : prochainement disponible.",
  "code": "Consultez ou utilisez un Code cadeau.",
  "top": "Consultez les classements ; pour le taux de 5★, utilisez !top taux5.",
  "faveur": "Consultez la Faveur de l’Astre selon la confidentialité.",
  "wish": "Participez au Giveaway sur Twitch uniquement.",
  "giveaway": "Consultez les statistiques du Giveaway sur Twitch uniquement."
};

const command = (name: string, category: ChatHelpCategory, syntax: string, internalChat: CommandAvailability,
  aliases: readonly string[] = [], twitch = true, permission: 'PLAYER' | 'ADMIN' = 'PLAYER'): ChatCommandDefinition =>
  ({ name, aliases, category, syntax, summary: summaries[name]!, internalChat, twitch, permission, handler: internalChat === 'READY' ? name : null });

/** Shared presentation metadata, bundled by both server and standalone Help. No business rules. */
export const chatCommandRegistry: readonly ChatCommandDefinition[] = [
  command('help', 'progression', '!help [categorie|commande]', 'READY'),
  command('element', 'progression', '!element pyro|hydro|cryo|electro|anemo|geo|dendro', 'READY'),
  command('convertir', 'ressources', '!convertir <montant>', 'READY', ['conv']),
  command('echanger', 'ressources', '!echanger [pseudo] [montant|max] | liste | accepter [pseudo|all] | annuler [pseudo|all] | refuser [pseudo|all]', 'READY', ['echange', 'ech']),
  command('banniere', 'gacha', '!banniere', 'READY', ['bannière', 'ban', 'banner']),
  command('select', 'gacha', '!select [nom]', 'READY'),
  command('vote', 'gacha', '!vote [nom] (alias : !votes)', 'READY', ['votes']),
  command('pity', 'gacha', '!pity', 'READY'),
  command('pull', 'gacha', '!pull [1..10]', 'READY'),
  command('box', 'collection', '!box [5|4|6|élément|pN|favoris [personnage]|a|d|c|e]', 'READY'),
  command('obtention', 'collection', '!obtention <personnage>', 'READY'),
  command('stella', 'collection', '!stella <nom exact>', 'READY'),
  command('legende', 'collection', '!legende [joueur] [personnage]', 'READY', ['légende', 'legendes', 'leg']),
  command('concours', 'events', '!concours', 'READY'),
  command('top', 'classements', '!top [me|metrique]', 'READY'),
  { ...command('giveaway', 'twitch', '!giveaway stats', 'TWITCH_ONLY', ['ga']), adminOnlySubcommands: ['open', 'close'] },
  command('wish', 'twitch', '!wish', 'TWITCH_ONLY'),
  command('code', 'events', '!code [CODE]', 'READY'),
  command('event', 'events', '!event [go|sac|boutique|top|primos|moras|collection|calendrier|jeu du mois]', 'READY'),
  command('team', 'equipe', '!team create | !team N apply | !team add <nom> | !team remove <nom|all> | !team rename "Nom" | !team liste', 'READY'),
  command('passifs', 'equipe', '!passifs [element]', 'READY', ['passif']),
  command('banque', 'ressources', '!banque [deposer|retirer <montant|max>]', 'READY'),
  command('sac', 'ressources', '!sac', 'READY'),
  command('coffre', 'ressources', '!coffre', 'READY'),
  command('shop', 'ressources', '!shop [page|primos <quantite|max>|ticket|mission|switch]', 'READY'),
  command('mission', 'activites', '!mission [B|A|S|Z|resume]', 'READY'),
  command('faveur', 'progression', '!faveur [pseudo]', 'READY'),
  command('roue', 'activites', '!roue', 'READY'),
  command('quotis', 'activites', '!quotis', 'READY', ['quoti', 'daily']),
  command('expedition', 'activites', '!expedition [personnage|retour]', 'READY', ['exp']),
  command('combat', 'equipe', '!combat [info|go|auto|elements|help|stat|boss [go]]', 'READY'),
  command('ami', 'social', '!ami [demandes|ajouter|accepter|refuser|annuler|retirer|voir|coeur] [pseudo|all]', 'READY'),
  command('infos', 'social', '!infos <pseudo>', 'READY', ['info']),
  command('liste', 'social', '!liste <pyro|hydro|cryo|electro|anemo|geo|dendro|online> [page]', 'READY'),
];
