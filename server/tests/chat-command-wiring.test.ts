import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { chatCommandRegistry } from '../src/application/chat/chat-command-registry.js';

it('requires a physical dispatcher entry for every root advertised as ready in player Help', () => {
  const source = readFileSync(new URL('../src/application/chat/chat-command-dispatcher.ts', import.meta.url), 'utf8');
  const dispatched = new Set(Array.from(source.matchAll(/case '([^']+)':/g), match => match[1]));
  const ready = chatCommandRegistry.filter(command => command.permission === 'PLAYER' && command.internalChat === 'READY');
  expect(ready).toHaveLength(32);
  for (const command of ready) {
    expect(command.handler, command.name).not.toBeNull();
    expect(dispatched.has(command.handler!), command.name).toBe(true);
  }
});
