import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';

describe('idle global chat updates', () => {
  it.each([10, 30])('does not hydrate unchanged messages for %i simultaneous readers', async clients => {
    const id = '11111111-1111-4111-8111-111111111111';
    const now = new Date('2026-10-16T12:00:00Z');
    const row = { id, createdAt: now, submissionOrder: 1n, deletionState: 'ACTIVE' };
    const findMany = vi.fn(async (args: { where: { deletionState?: unknown }; include?: unknown }) => args.where.deletionState ? [] : [row]);
    const database = {
      globalChatState: { findUnique: vi.fn(async () => ({ generation: 0 })) },
      globalChatMessage: { findMany },
      $queryRaw: vi.fn(async () => [{ id }]),
    } as unknown as PrismaClient;
    const player = { execute: vi.fn(async () => ({ id })) } as unknown as GetCurrentPlayer;
    const service = new GlobalChatService(database, player, { now: () => now }, { nextInt: () => 0 });
    const responses = await Promise.all(Array.from({ length: clients }, () => service.updates({ subject: id }, 0, { id, createdAt: now.toISOString() }, [id])));
    expect(responses.every(value => !value.reset && !value.messages.length && !value.changes.length)).toBe(true);
    expect(findMany.mock.calls.filter(([args]) => args.include)).toHaveLength(0);
  });
});
