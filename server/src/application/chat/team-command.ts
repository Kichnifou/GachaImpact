import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';
import type { PlayerTeam, PlayerTeams } from '../team/team-store.js';
import { normalizePlayerSearch } from '../social/social-service.js';
import type { ChatCommandServices } from './chat-command-dispatcher.js';
import type { GlobalChatService } from './global-chat-service.js';
import { chatElementEmojis } from './chat-list-result.js';
import { entryParts } from './chat-command-format.js';

type Intent = { kind: 'apply' | 'rename' | 'new' | 'add' | 'remove' | 'clear'; teamId: string; position: number; characterId: string; name: string | null; error?: string };
const label = (team: PlayerTeam) => `Team ${team.position}${team.name ? ` « ${team.name} »` : ''}${team.active ? ' ⭐ active' : ''}`;
const composition = (team: PlayerTeam) => team.slots.flatMap(slot => slot.character ? [`${chatElementEmojis[slot.character.elementKey]} ${slot.character.name} (C${slot.character.constellation})`] : []);
function viewTeam(player: string, team: PlayerTeam): readonly string[] {
  return entryParts(`✅ ${player}, ${label(team)} :`, [
    ...composition(team), `${team.slots.filter(slot => slot.character).length}/4 personnages`,
    ...team.passives.map(passive => `🧩 ${chatElementEmojis[passive.elementKey]} ${passive.displayName} ×${passive.stacks} : ${passive.description}`),
    ...(!team.passives.length ? ['🧩 Aucun passif actif'] : []),
  ], '✅ Team suite :');
}
export async function teamCommand(identity: AuthenticatedIdentity, args: readonly string[], commandId: string, services: ChatCommandServices, chat: GlobalChatService, syntax: string): Promise<string | readonly string[]> {
  const first = normalizePlayerSearch(args[0] ?? '');
  if (['save', 'help', 'helps', 'tuto', 'info', 'infos'].includes(first)) return syntax;
  const numbered = /^[1-9]\d*$/u.test(first);
  const number = numbered ? Number(first) : null;
  if (number !== null && !Number.isSafeInteger(number)) return syntax;
  const action = numbered ? normalizePlayerSearch(args[1] ?? '') : first;
  const rest = args.slice(numbered ? 2 : 1);
  if (args.length && !numbered && !['add', 'remove', 'rename', 'list', 'liste', 'new'].includes(action)) return syntax;
  if (numbered && action && !['apply', 'remove', 'delete', 'supprimer', 'rename'].includes(action)) return syntax;
  if (['apply', 'new', 'delete', 'supprimer'].includes(action) && rest.length || numbered && action === 'remove' && rest.length) return syntax;
  if (['add', 'remove'].includes(action) && !numbered && !rest.length) return syntax;
  if (action === 'rename' && (rest.length === 0 || !/^"[^"\r\n]*"$/u.test(rest.join(' ')))) return syntax;
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
    return entryParts(`💾 Teams de ${actor.displayName} ${page}/${pages} :`, [
      ...visible.map(row => `${label(row)} (${composition(row).length}/4) : ${composition(row).join(', ') || 'vide'}`),
      ...(empty ? [`${empty} emplacements vides`] : []),
    ], '💾 Teams suite :');
  }
  const intent: Intent = { kind: 'clear', teamId: team?.id ?? '', position: 0, characterId: '', name: null };
  if (!team && action !== 'new') intent.error = `⚠️ ${actor.displayName}, cette Team est introuvable.`;
  if (action === 'new') { intent.kind = 'new'; intent.position = Math.max(10, ...state.teams.map(row => row.position)) + 1; }
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
    case 'new': result = await services.createNextPlayerTeam.execute(identity, saved.position, commandId); break;
    case 'add': result = await services.setPlayerTeamSlot.execute(identity, saved.teamId, saved.position, saved.characterId, commandId); break;
    case 'remove': result = await services.removePlayerTeamSlot.execute(identity, saved.teamId, saved.position, commandId); break;
    case 'clear': result = await services.clearPlayerTeam.execute(identity, saved.teamId, commandId); break;
  }
  await chat.rememberCommandRefreshScopes(commandId, ['teams', 'dailyCombat', 'monthlyBoss']);
  const updated = result.teams.find(row => saved.kind === 'new' ? row.position === saved.position : row.id === saved.teamId)!;
  const outcome = saved.kind === 'new' ? `${label(updated)} créée, vide et non active` : saved.kind === 'apply' ? `${label(updated)} sélectionnée`
    : saved.kind === 'rename' ? `${label(updated)} renommée` : saved.kind === 'clear' ? `${label(updated)} vidée`
    : `${result.availableCharacters.find(row => row.id === saved.characterId)?.name ?? 'Personnage'} ${saved.kind === 'add' ? 'ajouté à' : 'retiré de'} la Team ${updated.position}`;
  return entryParts(`✅ ${actor.displayName}, ${outcome}.`, composition(updated).length ? composition(updated) : ['0/4 personnages'], '✅ Team suite :');
}
