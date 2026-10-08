import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { EventService } from '../src/application/event/event-service.js';
import { HistoryService } from '../src/application/history/history-service.js';
import { MonthlyBossService } from '../src/application/combat/monthly-boss-service.js';
import { GiveawayService } from '../src/application/giveaway/giveaway-service.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
beforeAll(() => fixture.setup({ seedPublicCatalog: true }), 60_000);
afterAll(() => fixture.cleanup(), 60_000);
const now = new Date('2627-10-15T12:00:00Z');
async function player(displayName: string, status: 'ACTIVE' | 'ARCHIVED' | 'SUSPENDED' = 'ACTIVE') {
  return db.player.create({ data: { displayName, status } });
}

describe('archived progression public projections, isolated PostgreSQL', () => {
  it('filters by status before top ten and self rank, retaining the definitive account and suspended semantics', async () => {
    const a = await player('Céo', 'ARCHIVED'), b = await player('Céotryd'), suspended = await player('Suspendu', 'SUSPENDED');
    const service = new EventService({ execute: async () => ({ id: b.id }) } as never, db, { now: () => now }, { nextInt: () => 0 });
    const context = await service.resolveCurrentEdition(db, now);
    const others = await Promise.all(Array.from({ length: 10 }, (_, i) => player(`Visible ${i}`)));
    await db.eventParticipant.createMany({ data: [a, suspended, ...others, b].map((p, i) => ({ eventEditionId: context.edition.id, playerId: p.id, points: 100 - i, joinedAt: now })) });
    const rows = await db.eventParticipant.findMany({ where: { eventEditionId: context.edition.id }, orderBy: { playerId: 'asc' } });
    const result = await service.getRanking({ subject: 'synthetic' });
    expect(result.entries).toHaveLength(10);
    expect(result.entries.some(r => r.playerId === a.id)).toBe(false);
    expect(result.entries[0]).toMatchObject({ playerId: suspended.id, rank: 1 });
    expect(result.self).toEqual({ rank: 12, points: 88 });
    await db.player.update({ where: { id: a.id }, data: { displayName: 'Céotryd' } });
    await db.player.update({ where: { id: b.id }, data: { displayName: 'Céo' } });
    expect((await service.getRanking({ subject: 'synthetic' })).entries.some(row => row.playerId === a.id)).toBe(false);
    await db.player.update({ where: { id: b.id }, data: { displayName: 'Céotryd' } });
    await db.eventParticipant.update({ where: { eventEditionId_playerId: { eventEditionId: context.edition.id, playerId: b.id } }, data: { points: 200 } });
    expect((await service.getRanking({ subject: 'synthetic' })).entries[0]).toMatchObject({ playerId: b.id, displayName: 'Céotryd', rank: 1 });
    await db.eventParticipant.update({ where: { eventEditionId_playerId: { eventEditionId: context.edition.id, playerId: b.id } }, data: { points: 88 } });
    expect(await db.eventParticipant.findMany({ where: { eventEditionId: context.edition.id }, orderBy: { playerId: 'asc' } })).toEqual(rows);
    await db.player.updateMany({ where: { id: { in: [suspended.id, b.id, ...others.map(p => p.id)] } }, data: { status: 'ARCHIVED' } });
    expect(await service.getRanking({ subject: 'synthetic' })).toMatchObject({ entries: [], self: null });
    expect(await db.eventParticipant.count({ where: { eventEditionId: context.edition.id } })).toBe(13);
    expect(await db.businessOperation.count()).toBe(0);
  });

  it('projects historical Event counts, ranks and personal details without deleting claims or authors', async () => {
    const a = await player('Céo', 'ARCHIVED'), b = await player('Céotryd');
    const definition = await db.eventDefinition.findUniqueOrThrow({ where: { calendarMonth: 9 } });
    const edition = await db.eventEdition.create({ data: { eventDefinitionId: definition.id, year: 2627, startsAt: new Date('2627-09-01'), endsAt: new Date('2627-10-01'), status: 'FINISHED', snapshot: { displayName: 'Festival passé', calendarMonth: 9 } } });
    await db.eventParticipant.createMany({ data: [a,b].map((p,i) => ({ eventEditionId: edition.id, playerId:p.id, points:100-i, joinedAt:now })) });
    await db.eventMilestoneClaim.create({ data: { eventEditionId:edition.id, playerId:a.id, milestone:10, origin:'LEGACY', operationId:null, claimedAt:null, legacyProvenance:{source:'synthetic'} } });
    const service = new HistoryService(db, () => now);
    const entries = (await service.events(b.id, 1)).entries;
    expect(entries.find(r => r.id === edition.id)).toMatchObject({ participantCount:1, top:[{ playerId:b.id, rank:1 }], personal:{ rank:1,points:99 } });
    expect((await service.events(a.id,1)).entries.find(r => r.id===edition.id)?.personal).toBeNull();
    expect(await db.eventMilestoneClaim.count({ where:{ playerId:a.id } })).toBe(1);
    expect(await db.eventParticipant.count({ where:{ eventEditionId:edition.id } })).toBe(2);
    await db.player.update({ where:{ id:b.id }, data:{ status:'ARCHIVED' } });
    expect((await service.events(b.id,1)).entries.find(r=>r.id===edition.id)).toMatchObject({ participantCount:0,top:[],personal:null });
  });

  it('excludes archived Boss ranks and keeps immutable damage and final-blow attribution', async () => {
    const a=await player('Céo','ARCHIVED'), b=await player('Céotryd');
    const boss=await db.monthlyBoss.create({ data:{ monthStart:new Date('2627-08-01'), nameSnapshot:'Boss',baseHp:500000n,maxHp:500000n,currentHp:0n,hpVariationPercent:0,resistanceElementKey:'pyro',defeatedAt:new Date('2627-08-10'),finalBlowPlayerId:a.id } });
    await db.playerBossParticipation.createMany({ data:[a,b].map((p,i)=>({ bossId:boss.id,playerId:p.id,totalDamage:BigInt(900-i*800),attackCount:1n,bestHit:BigInt(900-i*800),firstAttackAt:now })) });
    const service=new MonthlyBossService({ execute:async()=>({id:b.id}) } as never,db,{now:()=>now},{nextInt:()=>0});
    const before=await db.playerBossParticipation.findMany({where:{bossId:boss.id},orderBy:{playerId:'asc'}});
    expect((await service.getRanking(boss.id)).ranking).toMatchObject([{playerId:b.id,rank:1}]);
    const history=(await service.getHistory(1)).bosses.find(r=>r.id===boss.id)!;
    expect(history.records.topThree).toMatchObject([{playerId:b.id,rank:1}]);
    expect(history.finalBlowPlayer?.displayName).toBe('Progression archivée');
    expect((await db.monthlyBoss.findUniqueOrThrow({where:{id:boss.id}})).finalBlowPlayerId).toBe(a.id);
    expect(await db.playerBossParticipation.findMany({where:{bossId:boss.id},orderBy:{playerId:'asc'}})).toEqual(before);
  });

  it('filters Giveaway standings and counts while retaining an archived winner as neutral historical attribution', async () => {
    const a=await player('Céo','ARCHIVED'), b=await player('Céotryd');
    const session=await db.giveawaySession.create({data:{status:'CLOSED',origin:'NATIVE',openedAt:now,closedAt:now,openedByPlayerId:a.id,winnerPlayerId:a.id}});
    await db.giveawayParticipant.createMany({data:[a,b].map(p=>({sessionId:session.id,playerId:p.id}))});
    await db.giveawayChatStat.createMany({data:[a,b].map((p,i)=>({sessionId:session.id,playerId:p.id,messageCount:BigInt(10-i)}))});
    const service=new GiveawayService(db,{status:async()=>({available:true,authorized:true,enabled:true,active:true,pending:false})} as never,()=>now,()=>0);
    expect((await service.state()).session).toMatchObject({participantCount:1,chatterCount:1,winner:'Progression archivée',openedBy:'Progression archivée',top:[{playerId:b.id,rank:1}]});
    expect(await db.giveawayChatStat.count({where:{sessionId:session.id}})).toBe(2);
    expect((await db.giveawaySession.findUniqueOrThrow({where:{id:session.id}})).winnerPlayerId).toBe(a.id);
    expect(await db.giveawayReward.count()).toBe(0);
  });
});
