import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import { scopesForOperation } from '../src/application/chat/chat-refresh-scopes.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';

describe('Chat scopes from confirmed server operations', () => {
  it('covers Pull and the command mutation owners', () => {
    expect(scopesForOperation('gacha.pull')).toEqual(['resources', 'gacha', 'box', 'inventory', 'dailyChallenge', 'progression', 'teams', 'dailyCombat', 'monthlyBoss', 'contest']);
    expect(scopesForOperation('bank.deposit')).toEqual(['bank', 'resources']);
    expect(scopesForOperation('wheel.spin')).toEqual(['wheel', 'resources']);
    expect(scopesForOperation('friendship.add')).toEqual(['social', 'resources', 'notifications']);
    expect(scopesForOperation('event.game-c.send')).toContain('event');
    expect(scopesForOperation('box.stella.use')).toEqual(['box', 'inventory', 'resources', 'teams', 'dailyCombat', 'monthlyBoss', 'contest']);
  });
  it('does not request owner reads for queries or unknown operations', () => {
    expect(scopesForOperation('chat.send')).toEqual([]);
    expect(scopesForOperation('contest.read')).toEqual([]);
    expect(scopesForOperation('unknown')).toEqual([]);
  });
  it.each(['gacha.pull', 'box.stella.use'])('recovers %s scopes from the persisted command operation on replay', async (operationType) => {
    const commandId = '11111111-1111-4111-8111-111111111111';
    const playerId = '22222222-2222-4222-8222-222222222222';
    const database = {
      globalChatMessage: { findUnique: vi.fn(async () => ({ authorPlayerId: playerId, operationId: 'send-operation' })) },
      businessOperation: {
        findUniqueOrThrow: vi.fn(async () => ({ resultSummary: { refreshScopes: [] } })),
        findMany: vi.fn(async () => [{ operationType }]),
      },
    } as unknown as PrismaClient;
    const service = new GlobalChatService(database, {} as GetCurrentPlayer, { now: () => new Date() }, { nextInt: () => 0 });
    const first = await service.commandRefreshScopes(commandId);
    const replay = await service.commandRefreshScopes(commandId);
    expect(first).toEqual(scopesForOperation(operationType));
    expect(replay).toEqual(first);
    expect(database.businessOperation.findMany).toHaveBeenCalledWith({ where: { playerId, status: 'COMPLETED', operationType: { not: 'chat.send' }, OR: [{ idempotencyKey: commandId }, { idempotencyKey: { endsWith: `:${commandId}` } }] }, select: { operationType: true } });
  });
});
