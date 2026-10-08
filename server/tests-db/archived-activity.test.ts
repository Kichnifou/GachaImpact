import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { permanentMissionCatalog } from '../src/domain/missions/permanent-mission-catalog.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { verifiedPlayerActor } from '../src/application/player/player-execution-actor.js';
import { ExpeditionService } from '../src/application/expedition/expedition-service.js';
import { EventService } from '../src/application/event/event-service.js';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';
import { PrismaBankingStore } from '../src/infrastructure/database/prisma-banking-store.js';
import { EventLifecycleNotificationReconciler } from '../src/application/notification/event-lifecycle-notifications.js';
import { EventMessageNotificationReconciler } from '../src/application/notification/event-message-notifications.js';
import { GiftCodeService } from '../src/application/gift-code/gift-code-service.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const getPlayer = new GetCurrentPlayer({ findByIdentity: async () => null, provision: async () => { throw new Error('No identity provisioning in this fixture'); } });
const random = { nextInt: (maxExclusive: number) => Math.min(maxExclusive - 1, 31) };
let year = 2400;
beforeAll(async () => {
  await fixture.setup({ prismaMigrations: true });
  await db.permanentMissionDefinition.createMany({ data: permanentMissionCatalog.map(entry => ({ ...entry })), skipDuplicates: true });
}, 180_000);
afterAll(async () => {
  await fixture.cleanup();
  const pool = fixture.poolSnapshot();
  expect(pool.total).toBe(0); expect(pool.idle).toBe(0); expect(pool.waiting).toBe(0); expect(pool.opened).toBe(pool.closed);
}, 60_000);

async function profile(now: Date) {
  const player = await db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Archived activity fixture' }, now));
  const active = await db.player.update({ where: { id: player.id }, data: { elementKey: 'hydro' }, select: { id: true, displayName: true, elementKey: true, status: true } });
  const characters = [];
  for (let i = 0; i < 4; i++) {
    const character = await db.character.create({ data: { externalKey: `archive-fixture-${randomUUID()}`, name: 'Private activity character', rarity: 4, elementKey: 'hydro', isActive: true } });
    await db.playerCharacter.create({ data: { playerId: active.id, characterId: character.id, constellation: 0, copies: 1, firstObtainedAt: now } });
    characters.push(character);
  }
  return { ...active, actor: verifiedPlayerActor(active), characters };
}

async function economy(playerId: string) {
  return {
    balances: await db.playerResourceBalance.findMany({ where: { playerId }, orderBy: { resourceKey: 'asc' } }),
    progression: await db.playerProgression.findUniqueOrThrow({ where: { playerId } }),
    operations: await db.businessOperation.count({ where: { playerId } }),
    movements: await db.resourceMovement.count({ where: { playerId } }),
  };
}

it('freezes an abandoned expedition and rejects the preloaded actor without claiming or notifying', async () => {
  let now = new Date(`${++year}-09-15T12:00:00Z`);
  const a = await profile(now), b = await profile(now);
  const service = new ExpeditionService(getPlayer, db, { now: () => now }, random);
  await service.start(a.actor, a.characters[0]!.id, randomUUID());
  const before = await db.playerExpedition.findUniqueOrThrow({ where: { playerId: a.id } });
  const [aEconomy, bEconomy] = await Promise.all([economy(a.id), economy(b.id)]);
  await db.player.update({ where: { id: a.id }, data: { status: 'ARCHIVED' } });
  now = new Date(now.getTime() + 21 * 60 * 60 * 1_000);
  expect((await service.getState(a.actor)).operationalStatus).toBe('RUNNING');
  expect(await service.cleanup(a.id)).toBe(false);
  await expect(service.claim(a.actor, randomUUID())).rejects.toMatchObject({ code: 'PLAYER_ARCHIVED' });
  await expect(service.start(a.actor, a.characters[1]!.id, randomUUID())).rejects.toMatchObject({ code: 'PLAYER_ARCHIVED' });
  expect(await db.playerExpedition.findUniqueOrThrow({ where: { playerId: a.id } })).toEqual(before);
  expect(await db.notification.count({ where: { playerId: a.id } })).toBe(0);
  expect(await economy(a.id)).toEqual(aEconomy); expect(await economy(b.id)).toEqual(bEconomy);
});

it('preserves Event history and skips archived fanout recipients while retaining suspended eligibility', async () => {
  const now = new Date(`${++year}-09-15T12:00:00Z`), clock = { now: () => now };
  const [a, participant, suspended, b] = await Promise.all([profile(now), profile(now), profile(now), profile(now)]);
  const events = new EventService(getPlayer, db, clock, random);
  for (const player of [a, participant, suspended]) await events.join(player.actor, randomUUID());
  const aParticipation = await db.eventParticipant.findFirstOrThrow({ where: { playerId: a.id } });
  const aCurrencies = await db.playerEventCurrencyBalance.findMany({ where: { playerId: a.id } });
  const [aEconomy, bEconomy] = await Promise.all([economy(a.id), economy(b.id)]);
  const notifications = await db.notification.findMany({ where: { playerId: a.id }, orderBy: { id: 'asc' } });
  await db.player.update({ where: { id: a.id }, data: { status: 'ARCHIVED' } });
  await db.player.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
  await expect(events.join(a.actor, randomUUID())).rejects.toMatchObject({ code: 'PLAYER_ARCHIVED' });
  await events.attemptGameB(participant.actor, '11111', randomUUID());
  expect(await db.eventParticipant.findFirstOrThrow({ where: { playerId: a.id } })).toEqual(aParticipation);
  expect(await db.playerEventCurrencyBalance.findMany({ where: { playerId: a.id } })).toEqual(aCurrencies);
  for (const player of [participant, suspended]) expect((await db.eventParticipant.findFirstOrThrow({ where: { playerId: player.id } })).points).toBe(aParticipation.points + 1);
  await new EventLifecycleNotificationReconciler(db, events).reconcileNotificationsForPlayer(a.id, now);
  await new EventMessageNotificationReconciler(db).reconcileNotificationsForPlayer(a.id, now);
  expect(await db.notification.findMany({ where: { playerId: a.id }, orderBy: { id: 'asc' } })).toEqual(notifications);
  expect(await economy(a.id)).toEqual(aEconomy); expect(await economy(b.id)).toEqual(bEconomy);
});

it('keeps Boss contribution proofs and rewards other participants without crediting the archived graph', async () => {
  const now = new Date(`${++year}-09-15T12:00:00Z`), clock = { now: () => now };
  const [a, attacker, suspended, b] = await Promise.all([profile(now), profile(now), profile(now), profile(now)]);
  const boss = new MonthlyBossService(getPlayer, db, clock, random);
  const bossId = await boss.ensureCurrentBoss(now);
  for (const player of [a, attacker]) for (let i = 0; i < 4; i++) await boss.setSlot(player.actor, i + 1, player.characters[i]!.id);
  await boss.attack(a.actor, bossId, randomUUID(), false);
  await db.playerBossParticipation.create({ data: { bossId, playerId: suspended.id, totalDamage: 1n, attackCount: 1n, bestHit: 1n, firstAttackAt: now, lastAttackAt: now } });
  await db.playerBossStats.create({ data: { playerId: suspended.id, totalDamage: 1n, totalAttacks: 1n, totalParticipated: 1n, bestHit: 1n } });
  const participation = await db.playerBossParticipation.findUniqueOrThrow({ where: { bossId_playerId: { bossId, playerId: a.id } } });
  const attacks = await db.bossAttack.findMany({ where: { playerId: a.id }, include: { members: true } });
  const [aEconomy, bEconomy] = await Promise.all([economy(a.id), economy(b.id)]);
  await db.player.update({ where: { id: a.id }, data: { status: 'ARCHIVED' } });
  await db.player.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
  await db.monthlyBoss.update({ where: { id: bossId }, data: { currentHp: 1n } });
  await expect(boss.attack(a.actor, bossId, randomUUID(), false)).rejects.toMatchObject({ code: 'PLAYER_ARCHIVED' });
  await boss.attack(attacker.actor, bossId, randomUUID(), false);
  expect(await db.bossReward.count({ where: { bossId, playerId: a.id } })).toBe(0);
  expect(await db.bossReward.count({ where: { bossId, playerId: { in: [attacker.id, suspended.id] } } })).toBe(2);
  expect(await db.playerBossParticipation.findUniqueOrThrow({ where: { bossId_playerId: { bossId, playerId: a.id } } })).toEqual(participation);
  expect(await db.bossAttack.findMany({ where: { playerId: a.id }, include: { members: true } })).toEqual(attacks);
  expect(await economy(a.id)).toEqual(aEconomy); expect(await economy(b.id)).toEqual(bEconomy);
});

it('skips archived bank accounts without changing suspended interest or historical cursors', async () => {
  const now = new Date(`${++year}-09-15T12:00:00Z`), date = now.toISOString().slice(0, 10), previous = `${now.getUTCFullYear()}-09-14`;
  const [a, active, suspended, absent] = await Promise.all([profile(now), profile(now), profile(now), profile(now)]);
  for (const player of [a, active, suspended]) await db.playerBankAccount.create({ data: { playerId: player.id, balance: 1_000n, lastInterestDate: new Date(`${previous}T00:00:00Z`) } });
  await db.player.updateMany({ where: { id: { in: [a.id, absent.id] } }, data: { status: 'ARCHIVED' } });
  await db.player.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
  const before = await db.playerBankAccount.findUniqueOrThrow({ where: { playerId: a.id } });
  const aEconomy = await economy(a.id);
  const bank = new PrismaBankingStore(db);
  await bank.accrueAllInterestThrough(date, now);
  expect(await db.playerBankAccount.findUniqueOrThrow({ where: { playerId: a.id } })).toEqual(before);
  expect(await db.playerBankAccount.findUnique({ where: { playerId: absent.id } })).toBeNull();
  for (const player of [active, suspended]) expect((await db.playerBankAccount.findUniqueOrThrow({ where: { playerId: player.id } })).balance).toBe(1_030n);
  await expect(bank.getState(a.id, date, now)).rejects.toMatchObject({ code: 'PLAYER_ARCHIVED' });
  expect(await economy(a.id)).toEqual(aEconomy);
});

it('rejects an expedition claim already waiting on an archive and preserves the exact preimage', async () => {
  let now = new Date(`${++year}-09-15T12:00:00Z`);
  const a = await profile(now), service = new ExpeditionService(getPlayer, db, { now: () => now }, random);
  await service.start(a.actor, a.characters[0]!.id, randomUUID());
  now = new Date(now.getTime() + 21 * 60 * 60 * 1_000);
  const before = await db.playerExpedition.findUniqueOrThrow({ where: { playerId: a.id } });
  const beforeEconomy = await economy(a.id);
  let unlock!: () => void, locked!: () => void;
  const hasLock = new Promise<void>(resolve => { locked = resolve; });
  const release = new Promise<void>(resolve => { unlock = resolve; });
  const archive = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM players WHERE id = ${a.id}::uuid FOR UPDATE`;
    locked(); await release;
    await tx.player.update({ where: { id: a.id }, data: { status: 'ARCHIVED' } });
  });
  await hasLock;
  const waiting = service.claim(a.actor, randomUUID());
  const rejected = expect(waiting).rejects.toMatchObject({ code: 'PLAYER_ARCHIVED' });
  try {
    let blocked = false;
    for (let attempt = 0; attempt < 100 && !blocked; attempt++) {
      const result = await fixture.admin.query<{ blocked: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity a JOIN pg_locks l ON l.pid = a.pid
          WHERE a.wait_event_type = 'Lock' AND l.relation = $1::regclass
        ) AS blocked`, [`${fixture.schema}.players`]);
      blocked = result.rows[0]!.blocked;
      if (!blocked) await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(blocked).toBe(true);
  } finally { unlock(); }
  await archive;
  await rejected;
  expect(await db.playerExpedition.findUniqueOrThrow({ where: { playerId: a.id } })).toEqual(before);
  expect(await economy(a.id)).toEqual(beforeEconomy);
  expect(await db.notification.count({ where: { playerId: a.id } })).toBe(0);
});

it('skips stale Gift maintenance for the archived Player and continues creating notices for other Players', async () => {
  const now = new Date(`${++year}-09-15T12:00:00Z`), clock = { now: () => now };
  const [a, active] = await Promise.all([profile(now), profile(now)]);
  const gifts = new GiftCodeService(getPlayer, db, clock, { activePlayerIds: [a.id, active.id] });
  await gifts.reconcileNotificationsForPlayer(a.id, now);
  const notifications = await db.notification.findMany({ where: { playerId: a.id }, orderBy: { id: 'asc' } });
  expect(notifications.length).toBeGreaterThan(0);
  const before = await economy(a.id);
  await db.player.update({ where: { id: a.id }, data: { status: 'ARCHIVED' } });
  // This is the candidate retained by a scheduler before the archive committed.
  await gifts.reconcileNotificationsForPlayer(a.id, now, false);
  await gifts.reconcileAllActivePlayers(now);
  expect(await db.notification.findMany({ where: { playerId: a.id }, orderBy: { id: 'asc' } })).toEqual(notifications);
  expect(await db.notification.count({ where: { playerId: active.id, domainKey: 'gift-codes' } })).toBeGreaterThan(0);
  expect(await economy(a.id)).toEqual(before);
});
