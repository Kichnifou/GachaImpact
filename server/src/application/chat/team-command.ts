import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import type { PlayerTeam, PlayerTeams } from '../team/team-store.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import type { ChatCommandServices } from './chat-command-dispatcher.js';
import type { PlayerCommandContext } from './player-command-context.js';
import { chatElementEmojis, chatLength, chatResponseLimit, logicalChatParts } from './chat-list-result.js';
import { deriveActiveTeamGachaEffects } from '../../domain/team/team-passives.js';
import { entryParts } from './chat-command-format.js';
import { commandSource } from '../player/player-command-execution.js';

type Intent = { kind: 'apply' | 'rename' | 'new' | 'add' | 'remove' | 'clear'; teamId: string; position: number; characterId: string; name: string | null; available?: boolean; guardSlot?: boolean; error?: string };
export const twitchTeamSyntax = 'Syntaxe : !team create | !team N apply | !team add <nom> | !team remove <nom|all> | !team rename "Nom" | !team liste';
const label = (team: PlayerTeam) => `Team ${team.position}${team.name ? ` « ${team.name} »` : ''}${team.active ? ' ⭐ active' : ''}`;
const composition = (team: PlayerTeam) => team.slots.flatMap(slot => slot.character ? [`${chatElementEmojis[slot.character.elementKey]} ${slot.character.name} (C${slot.character.constellation})`] : []);
function compactPassive(passive: PlayerTeam['passives'][number]): string {
  const element = passive.elementKey;
  const effects = deriveActiveTeamGachaEffects(Array.from({ length: passive.stacks }, () => element));
  const multiplier = (value: { numerator: number; denominator: number }) => (value.numerator / value.denominator).toLocaleString('fr-FR');
  const emoji = chatElementEmojis[element];
  switch (element) {
    case 'pyro': return `${emoji} ×${multiplier(effects.secondaryParticleMultiplier)} particules`;
    case 'hydro': return `${emoji} +${effects.fiveStarChanceBonusBasisPoints / 100}% chance 5★`;
    case 'cryo': return `${emoji} 1/${effects.xpReward!.oneIn} : +${effects.xpReward!.amount} XP`;
    case 'electro': return `${emoji} 1/${effects.pity5Reward!.oneIn} : +${effects.pity5Reward!.amount} pity 5★`;
    case 'anemo': return `${emoji} 1/${effects.primogemRecovery!.oneIn} : +${effects.primogemRecovery!.amount} primos`;
    case 'geo': return `${emoji} ×${multiplier(effects.secondaryMoraMultiplier)} moras`;
    case 'dendro': { const bundle = effects.dendroBundle!; return `${emoji} 1/${bundle.oneIn} : +${bundle.primogems} primos, +${bundle.moras} moras, +${bundle.particlesPerElement} particules/élément`; }
  }
}
export function viewTeam(player: string, team: PlayerTeam, headline = `✅ Team ${player} :`): readonly string[] {
  const members = composition(team);
  return logicalChatParts(headline, [
    ...(members.length ? members : ['vide']).map(text => ({ text, separator: ' - ' })),
    ...(team.passives.length ? team.passives.map((passive, index) => ({ text: `${index === 0 ? '🧩 Passifs : ' : ''}${compactPassive(passive)}`, separator: index === 0 ? ' | ' : ', ' }))
      : [{ text: '🧩 Aucun passif actif', separator: ' | ' }]),
  ], '✅ Team suite :');
}
export async function teamCommand(identity: PlayerExecutionActor, args: readonly string[], commandId: string, services: ChatCommandServices, chat: PlayerCommandContext, syntax: string): Promise<string | readonly string[]> {
  if (commandSource(chat.sourceChannel ?? 'INTERNAL_CHAT') === 'TWITCH') syntax = twitchTeamSyntax;
  const first = normalizePlayerSearch(args[0] ?? '');
  if (['save', 'help', 'helps', 'tuto', 'info', 'infos'].includes(first)) return syntax;
  const numbered = /^[1-9]\d*$/u.test(first);
  const number = numbered ? Number(first) : null;
  if (number !== null && !Number.isSafeInteger(number)) return syntax;
  const rawAction = numbered ? normalizePlayerSearch(args[1] ?? '') : first;
  const action = rawAction === 'create' && !numbered ? 'new' : rawAction;
  const rest = args.slice(numbered ? 2 : 1);
  if (args.length && !numbered && !['add', 'remove', 'rename', 'list', 'liste', 'new'].includes(action)) return syntax;
  if (numbered && action && !['apply', 'remove', 'delete', 'supprimer', 'rename'].includes(action)) return syntax;
  if (['apply', 'new', 'delete', 'supprimer'].includes(action) && rest.length || numbered && action === 'remove' && rest.length) return syntax;
  if (['add', 'remove'].includes(action) && !numbered && !rest.length) return syntax;
  if (action === 'rename' && (rest.length === 0 || !/^"[^"\r\n]*"$/u.test(rest.join(' ')))) return syntax;
  if (action === 'rename' && Array.from(rest.join(' ').slice(1, -1).trim()).length > 20) return syntax;
  if (['list', 'liste'].includes(action) && (rest.length > 1 || rest[0] && !/^[1-9]\d*$/u.test(rest[0]))) return syntax;
  const [actor, state] = await Promise.all([services.socialService.actor(identity), services.getCurrentPlayerTeams.execute(identity)]);
  const team = number !== null ? state.teams.find(row => row.position === number) : state.teams.find(row => row.active);
  if (!args.length || numbered && !action) return team ? viewTeam(actor.displayName, team) : `⚠️ ${actor.displayName}, cette Team est introuvable.`;
  if (['list', 'liste'].includes(action)) {
    const page = rest[0] ? Number(rest[0]) : 1, pages = Math.max(1, Math.ceil(state.teams.length / 10));
    if (!Number.isSafeInteger(page)) return syntax;
    if (page > pages) return `⚠️ ${actor.displayName}, cette page de Teams est vide.`;
    const slice = [...state.teams].sort((a, b) => a.position - b.position).slice((page - 1) * 10, page * 10);
    const visible = slice.filter(row => row.active || row.slots.some(slot => slot.character));
    const empty = slice.length - visible.length;
    const entries = [...visible.map(row => `${label(row)} (${composition(row).length}/4) : ${composition(row).join(', ') || 'vide'}`),
      ...(empty ? [`${empty} emplacements vides`] : [])];
    if (commandSource('INTERNAL_CHAT') === 'TWITCH' && entries.some(text => chatLength(`💾 Teams suite : ${text}`) > chatResponseLimit())) return [
      `💾 Teams de ${actor.displayName} ${page}/${pages} :`,
      ...visible.flatMap(row => entryParts(`💾 ${label(row)} (${composition(row).length}/4) :`, composition(row).length ? composition(row) : ['vide'], `💾 Team ${row.position} (suite) :`, ', ')),
      ...(empty ? [`💾 ${empty} emplacements vides`] : []),
    ];
    return entryParts(`💾 Teams de ${actor.displayName} ${page}/${pages} :`, entries, '💾 Teams suite :');
  }
  const intent: Intent = { kind: 'clear', teamId: team?.id ?? '', position: 0, characterId: '', name: null };
  if (!team && action !== 'new') intent.error = `⚠️ ${actor.displayName}, cette Team est introuvable.`;
  if (action === 'new') { intent.kind = 'new'; intent.available = true; }
  else if (action === 'apply') intent.kind = 'apply';
  else if (action === 'rename') { intent.kind = 'rename'; intent.name = rest.join(' ').slice(1, -1).trim() || null; }
  else if (action === 'add') {
    intent.kind = 'add';
    const character = state.availableCharacters.find(row => normalizePlayerSearch(row.name) === normalizePlayerSearch(rest.join(' ')));
    intent.characterId = character?.id ?? '';
    intent.position = team?.slots.find(slot => !slot.character)?.position ?? 0;
    if (!character) intent.error = `⚠️ ${actor.displayName}, personnage introuvable dans ta Box.`;
    else if (team?.slots.some(slot => slot.character?.id === character.id)) intent.error = `⚠️ ${actor.displayName}, ${character.name} est déjà dans ta Team.`;
    else if (!intent.position) intent.error = `⚠️ ${actor.displayName}, ta Team est déjà complète : 4 personnages maximum.`;
  } else if (!numbered && action === 'remove' && !['all', 'tout', 'tous'].includes(normalizePlayerSearch(rest.join(' ')))) {
    intent.kind = 'remove';
    intent.guardSlot = true;
    const slot = team?.slots.find(row => row.character && normalizePlayerSearch(row.character.name) === normalizePlayerSearch(rest.join(' ')));
    intent.position = slot?.position ?? 0; intent.characterId = slot?.character?.id ?? '';
    if (!slot) intent.error = `⚠️ ${actor.displayName}, ce personnage n’est pas dans ta Team.`;
  }
  const saved = JSON.parse(await chat.rememberCommandText(commandId, 'action', JSON.stringify(intent))) as Intent;
  if (saved.error) return saved.error;
  let result: PlayerTeams;
  switch (saved.kind) {
    case 'apply': result = await services.activatePlayerTeam.execute(identity, saved.teamId, commandId); break;
    case 'rename': result = await services.renamePlayerTeam.execute(identity, saved.teamId, saved.name, commandId); break;
    case 'new': result = await services.createNextPlayerTeam.execute(identity, saved.available ? 'AVAILABLE' : saved.position, commandId); break;
    case 'add': result = await services.setPlayerTeamSlot.execute(identity, saved.teamId, saved.position, saved.characterId, commandId); break;
    case 'remove': result = saved.guardSlot
      ? await services.removePlayerTeamSlot.execute(identity, saved.teamId, saved.position, commandId, saved.characterId)
      : await services.removePlayerTeamSlot.execute(identity, saved.teamId, saved.position, commandId); break;
    case 'clear': result = await services.clearPlayerTeam.execute(identity, saved.teamId, commandId); break;
  }
  await chat.rememberCommandRefreshScopes(commandId, ['teams', 'dailyCombat', 'monthlyBoss']);
  const updated = result.teams.find(row => saved.kind === 'new' ? saved.available ? row.active : row.position === saved.position : row.id === saved.teamId)!;
  const outcome = saved.kind === 'new' && saved.available || saved.kind === 'apply' ? `Team ${updated.position} activée` : saved.kind === 'new' ? `${label(updated)} créée, vide et non active`
    : saved.kind === 'rename' ? `${label(updated)} renommée` : saved.kind === 'clear' ? `${label(updated)} vidée`
    : `${result.availableCharacters.find(row => row.id === saved.characterId)?.name ?? 'Personnage'} ${saved.kind === 'add' ? 'ajouté à' : 'retiré de'} la Team ${updated.position}`;
  return viewTeam(actor.displayName, updated, `✅ ${actor.displayName}, ${outcome} |`);
}
