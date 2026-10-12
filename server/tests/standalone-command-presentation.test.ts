import { describe, expect, it } from 'vitest';
import { harness, actor, commandId } from './helpers/chat-command-harness.js';
import { isStructuredChatResult } from '../src/domain/chat/structured-result.js';
import { PlayerCommandResolver, type ChatCommandServices } from '../src/application/chat/player-command-resolver.js';
import type { GlobalChatService } from '../src/application/chat/global-chat-service.js';

const character = { id: 'five', name: 'A', rarity: 5, elementKey: 'pyro', constellation: 1, iconPath: '/assets/characters/a.png' };
function setup() {
  const h = harness(), { services: s } = h;
  const pull = s.performGachaPullChat.execute.getMockImplementation()!;
  s.performGachaPullChat.execute.mockImplementation(async () => { const result = await pull(); Object.assign(result.results[0]!.character, character); return result; });
  const teams = s.getCurrentPlayerTeams.execute.getMockImplementation()!;
  s.getCurrentPlayerTeams.execute.mockImplementation(async () => { const result = await teams(); Object.assign(result.teams[0]!.slots[0]!.character, character); return result; });
  s.useMasterlessStella.execute.mockResolvedValue({ character, stellaRemaining: 2n, operation: { id: 'stella-op', alreadyProcessed: false } } as never);
  const legends = s.socialService.legends.getMockImplementation()!;
  s.socialService.legends.mockImplementation(async () => { const result = await legends(); Object.assign(result.data.legends[0]!.character, character, { name: 'Étoile' }); return result; });
  s.expeditionService.getState.mockResolvedValue({ operationalStatus: 'RUNNING', departureUsedToday: true, canStartToday: false, activeCharacter: character, readyAt: new Date('2026-10-13T12:00:00Z'), remainingSeconds: 3600 } as never);
  return h;
}
const cases = ['!pull 1', '!team', '!banniere', '!expedition', '!legende moi Étoile', '!obtention A', '!vote Candidat', '!stella A'];
describe('Eight standalone result adapters', () => {
  it.each(cases)('projects %s and preserves the complete Twitch text', async command => {
    const h = setup();
    const twitch = await new PlayerCommandResolver(h.chat as unknown as GlobalChatService, h.services as unknown as ChatCommandServices, 'TWITCH').resolve(actor, command, commandId);
    expect(h.chat.freezeCommandResult).not.toHaveBeenCalled(); expect(h.chat.publishGameResult).not.toHaveBeenCalled();
    const content = await h.send(command);
    const frozen = h.chat.freezeCommandResult.mock.calls[0]![1];
    expect(isStructuredChatResult(frozen.presentation)).toBe(true);
    expect(frozen.presentation!.source.commandMessageId).toBe(commandId);
    expect(frozen.content).toEqual(twitch);
    expect(content).toBe(typeof twitch === 'string' ? twitch : twitch[0]);
  });
  it('retries publication from the frozen receipt without applying Stella twice', async () => {
    const h = setup();
    h.chat.publishGameResult.mockRejectedValueOnce(new Error('publication interrupted'));
    await expect(h.send('!stella A')).rejects.toThrow('publication interrupted');
    const frozen = h.chat.freezeCommandResult.mock.calls[0]![1];
    h.chat.readCommandResult.mockResolvedValue(frozen as never);
    await h.send('!stella A');
    expect(h.services.useMasterlessStella.execute).toHaveBeenCalledTimes(1);
    expect(h.chat.freezeCommandResult).toHaveBeenCalledTimes(1);
    expect(h.chat.publishGameResult.mock.calls[1]?.[1]).toEqual(frozen.content);
  });
  it('keeps private and untargeted Legends textual', async () => {
    const h = setup(); await h.send('!legende');
    expect(h.chat.freezeCommandResult.mock.calls[0]![1].presentation).toBeNull();
    h.services.socialService.legends.mockResolvedValueOnce({ access: 'PRIVATE' } as never);
    await h.send('!legende Autre Étoile');
    expect(h.chat.freezeCommandResult.mock.calls[1]![1].presentation).toBeNull();
  });
});
