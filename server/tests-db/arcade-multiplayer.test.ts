import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { PrismaPlayerXpService } from '../src/infrastructure/database/prisma-player-xp-service.js';
import { ArcadeService } from '../src/application/arcade/arcade-service.js';
import { ArcadeRecords } from '../src/application/arcade/arcade-records.js';
import { PresenceService } from '../src/application/social/presence-service.js';
import { NotificationService } from '../src/application/notification/notification-service.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { performancePoints } from '../src/domain/arcade/points.js';
import { createLineGame } from '../src/domain/arcade/line-games.js';
import type { ArcadeGame, ArcadeDifficulty, MemoryState, ArcadeState } from '../src/domain/arcade/types.js';
import type { ExpeditionService } from '../src/application/expedition/expedition-service.js';
import { Prisma } from '../generated/prisma/client.js';
import * as memoryAi from '../src/domain/arcade/memory-ai.js';
import * as lineAi from '../src/domain/arcade/line-ai.js';

const isolated = isolatedBatchDatabase(), db = isolated.database;
let now = new Date('2099-10-03T12:00:00Z');
const clock = { now: () => new Date(now) }, getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db));
const xp = new PrismaPlayerXpService(), service = new ArcadeService(db, getPlayer, clock, xp, () => 42);
const presence = new PresenceService(db, clock);
const notifications = new NotificationService(getPlayer, db, clock, { getState: async () => ({}) } as unknown as ExpeditionService, undefined, undefined, undefined, service.invitations);
beforeAll(async () => {
  await isolated.setup({ prismaMigrations: true });
  await isolated.admin.query('INSERT INTO characters SELECT * FROM public.characters');
}, 180000);
afterAll(() => isolated.cleanup(), 60000);
async function player(online = true) {
  const identity = { subject: 'arcade-multiplayer-' + randomUUID() };
  const row = await db.player.create({ data: { displayName: 'Arcade ' + randomUUID().slice(0, 8), elementKey: 'hydro',
    webIdentity: { create: { provider: 'supabase', providerSubject: identity.subject } },
    progression: { create: { xp: 299n } }, economyStats: { create: {} }, resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) } } });
  if (online) await presence.touch(row.id, randomUUID(), true, true);
  return { id: row.id, identity };
}
type Player = Awaited<ReturnType<typeof player>>;
it('does not reserve an invitation or notify a staged recovery opponent', async () => {
  const sender = await player(), recipient = await player();
  await db.player.update({ where: { id: recipient.id }, data: { legacyRecovery: { version: 1, operationId: randomUUID(), importId: randomUUID(),
    snapshotHash: 'a'.repeat(64), populationHash: 'b'.repeat(64), backupHash: 'c'.repeat(64), restrictedDomains: ['EVENT','BOSS','GIVEAWAY'] } } });
  await expect(invite(sender, recipient)).rejects.toMatchObject({ code: 'PLAYER_RECOVERY_NOT_ACTIVATED' });
  expect(await db.arcadeInvitation.count({ where: { guestPlayerId: recipient.id } })).toBe(0);
  expect(await db.notification.count({ where: { playerId: recipient.id, typeKey: 'ARCADE_INVITE' } })).toBe(0);
});
const tick = () => { now = new Date(now.getTime() + 1000); };
async function invite(a: Player, b: Player, game: ArcadeGame = 'TIC_TAC_TOE', difficulty: ArcadeDifficulty = 'MEDIUM') {
  tick();
  return service.invite(a.identity, { opponentPlayerId: b.id, game, difficulty, friendsOnly: false, idempotencyKey: randomUUID() });
}
async function ready(a: Player, b: Player, game: ArcadeGame = 'TIC_TAC_TOE', difficulty: ArcadeDifficulty = 'MEDIUM') {
  const challenge = await invite(a, b, game, difficulty);
  await service.actInvitation(b.identity, challenge.invitation.id, { kind: 'READY', idempotencyKey: randomUUID() });
  return (await service.overview(a.identity)).sessions.find(row => row.status === 'ACTIVE')!;
}
async function act(p: Player, id: string, kind: 'MOVE' | 'ADVANCE' | 'QUIT', position = 0) {
  tick(); const row = await service.session(p.identity, id);
  return service.act(p.identity, id, { ...(kind === 'MOVE' ? { kind, position } : { kind }), expectedVersion: row.version, idempotencyKey: randomUUID() });
}
async function economy(ids: string[]) {
  return {
    progression: await db.playerProgression.findMany({ where: { playerId: { in: ids } }, orderBy: { playerId: 'asc' } }),
    balances: await db.playerResourceBalance.findMany({ where: { playerId: { in: ids } }, orderBy: [{ playerId: 'asc' }, { resourceKey: 'asc' }] }),
    economy: await db.playerEconomyStats.findMany({ where: { playerId: { in: ids } }, orderBy: { playerId: 'asc' } }),
    movements: await db.resourceMovement.count({ where: { playerId: { in: ids } } }),
    missions: await db.playerPermanentMissionProgress.count({ where: { playerId: { in: ids } } }),
    cosmetics: await db.playerCosmetic.count({ where: { playerId: { in: ids } } }),
  };
}
async function nearFinish(id: string, game: ArcadeGame) {
  const row = await db.arcadeSession.findUniqueOrThrow({ where: { id } });
  let state: ArcadeState, move: number;
  if (game === 'MEMORY') {
    const memory = row.privateState as unknown as MemoryState;
    const face = memory.cards.find(Boolean)!;
    const cards = memory.cards.map(card => card ? face : null);
    const matched = memory.matched.map((_, index) => cards[index] ? index < 6 ? 'AI' as const : 'PLAYER' as const : null);
    const remaining = cards.flatMap((card, index) => card ? [index] : []).slice(-2);
    remaining.forEach(index => { matched[index] = null; });
    const total = memory.layout!.totalPairs;
    state = { ...memory, cards, matched, revealed: [remaining[0]!], playerPairs: total - 4, aiPairs: 3, phase: 'PICK', turn: 'PLAYER', outcome: null };
    move = remaining[1]!;
  } else {
    const line = createLineGame(game, 'PLAYER');
    if (game === 'TIC_TAC_TOE') { line.cells = ['PLAYER','PLAYER',null,'AI','AI',null,null,null,null]; move = 2; }
    else { line.cells[35] = 'PLAYER'; line.cells[36] = 'PLAYER'; line.cells[37] = 'PLAYER'; line.cells[28] = 'AI'; line.cells[29] = 'AI'; move = 3; }
    state = line;
  }
  await db.arcadeSession.update({ where: { id }, data: { privateState: JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue, nextActionAt: now } });
  return move;
}

describe('Arcade multiplayer — private migrated PostgreSQL', () => {
  it('Memory draw records both players equally; a guest line win inverts the host result', async () => {
    const a = await player(), b = await player(), memory = await ready(a, b, 'MEMORY', 'EASY');
    const move = await nearFinish(memory.id, 'MEMORY');
    const stored = await db.arcadeSession.findUniqueOrThrow({ where: { id: memory.id } });
    const state = stored.privateState as unknown as MemoryState;
    const matched = state.matched.map((owner, position) => owner === null ? null : position < 8 ? 'AI' : 'PLAYER');
    await db.arcadeSession.update({ where: { id: memory.id }, data: { privateState: { ...state, matched, playerPairs: 3, aiPairs: 4 } as unknown as Prisma.InputJsonValue } });
    const draw = await act(a, memory.id, 'MOVE', move);
    expect(draw.session.result).toMatchObject({ outcome: 'DRAW', xpAwarded: 0 });
    expect((await service.session(b.identity, memory.id)).result).toEqual(draw.session.result);
    for (const p of [a, b]) expect(await db.arcadeStat.findUniqueOrThrow({ where: { playerId_game_difficulty: { playerId: p.id, game: 'MEMORY', difficulty: 'EASY' } } })).toMatchObject({ draws: 1n, played: 1n, bestPairs: 4 });
    const line = await ready(a, b);
    const board = createLineGame('TIC_TAC_TOE', 'AI');
    board.cells = ['AI', 'AI', null, 'PLAYER', 'PLAYER', null, null, null, null];
    await db.arcadeSession.update({ where: { id: line.id }, data: { privateState: board as unknown as Prisma.InputJsonValue } });
    const guest = await act(b, line.id, 'MOVE', 2);
    expect(guest.session.result).toMatchObject({ outcome: 'WIN', xpAwarded: 0 });
    expect((await service.session(a.identity, line.id)).result).toMatchObject({ outcome: 'LOSS', xpAwarded: 0 });
    expect(guest.session.result!.scoreAwarded).toBeGreaterThan(0);
    const physical = await db.arcadeSession.findUniqueOrThrow({ where: { id: line.id } });
    const balances = await db.playerResourceBalance.findMany({ where: { playerId: b.id }, orderBy: { resourceKey: 'asc' } });
    await db.player.update({ where: { id: a.id }, data: { status: 'ARCHIVED' } });
    const archivedOpponent = await service.session(b.identity, line.id);
    expect(archivedOpponent.opponent).toEqual({ id: a.id, displayName: 'Progression archivée' });
    expect(archivedOpponent.participants?.PLAYER).toEqual({ id: a.id, displayName: 'Progression archivée' });
    expect(archivedOpponent.result?.outcome).toBe('WIN');
    expect(await db.arcadeSession.findUniqueOrThrow({ where: { id: line.id } })).toEqual(physical);
    expect(await db.playerResourceBalance.findMany({ where: { playerId: b.id }, orderBy: { resourceKey: 'asc' } })).toEqual(balances);
  }, 60000);
  it('expiry racing Ready at the deadline never starts; orphaned notifications lose their action', async () => {
    const a = await player(), b = await player(), first = await invite(a, b);
    now = new Date(first.invitation.expiresAt);
    await Promise.allSettled([service.overview(a.identity), service.actInvitation(b.identity, first.invitation.id, { kind: 'READY', idempotencyKey: randomUUID() })]);
    expect((await db.arcadeInvitation.findUniqueOrThrow({ where: { id: first.invitation.id } })).status).toBe('EXPIRED');
    expect(await db.arcadeSession.count({ where: { playerId: a.id } })).toBe(0);
    const orphan = await db.notification.create({ data: { playerId: b.id, domainKey: 'arcade', typeKey: 'ARCADE_INVITE', actionKey: 'OPEN_ARCADE_INVITE', actionTargetId: randomUUID(), deduplicationKey: randomUUID(), payload: {} } });
    await service.overview(b.identity);
    expect((await db.notification.findUniqueOrThrow({ where: { id: orphan.id } })).state).toBe('RESOLVED');
  }, 60000);
  it('deploys the exact repository migrations; enforces FKs, mode, pending and receipt guards with RLS', async () => {
    expect(isolated.migrationStatus).toContain('up to date');
    const migrations = await isolated.admin.query('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name');
    const expected = readdirSync(new URL('../prisma/migrations/', import.meta.url), { withFileTypes: true }).filter(row => row.isDirectory()).map(row => row.name).sort();
    expect(migrations.rows.map(row => row.migration_name)).toEqual(expected);
    expect(expected).toContain('20261003180000_060_add_arcade_multiplayer');
    const guards = await isolated.admin.query("SELECT relrowsecurity, has_table_privilege('anon', oid, 'SELECT') AS anon_read, has_table_privilege('authenticated', oid, 'INSERT') AS user_write FROM pg_class WHERE relnamespace = $1::regnamespace AND relname = 'arcade_invitations'", [isolated.schema]);
    expect(guards.rows[0]).toEqual({ relrowsecurity: true, anon_read: false, user_write: false });
    const a = await player(), b = await player(), c = await invite(a,b);
    await expect(db.arcadeInvitation.create({ data: { hostPlayerId: a.id, guestPlayerId: randomUUID(), game: 'TIC_TAC_TOE', difficulty: 'MEDIUM', createdAt: now, expiresAt: new Date(+now + 120000) } })).rejects.toThrow();
    await expect(db.arcadeInvitation.update({ where: { id: c.invitation.id }, data: { guestPlayerId: a.id } })).rejects.toThrow();
    await expect(db.arcadeInvitation.update({ where: { id: c.invitation.id }, data: { expiresAt: new Date(+now + 121000) } })).rejects.toThrow();
    await expect(db.arcadeInvitation.update({ where: { id: c.invitation.id }, data: { status: 'STARTED' } })).rejects.toThrow();
  });
  it('filters ONLINE authorized eligible opponents, both block directions, friends and reservations', async () => {
    const a = await player(), online = await player(), away = await player(), offline = await player(false), hidden = await player(), blocked = await player(), blocker = await player(), inactive = await player(), noElement = await player(), solo = await player(), reserved = await player(), reserving = await player(), pvpA = await player(), pvpB = await player();
    await db.playerSession.updateMany({ where: { playerId: away.id }, data: { startedAt: new Date(+now - 12 * 60000), lastActivityAt: new Date(+now - 11 * 60000) } });
    await db.privacySetting.create({ data: { playerId: hidden.id, categoryKey: 'PRESENCE', level: 'PRIVATE' } });
    await db.playerBlock.createMany({ data: [{ blockerPlayerId: a.id, blockedPlayerId: blocked.id }, { blockerPlayerId: blocker.id, blockedPlayerId: a.id }] });
    await db.player.update({ where: { id: inactive.id }, data: { status: 'SUSPENDED' } });
    await db.player.update({ where: { id: noElement.id }, data: { elementKey: null } });
    await service.start(solo.identity, { game: 'MEMORY', difficulty: 'EASY', expectedVersion: 0, previousSessionId: null, idempotencyKey: randomUUID() });
    await invite(reserving, reserved); await ready(pvpA,pvpB);
    const ids = (await service.opponents(a.identity, false)).opponents.map(row => row.id);
    expect(ids).toContain(online.id);
    for (const excluded of [a,away,offline,hidden,blocked,blocker,inactive,noElement,solo,reserved,reserving,pvpA,pvpB]) expect(ids).not.toContain(excluded.id);
    const [first,second] = [a.id,online.id].sort();
    await db.friendship.create({ data: { playerAId: first!, playerBId: second!, state: 'ACTIVE' } });
    const friends = await service.opponents(a.identity,true);
    expect(friends.opponents).toEqual([{ id: online.id, displayName: (await db.player.findUniqueOrThrow({ where: { id: online.id } })).displayName }]);
  }, 60000);
  it('notifies only the initial invitation, resolves cancel/refuse silently, and rejects changed intent', async () => {
    const a = await player(), b = await player(), outsider = await player();
    const input = { opponentPlayerId: b.id, game: 'CONNECT_FOUR' as const, difficulty: 'HARD' as const, friendsOnly: false, idempotencyKey: randomUUID() };
    const first = await service.invite(a.identity,input), again = await service.invite(a.identity,input);
    expect(await db.notification.count({where:{playerId:b.id,typeKey:'ARCADE_INVITE'}})).toBe(1);
    expect(again).toEqual({ ...first, alreadyProcessed: true });
    expect(first.invitation).toMatchObject({ hostReady: true, guestReady: false, game: 'CONNECT_FOUR', difficulty: 'HARD', direction: 'OUTGOING', status: 'PENDING' });
    expect((await service.overview(b.identity)).invitation).toMatchObject({ id: first.invitation.id, direction: 'INCOMING' });
    await expect(service.invite(a.identity,{ ...input, difficulty:'EASY' })).rejects.toMatchObject({ code:'ARCADE_IDEMPOTENCY_CONFLICT' });
    await expect(service.actInvitation(outsider.identity, first.invitation.id,{kind:'READY',idempotencyKey:randomUUID()})).rejects.toMatchObject({ statusCode:404 });
    await expect(service.actInvitation(a.identity, first.invitation.id,{kind:'READY',idempotencyKey:randomUUID()})).rejects.toMatchObject({ statusCode:403 });
    const cancel = {kind:'CANCEL' as const,idempotencyKey:randomUUID()};
    const cancelled = await service.actInvitation(a.identity,first.invitation.id,cancel);
    expect(await service.actInvitation(a.identity,first.invitation.id,cancel)).toEqual({...cancelled,alreadyProcessed:true});
    expect(await db.arcadeSession.count({where:{playerId:a.id}})).toBe(0);
    expect(await db.notification.count({where:{playerId:a.id}})).toBe(0);
    expect((await db.notification.findFirstOrThrow({where:{playerId:b.id,typeKey:'ARCADE_INVITE'}})).state).toBe('RESOLVED');
    const next = await invite(a,b); const refuse={kind:'REFUSE' as const,idempotencyKey:randomUUID()};
    await service.actInvitation(b.identity,next.invitation.id,refuse); await service.actInvitation(b.identity,next.invitation.id,refuse);
    expect(await db.notification.count({where:{playerId:a.id}})).toBe(0);
    expect(await db.notification.count({where:{playerId:b.id}})).toBe(2);
    expect((await db.notification.findFirstOrThrow({where:{playerId:b.id,actionTargetId:next.invitation.id}})).state).toBe('RESOLVED');
    expect((await service.overview(a.identity)).invitation).toBeNull();
    expect((await service.overview(b.identity)).invitation).toBeNull();
  },60000);
  it('expires exactly at two minutes from notifications or overview and never starts at stale Ready', async () => {
    const a=await player(),b=await player(),first=await invite(a,b);
    now=new Date(Date.parse(first.invitation.expiresAt)-1);
    expect((await service.overview(a.identity)).invitation?.id).toBe(first.invitation.id);
    now=new Date(+now+1);
    expect((await notifications.list(b.identity)).notifications).toEqual([]);
    expect(await db.notification.count({where:{playerId:{in:[a.id,b.id]}}})).toBe(1);
    expect((await service.overview(a.identity)).invitation).toBeNull();
    await expect(service.actInvitation(b.identity,first.invitation.id,{kind:'READY',idempotencyKey:randomUUID()})).rejects.toMatchObject({code:'ARCADE_INVITATION_STALE'});
    const c=await player(),d=await player(),second=await invite(c,d);
    now=new Date(second.invitation.expiresAt);
    expect(await service.actInvitation(d.identity,second.invitation.id,{kind:'READY',idempotencyKey:randomUUID()})).toMatchObject({unavailable:true,invitation:{status:'EXPIRED'}});
    expect(await db.arcadeSession.count({where:{playerId:{in:[a.id,c.id]}}})).toBe(0);
  },60000);
  it.each(['block','inactive'] as const)('invalidates %s after invitation without a new notification',async reason=>{
    const a=await player(),b=await player(),first=await invite(a,b);
    if(reason==='block')await db.playerBlock.create({data:{blockerPlayerId:a.id,blockedPlayerId:b.id}});
    else await db.player.update({where:{id:a.id},data:{status:'SUSPENDED'}});
    const response=await service.actInvitation(b.identity,first.invitation.id,{kind:'READY',idempotencyKey:randomUUID()});
    expect(response).toMatchObject({unavailable:true,invitation:{status:'INVALIDATED'}});
    expect(await db.arcadeSession.count({where:{playerId:a.id}})).toBe(0);
    expect((await db.notification.findFirstOrThrow({where:{playerId:b.id}})).state).toBe('RESOLVED');
  });
  it('starts once offscreen and retains first side, participants, context and privacy-safe board on reload',async()=>{
    const a=await player(),b=await player(),first=await invite(a,b,'MEMORY','EASY');
    await db.playerSession.updateMany({where:{playerId:a.id},data:{endedAt:now}});
    const input={kind:'READY' as const,idempotencyKey:randomUUID()};
    const [r1,r2]=await Promise.all([service.actInvitation(b.identity,first.invitation.id,input),service.actInvitation(b.identity,first.invitation.id,input)]);
    expect(r1.invitation.sessionId).toBe(r2.invitation.sessionId);
    expect(r1.session).toMatchObject({ id: r1.invitation.sessionId, mode: 'MULTIPLAYER', viewerSide: 'AI', participants: { PLAYER: { id: a.id }, AI: { id: b.id } } });
    expect(r2.session).toEqual(r1.session);
    const aa=(await service.overview(a.identity)).sessions[0]!,bb=await service.session(b.identity,aa.id);
    expect(aa).toMatchObject({mode:'MULTIPLAYER',viewerSide:'PLAYER',game:'MEMORY',difficulty:'EASY',banter:{text:''}});
    expect(bb).toMatchObject({id:aa.id,viewerSide:'AI',firstSide:aa.firstSide,participants:aa.participants,board:aa.board});
    expect(bb.board.kind).toBe('MEMORY');
    if(bb.board.kind==='MEMORY')bb.board.cards.forEach(card=>expect(card).toEqual({position:card.position,status:'HIDDEN'}));
    const serialized=JSON.stringify(bb);expect(serialized).not.toMatch(/randomState|observations|providerSubject|email|privateState/);
    expect(await db.arcadeSession.count({where:{playerId:a.id}})).toBe(1);
    expect(await db.notification.count({where:{playerId:a.id}})).toBe(0);
    expect(await db.notification.count({where:{playerId:b.id}})).toBe(1);
    expect((await db.notification.findFirstOrThrow({where:{playerId:b.id}})).state).toBe('RESOLVED');
  },60000);
  it.each(['MEMORY','CONNECT_FOUR','TIC_TAC_TOE'] as const)('%s enforces both human turns, stale versions and no AI; two simultaneous moves commit once',async game=>{
    const a=await player(),b=await player(),s=await ready(a,b,game,'EASY');
    const memorySpy=vi.spyOn(memoryAi,'chooseMemoryCard'),lineSpy=vi.spyOn(lineAi,'chooseLineMove');
    try{
      const mover=s.board.turn==='PLAYER'?a:b,other=mover===a?b:a;
      await expect(act(other,s.id,'MOVE')).rejects.toMatchObject({code:'ARCADE_ILLEGAL_MOVE'});
      await expect(act(mover,s.id,'ADVANCE')).rejects.toMatchObject({code:'ARCADE_ILLEGAL_MOVE'});
      tick();
      const move={kind:'MOVE' as const,position:0,expectedVersion:0,idempotencyKey:randomUUID()};
      const results=await Promise.allSettled([service.act(mover.identity,s.id,move),service.act(mover.identity,s.id,{...move,idempotencyKey:randomUUID()})]);
      expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
      expect((await service.session(other.identity,s.id)).version).toBe(1);
      await expect(service.act(other.identity,s.id,{...move,idempotencyKey:randomUUID()})).rejects.toMatchObject({code:'ARCADE_STALE_VERSION'});
      expect(memorySpy).not.toHaveBeenCalled();expect(lineSpy).not.toHaveBeenCalled();
    }finally{memorySpy.mockRestore();lineSpy.mockRestore();}
  },60000);
  it('Memory mismatch reveal waits, hides once concurrently, then gives the other human a turn',async()=>{
    const a=await player(),b=await player(),s=await ready(a,b,'MEMORY','MEDIUM');
    const privateState=(await db.arcadeSession.findUniqueOrThrow({where:{id:s.id}})).privateState as unknown as MemoryState;
    const positions=privateState.cards.flatMap((card,index)=>card?[index]:[]),p1=positions[0]!,p2=positions.find(index=>privateState.cards[index]!.id!==privateState.cards[p1]!.id)!;
    const mover=s.board.turn==='PLAYER'?a:b,other=mover===a?b:a;
    await act(mover,s.id,'MOVE',p1);const revealed=await act(mover,s.id,'MOVE',p2);
    expect(revealed.session.board).toMatchObject({phase:'REVEAL',turn:s.board.turn});
    expect(Date.parse(revealed.session.nextActionAt) - now.getTime()).toBe(500);
    const early={kind:'ADVANCE' as const,expectedVersion:revealed.session.version,idempotencyKey:randomUUID()};
    await expect(service.act(other.identity,s.id,early)).rejects.toMatchObject({code:'ARCADE_TOO_EARLY'});
    tick(); const results=await Promise.allSettled([service.act(mover.identity,s.id,early),service.act(other.identity,s.id,{...early,idempotencyKey:randomUUID()})]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect((await service.session(other.identity,s.id)).board).toMatchObject({phase:'PICK',turn:s.board.turn==='PLAYER'?'AI':'PLAYER'});
  },60000);
  it.each(['MEMORY','CONNECT_FOUR','TIC_TAC_TOE'] as const)('%s all difficulties score both relative outcomes and records, with absolutely zero XP/economy/grants',async game=>{
    const a=await player(),b=await player(),spy=vi.spyOn(xp,'grant');
    try{
      const before=await economy([a.id,b.id]);
      for(const difficulty of ['EASY','MEDIUM','HARD'] as const){
        const s=await ready(a,b,game,difficulty),move=await nearFinish(s.id,game),result=await act(a,s.id,'MOVE',move),guest=await service.session(b.identity,s.id);
        expect(result.session.result).toMatchObject({outcome:'WIN',xpAwarded:0});expect(result.award).toBeNull();
        expect(guest.result).toMatchObject({outcome:'LOSS',xpAwarded:0});
        const pairs=game==='MEMORY'?(difficulty==='EASY'?5:difficulty==='MEDIUM'?9:15):0;
        expect(result.session.result!.scoreAwarded).toBe(performancePoints(game,difficulty,'WIN',pairs,2));
        expect(guest.result!.scoreAwarded).toBe(performancePoints(game,difficulty,'LOSS',game==='MEMORY'?3:0,2));
        for(const p of [a,b])expect((await new ArcadeRecords(db).list(p.id,{kind:'GLOBAL',game,difficulty,page:1})).entries.map(row=>row.playerId)).toContain(p.id);
      }
      expect(spy).not.toHaveBeenCalled();expect(await economy([a.id,b.id])).toEqual(before);
      expect(await db.arcadeDailyGrant.count({where:{playerId:{in:[a.id,b.id]}}})).toBe(0);
      expect(await db.arcadeStat.count({where:{playerId:{in:[a.id,b.id]},game}})).toBe(6);
      const summary=await service.overview(a.identity);expect(summary.daily.every(row=>!row.used)).toBe(true);
      expect(BigInt(summary.scores[game])).toBeGreaterThan(0n);
      // The very same quota remains available to the next solo natural finish.
      const solo = await service.start(a.identity, { game, difficulty: 'HARD', previousSessionId: summary.sessions.find(row => row.game === game)!.id, expectedVersion: 0, idempotencyKey: randomUUID() });
      const move = await nearFinish(solo.session.id, game), finished = await act(a, solo.session.id, 'MOVE', move);
      expect(finished.session.result!.xpAwarded).toBeGreaterThan(0);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(await db.arcadeDailyGrant.count({ where: { playerId: a.id, game } })).toBe(1);
    }finally{spy.mockRestore();}
  },120000);
  it.each(['host','guest'] as const)('Quit by %s abandons shared state, releases both, has no stats/rewards and remains idempotent',async who=>{
    const a=await player(),b=await player(),s=await ready(a,b),p=who==='host'?a:b,before=await economy([a.id,b.id]);
    const input={kind:'QUIT' as const,expectedVersion:s.version,idempotencyKey:randomUUID()};
    const result=await service.act(p.identity,s.id,input);
    expect(await service.act(p.identity,s.id,input)).toEqual({...result,alreadyProcessed:true});
    expect((await service.overview(who==='host'?b.identity:a.identity)).sessions[0]).toMatchObject({status:'ABANDONED',result:null});
    expect(await economy([a.id,b.id])).toEqual(before);
    expect(await db.arcadeStat.count({where:{playerId:{in:[a.id,b.id]}}})).toBe(0);
    expect(await db.arcadeDailyGrant.count({where:{playerId:{in:[a.id,b.id]}}})).toBe(0);
    expect(await db.notification.count({where:{playerId:{in:[a.id,b.id]}}})).toBe(1);
    expect((await invite(b,a)).invitation.status).toBe('PENDING');
  },60000);
  it('serializes A→B/B→A and blocks all cross-role solo or third-player invitations',async()=>{
    const a=await player(),b=await player(),c=await player();tick();
    const results=await Promise.allSettled([invite(a,b),invite(b,a)]);
    expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(1);
    expect(await db.arcadeInvitation.count({where:{status:'PENDING',OR:[{hostPlayerId:a.id},{hostPlayerId:b.id}]}})).toBe(1);
    for(const p of [a,b]){
      await expect(service.start(p.identity,{game:'MEMORY',difficulty:'HARD',expectedVersion:0,previousSessionId:null,idempotencyKey:randomUUID()})).rejects.toMatchObject({code:'ARCADE_ACTIVE_EXISTS'});
      await expect(invite(c,p)).rejects.toMatchObject({code:'ARCADE_OPPONENT_UNAVAILABLE'});
    }
  },60000);
  it.each(['CANCEL','REFUSE'] as const)('concurrent %s and Ready/cancel leave one terminal invitation and at most one session',async kind=>{
    const a=await player(),b=await player(),first=await invite(a,b);
    const results=await Promise.allSettled([service.actInvitation(kind==='CANCEL'?a.identity:b.identity,first.invitation.id,{kind,idempotencyKey:randomUUID()}),service.actInvitation(kind==='CANCEL'?b.identity:a.identity,first.invitation.id,{kind:kind==='CANCEL'?'READY':'CANCEL',idempotencyKey:randomUUID()})]);
    expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(1);
    const row=await db.arcadeInvitation.findUniqueOrThrow({where:{id:first.invitation.id}});
    expect(row.status).not.toBe('PENDING');expect(await db.arcadeSession.count({where:{playerId:a.id}})).toBe(row.status==='STARTED'?1:0);
  },60000);
  it('double Ready with different keys starts once; quit vs last move has exactly one authoritative result',async()=>{
    const a=await player(),b=await player(),first=await invite(a,b);
    const readyResults=await Promise.allSettled([service.actInvitation(b.identity,first.invitation.id,{kind:'READY',idempotencyKey:randomUUID()}),service.actInvitation(b.identity,first.invitation.id,{kind:'READY',idempotencyKey:randomUUID()})]);
    expect(readyResults.filter(row=>row.status==='fulfilled')).toHaveLength(1);
    const s=(await service.overview(a.identity)).sessions[0]!,move=await nearFinish(s.id,'TIC_TAC_TOE');tick();
    const results=await Promise.allSettled([service.act(a.identity,s.id,{kind:'MOVE',position:move,expectedVersion:s.version,idempotencyKey:randomUUID()}),service.act(b.identity,s.id,{kind:'QUIT',expectedVersion:s.version,idempotencyKey:randomUUID()})]);
    expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(1);
    const row=await db.arcadeSession.findUniqueOrThrow({where:{id:s.id}}),stats=await db.arcadeStat.count({where:{playerId:{in:[a.id,b.id]}}});
    expect(['FINISHED','ABANDONED']).toContain(row.status);expect(stats).toBe(row.status==='FINISHED'?2:0);
  },60000);
  it('new manual PvP invitations after a result reserve once and still require an available opponent',async()=>{
    const a=await player(),b=await player(),s=await ready(a,b),move=await nearFinish(s.id,'TIC_TAC_TOE');await act(a,s.id,'MOVE',move);
    const input={game:s.game,difficulty:s.difficulty,friendsOnly:false};
    const results=await Promise.allSettled([service.invite(a.identity,{...input,opponentPlayerId:b.id,idempotencyKey:randomUUID()}),service.invite(b.identity,{...input,opponentPlayerId:a.id,idempotencyKey:randomUUID()})]);
    expect(results.filter(row=>row.status==='fulfilled')).toHaveLength(1);
    expect(await db.arcadeSession.count({where:{playerId:a.id}})).toBe(1);
    const invitation=await db.arcadeInvitation.findFirstOrThrow({where:{status:'PENDING',OR:[{hostPlayerId:a.id},{hostPlayerId:b.id}]}});
    await service.actInvitation(invitation.hostPlayerId===a.id?a.identity:b.identity,invitation.id,{kind:'CANCEL',idempotencyKey:randomUUID()});
    await db.playerSession.updateMany({where:{playerId:b.id},data:{endedAt:now}});
    await expect(service.invite(a.identity,{...input,opponentPlayerId:b.id,idempotencyKey:randomUUID()})).rejects.toMatchObject({code:'ARCADE_OPPONENT_UNAVAILABLE'});
  },60000);
  it.each(['host','guest'] as const)('solo replay by %s retains context and XP eligibility despite the old opponent being offline or busy',async who=>{
    const a=await player(),b=await player(),s=await ready(a,b,'TIC_TAC_TOE','HARD'),move=await nearFinish(s.id,'TIC_TAC_TOE');
    await act(a,s.id,'MOVE',move);
    const replaying=who==='host'?a:b,other=who==='host'?b:a;
    const oldResult=(await service.session(replaying.identity,s.id)).result;
    const notificationCount=await db.notification.count({where:{playerId:{in:[a.id,b.id]},domainKey:'arcade'}});
    await db.playerSession.updateMany({where:{playerId:other.id},data:{endedAt:now}});
    await service.start(other.identity,{game:s.game,difficulty:s.difficulty,previousSessionId:s.id,expectedVersion:0,idempotencyKey:randomUUID()});
    tick();
    const input={game:s.game,difficulty:s.difficulty,previousSessionId:s.id,expectedVersion:0 as const,idempotencyKey:randomUUID()};
    const started=await service.start(replaying.identity,input);
    expect((await service.start(replaying.identity,input)).session).toEqual(started.session);
    expect(started.session).toMatchObject({mode:'SOLO',game:s.game,difficulty:s.difficulty,opponent:null,participants:null});
    expect(started.session.banter.text).not.toBe('');
    expect((await db.arcadeSession.findUniqueOrThrow({where:{id:started.session.id}})).opponentPlayerId).toBeNull();
    expect(['PLAYER','AI']).toContain(started.session.firstSide);
    expect(await db.notification.count({where:{playerId:{in:[a.id,b.id]}}})).toBe(notificationCount);
    if(started.session.board.turn==='AI') await act(replaying,started.session.id,'ADVANCE');
    else { await act(replaying,started.session.id,'MOVE',0); await act(replaying,started.session.id,'ADVANCE'); }
    const finishMove=await nearFinish(started.session.id,s.game);
    const finished=await act(replaying,started.session.id,'MOVE',finishMove);
    expect(finished.session.result!.xpAwarded).toBeGreaterThan(0);
    expect(await db.arcadeDailyGrant.count({where:{playerId:replaying.id,game:s.game}})).toBe(1);
    expect((await service.session(replaying.identity,s.id)).result).toEqual(oldResult);
    expect(oldResult!.xpAwarded).toBe(0);
    expect(await db.notification.count({where:{playerId:{in:[a.id,b.id]},domainKey:'arcade'}})).toBe(notificationCount);
    expect(await db.arcadeInvitation.count({where:{status:'PENDING',OR:[{hostPlayerId:replaying.id},{guestPlayerId:replaying.id}]}})).toBe(0);
  },60000);
});
