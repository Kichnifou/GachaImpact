import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import type { AuthenticatedIdentity } from '../src/domain/identity/authenticated-identity.js';
import { SnapshotPilotService } from '../src/application/migration/snapshot-pilot-service.js';

describe('pilot snapshot apply gate', () => {
  it('does not begin a transaction when a physical domain still lacks a replacement mapping', async () => {
    const transaction = vi.fn();
    const service = new SnapshotPilotService({ $transaction: transaction } as unknown as PrismaClient, {} as TwitchPilotService, 'private-test-preview-secret');
    const internals = service as unknown as { context: () => Promise<unknown>; report: () => Promise<unknown> };
    internals.context = vi.fn().mockResolvedValue({ player: { id: 'pilot' }, linked: { login: 'kichnifou' }, snapshot: { hash: 'hash', sources: {} }, viewer: { data: {} } });
    internals.report = vi.fn().mockResolvedValue({ domains: [{ name: 'Gacha / pity', category: 'PLAYER_LOCAL_PHYSICAL', action: 'PENDING_MAPPING' }] });
    await expect(service.apply({} as AuthenticatedIdentity, {}, 'preview')).rejects.toMatchObject({ code: 'SNAPSHOT_MAPPING_INCOMPLETE' });
    expect(transaction).not.toHaveBeenCalled();
  });
});
