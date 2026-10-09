import { expect, it } from 'vitest';
import { harness, actor } from './helpers/chat-command-harness.js';
import { PlayerCommandResolver, type ChatCommandServices } from '../src/application/chat/player-command-resolver.js';
import { withPlayerCommandExecution } from '../src/application/player/player-command-execution.js';

it.each([false, true])('formats four executed snapshot members intact, with 450 mention-inclusive continuations (long=%s)', async long => {
  const { chat, services } = harness();
  const names = ['Yoimiya', 'Chiori', 'Yae Miko', 'Neuvillette'].map(name => long ? `${name} ${'étoile 👩🏽‍🚀 '.repeat(5)}`.trim() : name);
  services.monthlyBossService.attackWithActiveTeam.mockResolvedValueOnce({ result: { damage: 5300n, defeated: true,
    members: names.map((name, index) => ({ characterNameSnapshot: name, elementKeySnapshot: ['pyro', 'geo', 'electro', 'hydro'][index]!, constellationSnapshot: index })) },
    view: { boss: { name: 'Spectre de la Nuit Sans Fin', currentHp: 0n, maxHp: 490000n }, reward: { primogems: 2000n, moras: 40000n } } } as never);
  const resolver = new PlayerCommandResolver(chat as never, services as unknown as ChatCommandServices, 'TWITCH');
  const output = await withPlayerCommandExecution({ source: 'TWITCH', now: new Date(), responseBodyLimit: 439 }, () => resolver.resolve(actor, '!combat boss go', 'private-boss-command'));
  const parts = typeof output === 'string' ? [output] : output;
  expect(parts.every(part => Array.from(`@Kichnifou ${part}`).length <= 450)).toBe(true);
  expect(parts[0]).toContain('inflige 5 300 DMG à Spectre de la Nuit Sans Fin');
  expect(parts.join(' ')).toContain('grâce à sa team [');
  names.forEach((name, index) => expect(parts.filter(part => part.includes(`${name} (C${index})`))).toHaveLength(1));
  expect(parts.join(' ')).toContain('❤️ PV restants : 0/490 000');
  expect(parts.join(' ')).toContain('👑 Boss vaincu !');
  if (long) { expect(parts.length).toBeGreaterThan(1); expect(parts.slice(1).every(part => part.startsWith('⚔️ Boss (suite) :'))).toBe(true); }
});
