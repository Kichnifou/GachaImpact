import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import type { AuthenticatedIdentity } from '../src/domain/identity/authenticated-identity.js';
import { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';

describe('pilot snapshot apply gate', () => {
  it('does not begin a transaction when a physical domain still lacks a replacement mapping', async () => {
    const transaction = vi.fn();
    const service = new SnapshotPilotService({ $transaction: transaction, migrationRun: { findUnique: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient,
      {} as TwitchPilotService, 'private-test-preview-secret');
    const internals = service as unknown as { context: () => Promise<unknown>; report: () => Promise<unknown>;
      previewSignature: (id: string, playerId: string, hash: string, expiresAt: number) => Buffer };
    const playerId = randomUUID();
    internals.context = vi.fn().mockResolvedValue({ player: { id: playerId }, linked: { login: 'kichnifou' }, snapshot: { hash: 'hash', sources: {} }, viewer: { data: {} } });
    internals.report = vi.fn().mockResolvedValue({ domains: [{ name: 'Gacha / pity', category: 'PLAYER_LOCAL_PHYSICAL', action: 'PENDING_MAPPING' }] });
    const id = randomUUID();
    const expiresAt = Date.now() + 60_000;
    const previewId = `${id}.${expiresAt}.${internals.previewSignature(id, playerId, 'hash', expiresAt).toString('base64url')}`;
    await expect(service.apply({} as AuthenticatedIdentity, {}, previewId)).rejects.toMatchObject({ code: 'SNAPSHOT_MAPPING_INCOMPLETE' });
    expect(transaction).not.toHaveBeenCalled();
  });
});
