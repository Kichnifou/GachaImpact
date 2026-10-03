import { expect, it, vi } from 'vitest';
import { SocialService } from '../src/application/social/social-service.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';

it('checks Box for a list, Box and Statistics for details, and never fetches private C6 data', async () => {
  const database = { player: { count: vi.fn(async () => 1) }, playerCharacter: { findMany: vi.fn(async () => [{ characterId: 'char', character: { id: 'char', name: 'C6' } }]) }, c6CompetitionProgress: { findMany: vi.fn(async () => []) } };
  const getPlayer = { execute: vi.fn(async () => ({ id: 'viewer', status: 'ACTIVE' })) };
  const service = new SocialService(getPlayer as unknown as GetCurrentPlayer, database as unknown as PrismaClient, { now: () => new Date() });
  const permissions = vi.spyOn(service.privacy, 'permissions');
  permissions.mockResolvedValue({ BOX: false, GENERAL_STATISTICS: true } as never);
  expect(await service.legends({ subject: 'viewer' }, 'owner', false)).toEqual({ access: 'PRIVATE' });
  expect(database.playerCharacter.findMany).not.toHaveBeenCalled();
  expect(database.c6CompetitionProgress.findMany).not.toHaveBeenCalled();
  permissions.mockResolvedValue({ BOX: true, GENERAL_STATISTICS: false } as never);
  expect(await service.legends({ subject: 'viewer' }, 'owner', true)).toEqual({ access: 'PRIVATE' });
  expect(database.playerCharacter.findMany).not.toHaveBeenCalled();
  expect(await service.legends({ subject: 'viewer' }, 'owner', false)).toEqual({ access: 'ALLOWED', data: { characters: [{ id: 'char', name: 'C6' }], legends: [] } });
  expect(database.c6CompetitionProgress.findMany).not.toHaveBeenCalled();
  permissions.mockResolvedValue({ BOX: true, GENERAL_STATISTICS: true } as never);
  await service.legends({ subject: 'viewer' }, 'owner', true);
  expect(database.c6CompetitionProgress.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { playerId: 'owner', characterId: { in: ['char'] } } }));
});
