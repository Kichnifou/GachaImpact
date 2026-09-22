import { describe, expect, it } from 'vitest';
import { chatCommandRegistry, chatHelp, findChatCommand } from '../src/application/chat/chat-command-registry.js';

describe('Chat command registry', () => {
  it('contains every canonical root once and never invents retired commands', () => {
    expect(chatCommandRegistry).toHaveLength(34);
    expect(new Set(chatCommandRegistry.map(command => command.name)).size).toBe(34);
    for (const name of ['xp', 'gift', 'subscription', 'mp']) expect(findChatCommand(name)).toBeUndefined();
  });

  it('resolves case, accents and aliases, and gives command priority over categories', () => {
    expect(findChatCommand('BANNIÈRE')?.name).toBe('banniere');
    expect(findChatCommand('INFO')?.name).toBe('infos');
    expect(chatHelp('box')).toContain('!box');
    expect(chatHelp('ressources')).toContain('!banque');
    expect(chatHelp('ressources')).toContain('!echanger');
  });

  it('lists ten validated categories without exposing Twitch-only or unavailable commands as usable', () => {
    expect(chatHelp()).toContain('twitch');
    expect(chatHelp('twitch')).not.toContain('!giveaway');
    expect(chatHelp('progression')).not.toContain('!xp');
    expect(chatHelp('inconnue')).toBe('Commande inconnue. Utilise !help.');
  });
});
