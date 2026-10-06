import { describe, expect, it } from 'vitest';
import { chatCommandRegistry, chatHelp, chatHelpCategories, commandHelp, findChatCommand } from '../src/application/chat/chat-command-registry.js';

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
    expect(chatHelp('twitch')).toContain('uniquement sur Twitch');
    expect(chatHelp('twitch')).toContain('!giveaway');
    expect(chatHelp('progression')).not.toContain('!xp');
    expect(chatHelp('inconnue')).toBe('Aide inconnue. Utilise !help pour voir les catégories.');
  });

  it('keeps Contest help opaque before the public reveal', () => {
    expect(findChatCommand('concours')).toMatchObject({ internalChat: 'READY', syntax: '!concours' });
    expect(chatHelp('concours')).toContain('!concours');
    expect(chatHelp('events')).toContain('!concours');
    expect(chatHelp('concours')).not.toContain('open');
    expect(chatHelp('concours')).toContain('prochainement disponible');
    for (const help of [chatHelp('concours'), chatHelp('events')]) {
      expect(help).not.toMatch(/interface|standalone|https?:\/\/|#activities|Activités >/iu);
    }
  });

  it('publishes the canonical Mission help without advertising the resume alias', () => {
    expect(findChatCommand('mission')).toMatchObject({ internalChat: 'READY', syntax: '!mission [B|A|S|Z]' });
    expect(chatHelp('activites')).toContain('!mission');
    expect(chatHelp('mission')).toContain('!mission [B|A|S|Z]');
    expect(chatHelp('mission')).not.toContain('resume');
  });
});

it('makes Favor available in standalone Help',()=>{expect(findChatCommand('faveur')).toMatchObject({internalChat:'READY',handler:'faveur'});expect(chatHelp('progression')).toContain('!faveur');expect(chatHelp('faveur')).toContain('!faveur [pseudo]')});

it('describes all 34 roots honestly, prioritizes root aliases and keeps the rate recommendation', () => {
  for (const command of chatCommandRegistry) { expect(command.summary.length).toBeGreaterThan(10); expect(chatHelp(command.name)).toContain(command.syntax); }
  for (const root of ['box', 'shop', 'top']) expect(chatHelp(root)).toContain(findChatCommand(root)!.summary);
  expect(chatHelp('TOP')).toContain('!top taux5');
  expect(chatHelp('wish')).toContain('Twitch uniquement');
  expect(chatHelp('giveaway')).not.toContain('reroll');
  expect(chatHelp()).toBe('Aide : progression · gacha · ressources · collection · equipe · activites · social · events · classements · twitch. Utilise !help <categorie> ou !help <commande>.');
});

it('keeps unavailable and administrator definitions out of usable player help', () => {
  const definition = findChatCommand('legende')!;
  for (const internalChat of ['NOT_PHYSICAL', 'NOT_CONNECTED'] as const) {
    const output = commandHelp({ ...definition, internalChat });
    expect(output).toContain('pas disponible');
    expect(output).not.toContain(definition.syntax);
  }
  expect(commandHelp({ ...definition, permission: 'ADMIN' })).toContain('Aide inconnue');
});

it('resolves all ten categories against the real player registry', () => {
  for (const category of chatHelpCategories) {
    const output = chatHelp(category);
    for (const definition of chatCommandRegistry.filter(c => c.category === category && c.permission === 'PLAYER')) {
      if (definition.internalChat === 'READY' || (category === 'twitch' && definition.internalChat === 'TWITCH_ONLY')) expect(output).toContain('!' + definition.name);
    }
    expect(output).not.toContain('!gift');
    expect(output).not.toContain('!xp');
  }
});

it('keeps banner aliases canonical and removes Ami list from help', () => {
  for (const token of ['banniere', 'bannière', 'ban', '!BAN']) {
    expect(findChatCommand(token)).toMatchObject({ name: 'banniere', syntax: '!banniere' });
    expect(chatHelp(token)).toContain('!banniere.');
  }
  expect(findChatCommand('banner')).toBeUndefined();
  expect(chatHelp('ami')).not.toContain('liste');
});
