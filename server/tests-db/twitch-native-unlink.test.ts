import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from '../src/application/twitch/twitch-native-authority.js';
import { TwitchPilotService } from '../src/application/twitch/twitch-pilot-service.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import type { AuthenticatedIdentity } from '../src/domain/identity/authenticated-identity.js';
import type { TwitchEventSubSubscriptionManager } from '../src/application/twitch/twitch-eventsub-subscription-manager.js';
const fixture = isolatedBatchDatabase(), db = fixture.database;
let operatorId: string;
const config = { host: 'localhost', port: 3001, supabase: {}, twitchCommandPilot: { enabled: true, globalEnabled: true },
  twitch: { pilotPlayerIds: [] as string[], pilotLogin: 'kichnifou' } };
beforeAll(async () => {
  await fixture.setup({ seedPublicCatalog: true });
  const operator = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Private unlink operator',
    twitchIdentity: { twitchUserId: '950000000001', login: 'kichnifou', displayName: 'Fixture', firstSeenAt: new Date() } }));
  operatorId = operator.id; config.twitch.pilotPlayerIds.push(operatorId);
  await db.playerRoleAssignment.create({ data: { playerId: operatorId, role: 'ADMIN', source: 'private-unlink' } });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);
it('keeps identity/desired authority/consumers in CANARY and GLOBAL, fails closed on DB errors, permits unlink after auditable OFF', async () => {
  const authority = new TwitchNativeAuthority(db, config);
  const manager = { managementAvailable: true, unlinkPilotIdentity: vi.fn(async (_id: string, remove: () => Promise<void>) => remove()) };
  const service = new TwitchPilotService(db, { execute: async () => ({ id: operatorId }) } as unknown as GetCurrentPlayer, config, undefined, manager as unknown as TwitchEventSubSubscriptionManager);
  const identity = { subject: randomUUID() } as AuthenticatedIdentity;
  for (const mode of ['CANARY','GLOBAL'] as const) {
    await authority.configure(operatorId, mode, mode === 'CANARY' ? ['950000000001'] : [], STREAMERBOT_PATH_DISABLED);
    const before = await db.twitchNativeAuthority.findUniqueOrThrow({ where: { id: 'twitch-commands' } });
    await expect(service.unlink(identity)).rejects.toMatchObject({ code: 'TWITCH_NATIVE_AUTHORITY_UNLINK_BLOCKED' });
    expect(await db.twitchIdentity.count({ where: { playerId: operatorId } })).toBe(1);
    expect(await db.twitchNativeAuthority.findUniqueOrThrow({ where: { id: 'twitch-commands' } })).toEqual(before);
    expect(manager.unlinkPilotIdentity).not.toHaveBeenCalled();
  }
  const fail = vi.spyOn(db.twitchNativeAuthority, 'findUnique').mockRejectedValueOnce(new Error('private authority unavailable'));
  await expect(service.unlink(identity)).rejects.toThrow('private authority unavailable'); fail.mockRestore();
  expect(await db.twitchIdentity.count({ where: { playerId: operatorId } })).toBe(1);
  expect(manager.unlinkPilotIdentity).not.toHaveBeenCalled();
  await authority.configure(operatorId, 'OFF', []);
  expect(await db.twitchNativeAudit.count({ where: { actorPlayerId: operatorId, action: 'KILL_SWITCH' } })).toBe(1);
  await expect(service.unlink(identity)).resolves.toEqual({ linked: false });
  expect(await db.twitchIdentity.count({ where: { playerId: operatorId } })).toBe(0);
  expect(manager.unlinkPilotIdentity).toHaveBeenCalledOnce();
}, 90_000);
