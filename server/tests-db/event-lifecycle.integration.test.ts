import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { EventService } from '../src/application/event/event-service.js';
import { GiftCodeService } from '../src/application/gift-code/gift-code-service.js';
import { EventLifecycleNotificationReconciler } from '../src/application/notification/event-lifecycle-notifications.js';
import type { GetCurrentPlayer } from '../src/application/player/get-current-player.js';

const fixture = isolatedBatchDatabase();
const { database, admin } = fixture;
let now = new Date('2026-09-15T12:00:00Z');
const getPlayer = { execute: async (identity: { subject: string }) => ({ id: identity.subject }) } as GetCurrentPlayer;
const codes = new GiftCodeService(getPlayer, database, { now: () => now });
const events = new EventService(getPlayer, database, { now: () => now }, { nextInt: () => 0 }, codes);
const notifications = new EventLifecycleNotificationReconciler(database, events);
beforeAll(async () => {
  await fixture.setup();
  const definitions = (await admin.query('SELECT * FROM public.event_definitions WHERE calendar_month IN (9,10)')).rows;
  for (const row of definitions) await database.eventDefinition.create({ data: { externalKey: row.external_key, displayName: row.display_name, calendarMonth: row.calendar_month, currencyKey: row.currency_key, config: row.config } });
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);

describe('Event lifecycle isolated PostgreSQL', () => {
  it('delivers once per player/edition including midmonth, survives archive and concurrent polling', async () => {
    const player = await database.player.create({ data: { displayName: 'Lifecycle fixture' } });
    await Promise.all([notifications.reconcileNotificationsForPlayer(player.id, now), notifications.reconcileNotificationsForPlayer(player.id, now)]);
    const arrival = await database.notification.findFirstOrThrow({ where: { playerId: player.id } });
    expect(arrival).toMatchObject({ typeKey: 'EVENT_EDITION_AVAILABLE', actionKey: 'OPEN_EVENT' });
    expect(await database.notification.count({ where: { playerId: player.id } })).toBe(1);
    await database.notification.update({ where: { id: arrival.id }, data: { state: 'ARCHIVED' } });
    await notifications.reconcileNotificationsForPlayer(player.id, now);
    expect((await database.notification.findUniqueOrThrow({ where: { id: arrival.id } })).state).toBe('ARCHIVED');
    const other = await database.player.create({ data: { displayName: 'Other fixture' } });
    await notifications.reconcileNotificationsForPlayer(other.id, now);
    expect(await database.notification.count()).toBe(2);
    await notifications.reconcileNotificationsForPlayer(player.id, new Date('2026-09-29T21:59:59Z'));
    expect(await database.notification.count({ where: { typeKey: 'EVENT_EDITION_LAST_DAY' } })).toBe(0);
    const lastDay = new Date('2026-09-29T22:00:00Z');
    await notifications.reconcileNotificationsForPlayer(player.id, lastDay);
    await notifications.reconcileNotificationsForPlayer(player.id, lastDay);
    expect(await database.notification.count({ where: { typeKey: 'EVENT_EDITION_LAST_DAY' } })).toBe(1);
    expect(await database.notification.findFirst({ where: { typeKey: 'EVENT_EDITION_LAST_DAY' } })).toMatchObject({ actionKey: 'OPEN_EVENT_SHOP' });
    await notifications.reconcileNotificationsForPlayer(player.id, new Date('2026-09-30T22:00:00Z'));
    expect(await database.notification.count({ where: { playerId: player.id, typeKey: 'EVENT_EDITION_AVAILABLE' } })).toBe(2);
    expect(await database.notification.count({ where: { typeKey: 'EVENT_EDITION_LAST_DAY' } })).toBe(1);
    await notifications.reconcileNotificationsForPlayer(player.id, new Date('2026-10-31T12:00:00Z'));
    expect(await database.notification.count({ where: { typeKey: 'EVENT_EDITION_LAST_DAY' } })).toBe(2);
  }, 60_000);

  it('projects only the system Festival annual code without token or rewards', async () => {
    now = new Date('2026-09-15T12:00:00Z');
    const player = await database.player.create({ data: { displayName: 'Code fixture' } });
    const identity = { subject: player.id };
    expect((await events.getCurrent(identity)).giftCode).toEqual({ available: false });
    const code = await database.giftCode.create({ data: { token: `SYSTEM${randomUUID()}`, title: 'Titre modifié', description: 'Fixture', type: 'ANNUAL', status: 'PUBLISHED', recurringMonth: 9 } });
    await database.giftCode.update({ where: { id: code.id }, data: { token: `RENAMED${randomUUID()}`, title: 'Titre encore modifié' } });
    const current = await events.getCurrent(identity);
    expect(current.giftCode).toEqual({ available: true });
    expect(JSON.stringify(current)).not.toContain(code.token);
    expect(await database.giftCodeClaim.count()).toBe(0);
    expect(await database.playerResourceBalance.count()).toBe(0);
    const edition = await database.giftCodeEdition.findFirstOrThrow({ where: { giftCodeId: code.id } });
    await codes.claim(identity, edition.id, randomUUID());
    expect((await events.getCurrent(identity)).giftCode).toEqual({ available: false });
    expect(await database.giftCodeClaim.count()).toBe(1);
    expect(await database.resourceMovement.count()).toBe(0);
    const admin = await database.player.create({ data: { displayName: 'Admin annual fixture' } });
    await database.giftCode.create({ data: { token: `ADMIN${randomUUID()}`, title: 'Anniversaire septembre', description: 'Admin fixture', type: 'ANNUAL', status: 'PUBLISHED', recurringMonth: 9, createdById: admin.id, updatedById: admin.id } });
    expect((await events.getCurrent(identity)).giftCode).toEqual({ available: false });
  }, 60_000);
});
