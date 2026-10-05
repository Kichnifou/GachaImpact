/** Explicit ownership: adding a Twitch command requires a reviewed classification. */
export const genericTwitchCommands = [
  'help', 'element', 'convertir', 'echanger', 'banniere', 'select', 'vote', 'pity', 'pull',
  'box', 'obtention', 'stella', 'legende', 'concours', 'top', 'code', 'event', 'team',
  'passifs', 'banque', 'sac', 'coffre', 'shop', 'mission', 'faveur', 'roue', 'quotis',
  'expedition', 'combat', 'ami', 'infos', 'liste',
] as const;
export const specializedTwitchCommands = ['wish', 'giveaway'] as const;
export function twitchCommandOwner(name: string): 'GENERIC_NATIVE' | 'SPECIALIZED_NATIVE' | undefined {
  if (genericTwitchCommands.some(value => value === name)) return 'GENERIC_NATIVE';
  if (specializedTwitchCommands.some(value => value === name)) return 'SPECIALIZED_NATIVE';
  return undefined;
}
