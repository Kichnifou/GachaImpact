import { describe, expect, it, vi } from 'vitest';
import { teamCommand } from '../src/application/chat/team-command.js';
import type { ChatCommandServices } from '../src/application/chat/chat-command-dispatcher.js';
import type { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import type { PlayerTeams, TeamCharacter } from '../src/application/team/team-store.js';

const identity = { subject: 'owner' };
const character: TeamCharacter = { id: 'character', externalKey: 'royal', name: 'Étoile Royale', rarity: 5, elementKey: 'pyro', constellation: 2, classKey: null, region: null, weaponType: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null };
function fixture() {
  const state: { teams: PlayerTeams['teams']; availableCharacters: PlayerTeams['availableCharacters']; passiveReference: PlayerTeams['passiveReference'] } = {
    teams: Array.from({ length: 10 }, (_, index) => ({ id: `team-${index + 1}`, position: index + 1, name: null, active: index === 0, slots: ([1, 2, 3, 4] as const).map(position => ({ position, character: null })), passives: [] })),
    availableCharacters: [character], passiveReference: [],
  };
  const execute = () => ({ execute: vi.fn(async () => structuredClone(state)) });
  const services = { socialService: { actor: vi.fn(async () => ({ displayName: 'Axel' })) }, getCurrentPlayerTeams: { execute: vi.fn(async () => state) },
    activatePlayerTeam: execute(), renamePlayerTeam: execute(), createNextPlayerTeam: execute(), setPlayerTeamSlot: execute(), removePlayerTeamSlot: execute(), clearPlayerTeam: execute(),
  };
  const intents = new Map<string, string>();
  const chat = { rememberCommandText: vi.fn(async (id: string, _field: string, value: string) => { if (!intents.has(id)) intents.set(id, value); return intents.get(id)!; }), rememberCommandRefreshScopes: vi.fn() };
  const run = (input = '', id = 'intent') => teamCommand(identity, input ? input.split(' ') : [], id, services as unknown as ChatCommandServices, chat as unknown as GlobalChatService, 'syntax');
  return { state, services, chat, run };
}
describe('Team text commands', () => {
  it('consults numbered Teams without activation, including empty Teams and active status', async () => {
    const h = fixture(); expect(await h.run()).toEqual(['✅ Team Axel : vide | 🧩 Aucun passif actif']);
    expect((await h.run('2'))[0]).toContain('Team Axel : vide'); expect(h.services.activatePlayerTeam.execute).not.toHaveBeenCalled();
    h.state.teams = h.state.teams.map(team => team.position === 2 ? { ...team, slots: team.slots.map(slot => slot.position === 1 ? { ...slot, character } : slot) } : team);
    expect((await h.run('2'))[0]).toContain('🔥 Étoile Royale (C2)');
    expect((await h.run())[0]).toContain('Team Axel : vide');
    expect(h.services.activatePlayerTeam.execute).not.toHaveBeenCalled();
    expect(await h.run('99')).toContain('introuvable');
  });
  it('applies the requested Team and propagates delivery key and refresh scopes', async () => {
    const h = fixture(); await h.run('2 apply');
    expect(h.services.activatePlayerTeam.execute).toHaveBeenCalledWith(identity, 'team-2', 'intent');
    expect(h.chat.rememberCommandRefreshScopes).toHaveBeenCalledWith('intent', ['teams', 'dailyCombat', 'monthlyBoss']);
  });
  it('adds only an exact normalized owned name to the first empty slot', async () => {
    const h = fixture(); await h.run('add ETOILE ROYALE');
    expect(h.services.setPlayerTeamSlot.execute).toHaveBeenCalledWith(identity, 'team-1', 1, 'character', 'intent');
    const other = fixture(); expect(await other.run('add etoile')).toContain('introuvable'); expect(other.services.setPlayerTeamSlot.execute).not.toHaveBeenCalled();
  });
  it('freezes the target Team and slot across retries after the active Team changes', async () => {
    const h = fixture(); await h.run('add Étoile Royale');
    h.state.teams = h.state.teams.map(team => ({ ...team, active: team.position === 2 }));
    await h.run('add Étoile Royale');
    expect(h.services.setPlayerTeamSlot.execute).toHaveBeenNthCalledWith(2, identity, 'team-1', 1, 'character', 'intent');
  });
  it('removes only an exact occupied name and retains the first removal intent', async () => {
    const h = fixture(); h.state.teams = h.state.teams.map(team => team.active ? { ...team, slots: [{ position: 1, character }, ...team.slots.slice(1)] } : team);
    await h.run('remove ETOILE ROYALE'); h.state.teams = h.state.teams.map(team => ({ ...team, slots: team.slots.map(slot => ({ ...slot, character: null })) }));
    await h.run('remove Étoile Royale'); expect(h.services.removePlayerTeamSlot.execute).toHaveBeenNthCalledWith(2, identity, 'team-1', 1, 'intent', 'character');
  });
  it.each(['remove all', 'remove tout', 'remove tous', '2 remove', '2 delete', '2 supprimer'])('clears %s through the owner without deleting a Team', async input => {
    const h = fixture(); await h.run(input); expect(h.services.clearPlayerTeam.execute).toHaveBeenCalledWith(identity, input.startsWith('2') ? 'team-2' : 'team-1', 'intent');
  });
  it('renames empty Teams using quoted compound names and supports clearing the name', async () => {
    const h = fixture(); await h.run('2 rename "Boss Électro"'); expect(h.services.renamePlayerTeam.execute).toHaveBeenCalledWith(identity, 'team-2', 'Boss Électro', 'intent');
    await h.run('rename ""', 'other'); expect(h.services.renamePlayerTeam.execute).toHaveBeenCalledWith(identity, 'team-1', null, 'other');
    expect(await h.run('rename Boss Électro', 'invalid')).toBe('syntax');
  });
  it.each(['new', 'create'])('delegates %s to atomic available selection and retains that intent on retry', async action => {
    const h = fixture();
    await h.run(action); await h.run(action);
    expect(h.services.createNextPlayerTeam.execute).toHaveBeenNthCalledWith(2, identity, 'AVAILABLE', 'intent');
  });
  it('lists ten Teams per page, compacting empty slots and preserving complete long entries', async () => {
    const h = fixture(); h.state.teams = Array.from({ length: 22 }, (_, index) => ({ ...h.state.teams[0]!, id: `t-${index}`, position: index + 1, name: `Équipe ${index} composée`, active: index === 0, slots: [{ position: 1, character: { ...character, name: `Personnage ${index} avec nom composé` } }] }));
    const parts = await h.run('liste 1') as readonly string[]; expect(parts.length).toBeGreaterThan(1); expect(parts.every(part => Array.from(part).length <= 500)).toBe(true);
    for (let index = 0; index < 10; index++) expect(parts.filter(part => part.includes(`Personnage ${index} avec nom composé (C2)`))).toHaveLength(1);
    expect(parts.join(' ')).not.toContain('Personnage 10'); expect((await h.run('list 3') as readonly string[]).join(' ')).toContain('Team 22');
    expect(await h.run('list 4')).toContain('vide');
  });
  it.each(['save', 'save 2', '0', '-1', 'new extra', '1 apply extra', 'list 0'])('leaves %s as a helper without mutation', async input => {
    const h = fixture(); expect(await h.run(input)).toBe('syntax');
    expect(h.services.createNextPlayerTeam.execute).not.toHaveBeenCalled(); expect(h.services.activatePlayerTeam.execute).not.toHaveBeenCalled();
  });
});
