import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { EventService } from '../src/application/event/event-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { GetOrProvisionCurrentPlayer } from '../src/application/player/get-or-provision-current-player.js';
import { loadConfig } from '../src/config/environment.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { createDatabase } from '../src/infrastructure/database/prisma-database.js';

const config = loadConfig();
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for Event Shop DB tests.');
const database = createDatabase(config.databaseUrl);
const store = new PrismaCurrentPlayerStore(database);
const provision = new GetOrProvisionCurrentPlayer(store);
let year = 2400;
let now = new Date(`${year}-09-15T12:00:00.000Z`);
const service = new EventService(new GetCurrentPlayer(store), database, { now: () => now }, { nextInt: () => 0 });
const playerIds: string[] = [];
const editionIds: string[] = [];

async function fixture() {
  const identity = { subject: `codex-event-shop-${randomUUID()}` };
  const created = await provision.execute(identity, `Shop ${randomUUID().slice(0, 8)}`);
  playerIds.push(created.player.id);
  const view = await service.getCurrent(identity);
  if (!editionIds.includes(view.edition.id)) editionIds.push(view.edition.id);
  return { identity, playerId: created.player.id, editionId: view.edition.id };
}
async function join(player: Awaited<ReturnType<typeof fixture>>) { return service.join(player.identity, randomUUID()); }
async function setCurrency(playerId: string, amount: bigint) {
  await database.playerEventCurrencyBalance.update({ where: { playerId_eventDefinitionId: { playerId, eventDefinitionId: '00000000-0000-4000-8000-000000000009' } }, data: { amount } });
}
async function resource(playerId: string, key: string) {
  return (await database.playerResourceBalance.findUniqueOrThrow({ where: { playerId_resourceKey: { playerId, resourceKey: key } } })).amount;
}

afterEach(async () => {
  const editions = editionIds.splice(0);
  const players = playerIds.splice(0);
  if (players.length) {
    await database.eventCollectionAcquisition.deleteMany({ where: { playerId: { in: players } } });
    await database.itemAcquisition.deleteMany({ where: { playerId: { in: players }, sourceKey: 'EVENT' } });
    await database.playerItem.deleteMany({ where: { playerId: { in: players } } });
    await database.eventMilestoneClaim.deleteMany({ where: { playerId: { in: players } } });
    await database.eventSocialMessage.deleteMany({ where: { OR: [{ senderPlayerId: { in: players } }, { recipientPlayerId: { in: players } }] } });
    await database.eventDailyPlayerState.deleteMany({ where: { playerId: { in: players } } });
    await database.eventParticipant.deleteMany({ where: { playerId: { in: players } } });
    await database.playerEventCurrencyBalance.deleteMany({ where: { playerId: { in: players } } });
    await database.resourceMovement.deleteMany({ where: { playerId: { in: players } } });
    await database.businessOperation.deleteMany({ where: { playerId: { in: players } } });
    await database.webIdentity.deleteMany({ where: { playerId: { in: players } } });
    await database.player.deleteMany({ where: { id: { in: players } } });
  }
  if (editions.length) {
    await database.eventGameBDailyState.deleteMany({ where: { eventEditionId: { in: editions } } });
    await database.eventEdition.deleteMany({ where: { id: { in: editions }, participants: { none: {} } } });
  }
  year += 2;
  now = new Date(`${year}-09-15T12:00:00.000Z`);
});
afterAll(async () => database.$disconnect());

describe('Event Shop persistence', () => {
  it('has a private annual uniqueness guard with indexed foreign keys', async () => {
    const [security] = await database.$queryRaw<Array<{ rls: boolean; anon: boolean; authenticated: boolean }>>`SELECT relrowsecurity AS rls, has_table_privilege('anon', oid, 'SELECT') AS anon, has_table_privilege('authenticated', oid, 'SELECT') AS authenticated FROM pg_class WHERE oid='event_collection_acquisitions'::regclass`;
    expect(security).toEqual({ rls: true, anon: false, authenticated: false });
    const constraints = await database.$queryRaw<Array<{ name: string; definition: string }>>`SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='event_collection_acquisitions'::regclass`;
    expect(constraints.find(({ name }) => name === 'event_collection_acquisitions_pkey')?.definition).toContain('event_edition_id, player_id');
    const indexes = await database.$queryRaw<Array<{ name: string }>>`SELECT indexname AS name FROM pg_indexes WHERE schemaname='public' AND tablename='event_collection_acquisitions'`;
    expect(indexes.map(({ name }) => name)).toEqual(expect.arrayContaining(['event_collection_acquisitions_item_idx', 'event_collection_acquisitions_player_idx', 'event_collection_acquisitions_operation_key', 'event_collection_acquisitions_item_acquisition_key']));
  });

  it('validates participation, quantity, balance, fixed rates, replay and intent conflict', async () => {
    const player = await fixture();
    await expect(service.convertShop(player.identity, 'PRIMOGEMS', 1, randomUUID())).rejects.toMatchObject({ code: 'EVENT_NOT_JOINED' });
    await join(player);
    await expect(service.convertShop(player.identity, 'PRIMOGEMS', 0, randomUUID())).rejects.toThrow();
    await expect(service.convertShop(player.identity, 'MORAS', -1, randomUUID())).rejects.toThrow();
    await expect(service.convertShop(player.identity, 'MORAS', 2, randomUUID())).rejects.toMatchObject({ code: 'EVENT_SHOP_INSUFFICIENT_CURRENCY' });
    const primosBefore = await resource(player.playerId, 'primogems');
    const morasBefore = await resource(player.playerId, 'moras');
    const key = randomUUID();
    const first = await service.convertShop(player.identity, 'PRIMOGEMS', 1, key);
    expect(first.shop.balance).toBe('0');
    expect(await resource(player.playerId, 'primogems')).toBe(primosBefore + 160n);
    expect((await service.convertShop(player.identity, 'PRIMOGEMS', 1, key)).operation).toEqual({ id: first.operation.id, alreadyProcessed: true });
    await expect(service.convertShop(player.identity, 'MORAS', 1, key)).rejects.toMatchObject({ code: 'EVENT_SHOP_IDEMPOTENCY_CONFLICT' });
    await setCurrency(player.playerId, 8n);
    const multiPrimos = await service.convertShop(player.identity, 'PRIMOGEMS', 3, randomUUID());
    expect(multiPrimos.shop.balance).toBe('5');
    const singleMoras = await service.convertShop(player.identity, 'MORAS', 1, randomUUID());
    expect(singleMoras.shop.balance).toBe('4');
    const multiMoras = await service.convertShop(player.identity, 'MORAS', 4, randomUUID());
    expect(multiMoras.shop.balance).toBe('0');
    expect(await resource(player.playerId, 'primogems')).toBe(primosBefore + 640n);
    expect(await resource(player.playerId, 'moras')).toBe(morasBefore + 100_000n);
    expect(await database.resourceMovement.count({ where: { playerId: player.playerId, causeKey: 'event.shop.convert' } })).toBe(4);
  }, 90_000);

  it('rolls back the Event debit when the economy credit overflows', async () => {
    const player = await fixture(); await join(player);
    await database.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: player.playerId, resourceKey: 'primogems' } }, data: { amount: 9_223_372_036_854_775_807n } });
    await expect(service.convertShop(player.identity, 'PRIMOGEMS', 1, randomUUID())).rejects.toThrow();
    expect((await service.getCurrent(player.identity)).shop.balance).toBe('1');
    expect(await database.businessOperation.count({ where: { playerId: player.playerId, operationType: 'event.shop.convert' } })).toBe(0);
  }, 90_000);

  it('serializes competing conversions against the same durable balance', async () => {
    const player = await fixture(); await join(player); await setCurrency(player.playerId, 1n);
    const before = await resource(player.playerId, 'primogems');
    const outcomes = await Promise.allSettled([service.convertShop(player.identity, 'PRIMOGEMS', 1, randomUUID()), service.convertShop(player.identity, 'PRIMOGEMS', 1, randomUUID())]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect((await service.getCurrent(player.identity)).shop.balance).toBe('0');
    expect(await resource(player.playerId, 'primogems')).toBe(before + 160n);
  }, 90_000);

  it('buys one real Collection item per annual edition and retains old currency', async () => {
    const player = await fixture();
    await expect(service.purchaseCollection(player.identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_NOT_JOINED' });
    await join(player);
    await expect(service.purchaseCollection(player.identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_SHOP_INSUFFICIENT_CURRENCY' });
    await setCurrency(player.playerId, 160n);
    const key = randomUUID();
    const first = await service.purchaseCollection(player.identity, key);
    expect(first.shop).toMatchObject({ balance: '80', collection: { obtainedThisEdition: true } });
    expect((await service.purchaseCollection(player.identity, key)).operation).toEqual({ id: first.operation.id, alreadyProcessed: true });
    await expect(service.purchaseCollection(player.identity, randomUUID())).rejects.toMatchObject({ code: 'EVENT_COLLECTION_ALREADY_OBTAINED' });
    const item = await database.itemDefinition.findUniqueOrThrow({ where: { externalKey: 'gerbe_de_recolte' } });
    expect((await database.playerItem.findUniqueOrThrow({ where: { playerId_itemId: { playerId: player.playerId, itemId: item.id } } })).quantity).toBe(1n);
    expect(await database.itemAcquisition.count({ where: { playerId: player.playerId, itemId: item.id, sourceKey: 'EVENT' } })).toBe(1);
    now = new Date(`${year + 1}-09-15T12:00:00.000Z`);
    const next = await service.getCurrent(player.identity);
    editionIds.push(next.edition.id);
    expect(next.shop).toMatchObject({ balance: '80', collection: { obtainedThisEdition: false } });
    await service.join(player.identity, randomUUID());
    const second = await service.purchaseCollection(player.identity, randomUUID());
    expect(second.shop.collection.obtainedThisEdition).toBe(true);
    expect((await database.playerItem.findUniqueOrThrow({ where: { playerId_itemId: { playerId: player.playerId, itemId: item.id } } })).quantity).toBe(2n);
    expect(await database.itemAcquisition.count({ where: { playerId: player.playerId, itemId: item.id, sourceKey: 'EVENT' } })).toBe(2);
  }, 90_000);

  it('serializes concurrent Collection purchases without a duplicate item', async () => {
    const player = await fixture(); await join(player); await setCurrency(player.playerId, 160n);
    const outcomes = await Promise.allSettled([service.purchaseCollection(player.identity, randomUUID()), service.purchaseCollection(player.identity, randomUUID())]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect((await service.getCurrent(player.identity)).shop.balance).toBe('80');
    expect(await database.eventCollectionAcquisition.count({ where: { playerId: player.playerId, eventEditionId: player.editionId } })).toBe(1);
  }, 90_000);
});
