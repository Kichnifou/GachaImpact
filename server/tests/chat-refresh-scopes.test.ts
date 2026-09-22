import { describe, expect, it } from 'vitest';
import { scopesForOperation } from '../src/application/chat/chat-refresh-scopes.js';

describe('Chat scopes from confirmed server operations', () => {
  it('covers Pull and the command mutation owners', () => {
    expect(scopesForOperation('gacha.pull')).toEqual(['resources', 'gacha', 'box', 'inventory', 'dailyChallenge', 'progression']);
    expect(scopesForOperation('bank.deposit')).toEqual(['bank', 'resources']);
    expect(scopesForOperation('wheel.spin')).toEqual(['wheel', 'resources']);
    expect(scopesForOperation('friendship.add')).toEqual(['social', 'resources', 'notifications']);
    expect(scopesForOperation('event.game-c.send')).toContain('event');
    expect(scopesForOperation('box.stella.use')).not.toContain('contest');
  });
  it('does not request owner reads for queries or unknown operations', () => {
    expect(scopesForOperation('chat.send')).toEqual([]);
    expect(scopesForOperation('contest.read')).toEqual([]);
    expect(scopesForOperation('unknown')).toEqual([]);
  });
});
