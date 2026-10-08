import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { bootstrapPlayer } from '../src/infrastructure/database/player-bootstrap.js';
import { canonicalizationOwnedTables } from '../src/application/twitch/player-canonicalization-safety.js';
import { registerErrorHandler } from '../src/api/error-handler.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
beforeAll(async () => {
  const url = new URL(process.env['DATABASE_URL'] ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error('Local PostgreSQL required');
  await fixture.setup({ prismaMigrations: true });
}, 180_000);
afterAll(async () => {
  await fixture.cleanup();
  const pool = fixture.poolSnapshot();
  expect(pool).toMatchObject({ total: 0, idle: 0, waiting: 0 }); expect(pool.opened).toBe(pool.closed);
}, 60_000);
const player = () => db.$transaction(tx => bootstrapPlayer(tx, { displayName: 'Synthetic archive fixture' }));

it('covers every canonical personal table and access identity with an enabled physical guard', async () => {
  const result = await fixture.admin.query<{ table_name: string }>(`SELECT c.relname table_name FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND t.tgname='archived_player_write_guard' AND t.tgenabled='O'`, [fixture.schema]);
  expect(result.rows.map(row => row.table_name).sort()).toEqual([...canonicalizationOwnedTables, 'web_identities', 'twitch_identities'].sort());
});

it('refuses a stale transaction after archive and rolls back its changes to an unrelated player', async () => {
  const a = await player(), peer = await player();
  const before = await db.playerResourceBalance.findMany({ where: { playerId: { in: [a.id, peer.id] } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] });
  let ready!: () => void, resume!: () => void;
  const read = new Promise<void>(resolve => { ready = resolve; }), archived = new Promise<void>(resolve => { resume = resolve; });
  const stale = db.$transaction(async tx => {
    expect((await tx.player.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('ACTIVE');
    ready(); await archived;
    await tx.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: peer.id, resourceKey: 'primogems' } }, data: { amount: { increment: 100n } } });
    await tx.playerResourceBalance.update({ where: { playerId_resourceKey: { playerId: a.id, resourceKey: 'primogems' } }, data: { amount: { increment: 100n } } });
  }, { isolationLevel: 'ReadCommitted', timeout: 15_000 });
  // Observe rejection immediately, including when a hook fails.
  const refused = expect(stale).rejects.toThrow('PLAYER_ARCHIVED');
  await read;
  try { await db.player.update({ where: { id: a.id }, data: { status: 'ARCHIVED' } }); } finally { resume(); }
  await refused;
  expect(await db.playerResourceBalance.findMany({ where: { playerId: { in: [a.id, peer.id] } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] })).toEqual(before);
});

it('protects indirect ownership, both sides of ownership changes, preferences and identities', async () => {
  const a = await player(), b = await player();
  const character = await db.character.create({ data: { externalKey: randomUUID(), name: 'Synthetic', rarity: 5, elementKey: 'pyro' } });
  const team = await db.team.create({ data: { playerId: a.id, displayPosition: 1, name: 'Preserved', members: { create: { position: 1, characterId: character.id } } } });
  const before = await db.team.findUniqueOrThrow({ where: { id: team.id }, include: { members: true } });
  await db.player.update({ where: { id: a.id }, data: { status: 'ARCHIVED' } });
  await expect(db.teamMember.update({ where: { teamId_position: { teamId: team.id, position: 1 } }, data: { position: 2 } })).rejects.toThrow('PLAYER_ARCHIVED');
  await expect(db.team.update({ where: { id: team.id }, data: { playerId: b.id } })).rejects.toThrow('PLAYER_ARCHIVED');
  await expect(db.playerPreference.create({ data: { playerId: a.id, preferenceKey: 'private.fixture', value: true } })).rejects.toThrow('PLAYER_ARCHIVED');
  await expect(db.webIdentity.create({ data: { playerId: a.id, provider: 'fixture', providerSubject: randomUUID() } })).rejects.toThrow('PLAYER_ARCHIVED');
  await expect(db.player.update({ where: { id: a.id }, data: { status: 'ACTIVE' } })).rejects.toThrow('PLAYER_ARCHIVED');
  expect(await db.team.findUniqueOrThrow({ where: { id: team.id }, include: { members: true } })).toEqual(before);
});

it('also refuses direct SQL while leaving the separate SUSPENDED policy unchanged', async () => {
  const a = await player(), b = await player();
  await db.player.update({ where: { id: a.id }, data: { status: 'ARCHIVED' } });
  await expect(db.$executeRaw`UPDATE player_progression SET xp=xp+1 WHERE player_id=${a.id}::uuid`).rejects.toThrow('PLAYER_ARCHIVED');
  await db.player.update({ where: { id: b.id }, data: { status: 'SUSPENDED' } });
  await db.playerProgression.update({ where: { playerId: b.id }, data: { xp: 30n } });
  expect((await db.playerProgression.findUniqueOrThrow({ where: { playerId: b.id } })).xp).toBe(30n);
});

it('returns a controlled API conflict for a physical guard rejection without SQL or identity details', async () => {
  const a = await player(), app = Fastify();
  await db.player.update({ where: { id: a.id }, data: { status: 'ARCHIVED' } });
  registerErrorHandler(app);
  app.post('/synthetic-stale-action', () => db.playerProgression.update({ where: { playerId: a.id }, data: { xp: 50n } }));
  try {
    const response = await app.inject({ method: 'POST', url: '/synthetic-stale-action' });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({ code: 'PLAYER_ARCHIVED', message: 'Cette progression n’est plus active.' });
    expect(response.body).not.toContain(a.id); expect(response.body).not.toContain('UPDATE'); expect(response.body).not.toContain('Prisma');
  } finally { await app.close(); }
});

it('pins indirect ownership against a concurrent reparent-and-archive and drains any deadlock victim', async () => {
  const a = await player(), b = await player();
  const character = await db.character.create({ data: { externalKey: randomUUID(), name: 'Synthetic race', rarity: 5, elementKey: 'pyro' } });
  const team = await db.team.create({ data: { playerId: a.id, displayPosition: 1, members: { create: { position: 1, characterId: character.id } } } });
  let ready!: () => void, resume!: () => void;
  const locked = new Promise<void>(resolve => { ready = resolve; }), go = new Promise<void>(resolve => { resume = resolve; });
  const reparent = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM players WHERE id=${a.id}::uuid FOR UPDATE`;
    ready(); await go;
    await tx.team.update({ where: { id: team.id }, data: { playerId: b.id } });
    await tx.player.update({ where: { id: b.id }, data: { status: 'ARCHIVED' } });
  }, { isolationLevel: 'ReadCommitted', timeout: 15_000 });
  // Collect either victim immediately; both operations are always awaited.
  const parentSettled = Promise.allSettled([reparent]);
  await locked;
  const mutation = db.$transaction(tx => tx.teamMember.update({ where: { teamId_position: { teamId: team.id, position: 1 } }, data: { position: 2 } }), { isolationLevel: 'ReadCommitted', timeout: 15_000 });
  const childSettled = Promise.allSettled([mutation]);
  let waiting = false;
  try {
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      const result = await fixture.admin.query<{ waiting: boolean }>(`SELECT EXISTS(
        SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%team_members%' AND query NOT LIKE '%pg_stat_activity%'
      ) waiting`);
      waiting = result.rows[0]!.waiting;
      if (!waiting) await new Promise(resolve => setTimeout(resolve, 10));
    }
  } finally { resume(); }
  const [parent, child] = await Promise.all([parentSettled, childSettled]);
  expect(waiting).toBe(true);
  // Without the parent's SHARE lock both would commit: the child checked A,
  // then wrote into a team already reassigned to archived B.
  expect([parent[0]!.status, child[0]!.status]).not.toEqual(['fulfilled', 'fulfilled']);
  const currentTeam = await db.team.findUniqueOrThrow({ where: { id: team.id }, include: { members: true } });
  const currentB = await db.player.findUniqueOrThrow({ where: { id: b.id } });
  if (parent[0]!.status === 'fulfilled') {
    expect(currentB.status).toBe('ARCHIVED'); expect(currentTeam.playerId).toBe(b.id); expect(currentTeam.members[0]!.position).toBe(1);
  } else {
    expect(currentB.status).toBe('ACTIVE'); expect(currentTeam.playerId).toBe(a.id);
  }
}, 30_000);
