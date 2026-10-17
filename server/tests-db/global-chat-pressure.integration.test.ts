import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { elementKeys, resourceKeys } from '../src/domain/economy/resources.js';
const fixture=isolatedBatchDatabase(), db=fixture.database;
let now=new Date('2097-03-01T12:00:00Z'), testNumber=0;
const service=new GlobalChatService(db,new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)),{now:()=>now},{nextInt:()=>0});
const as=(subject:string)=>({subject}), advance=(ms:number)=>{now=new Date(now.getTime()+ms)};
beforeAll(async()=>{await fixture.setup();await db.element.createMany({data:elementKeys.map((key,index)=>({key,displayName:key,displayOrder:index+1}))});await db.resourceDefinition.createMany({data:resourceKeys.map(key=>({key,displayName:key,category:'test',elementKey:key.startsWith('particles_')?key.slice(10):null}))});},60000);
afterAll(()=>fixture.cleanup(),60000);
beforeEach(()=>{now=new Date(Date.parse('2097-03-01T12:00:00Z')+testNumber++*60000)});
async function player(){const id=randomUUID();await db.player.create({data:{id,displayName:'Private pressure '+id.slice(0,8),elementKey:'pyro',webIdentity:{create:{provider:'supabase',providerSubject:id}},progression:{create:{xp:60n}},economyStats:{create:{}},resourceBalances:{create:resourceKeys.map(resourceKey=>({resourceKey,amount:0n}))}}});return id;}
// A separate schema prevents the clear generations used by pressure tests from
// contaminating the historical Chat suite's canonical generation-zero fixtures.
describe('isolated global Chat pressure',()=>{
  it.each([10, 30])('serves %i concurrent idle readers without hydrating unchanged relations, then reconciles controlled writes', async clients => {
    const author = await player(), reader = await player(), moderator = await player();
    await db.playerRoleAssignment.create({ data: { playerId: moderator, role: 'MODERATOR' } });
    const { generation } = await service.clear(as(moderator), '!clear', randomUUID());
    const first = await service.send(as(author), 'Private performance fixture', randomUUID());
    const snapshot = await service.list(as(reader), 100);
    const anchor = snapshot.messages.at(-1)!;
    const find = vi.spyOn(db.globalChatMessage, 'findMany');
    const durations: number[] = [];
    try {
      const responses = await Promise.all(Array.from({ length: clients }, async () => {
        const started = performance.now();
        const result = await service.updates(as(reader), generation, anchor, snapshot.visibleMessageIds);
        durations.push(performance.now() - started);
        return result;
      }));
      expect(responses.every(result => !result.reset && !result.messages.length && !result.changes.length)).toBe(true);
      const hydratedReads = find.mock.calls.filter(([args]) => !!args?.include).length;
      durations.sort((a,b) => a-b);
      process.stdout.write(`R1102 private idle reads ${JSON.stringify({ clients, hydratedReads, p50: durations[Math.ceil(clients*.5)-1], p95: durations[Math.ceil(clients*.95)-1], p99: durations.at(-1) })}\n`);
      expect(hydratedReads).toBe(0);
    } finally { find.mockRestore(); }
    advance(10_001);
    const key = randomUUID();
    const [sent, replay] = await Promise.all([
      service.send(as(author), 'Controlled concurrent write', key),
      service.send(as(author), 'Controlled concurrent write', key),
      ...Array.from({ length: clients }, () => service.updates(as(reader), generation, anchor, snapshot.visibleMessageIds)),
    ]);
    expect(sent.message.id).toBe(replay.message.id);
    expect(await db.globalChatMessage.count({ where: { authorPlayerId: author, content: 'Controlled concurrent write' } })).toBe(1);
    await service.deleteOwn(as(author), first.message.id);
    const caughtUp = await service.updates(as(reader), generation, anchor, snapshot.visibleMessageIds);
    expect(caughtUp.messages.map(row => row.id)).toEqual([sent.message.id]);
    expect(caughtUp.messages[0]?.clientIntentKey).toBeNull();
    expect(caughtUp.changes).toMatchObject([{ id: first.message.id, deletionState: 'AUTHOR', content: null }]);
    expect((await service.updates(as(reader), generation, sent.message, [...snapshot.visibleMessageIds!, sent.message.id])).messages).toEqual([]);
  }, 120_000);

});
