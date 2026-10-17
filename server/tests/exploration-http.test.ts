import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {describe,it,expect,vi} from 'vitest';
import {registerAuthenticationContext,createAuthenticationHook} from '../src/api/auth/authentication.js';
import {registerErrorHandler} from '../src/api/error-handler.js';
import {registerExplorationRoutes} from '../src/api/routes/exploration.js';
import type {ExplorationService} from '../src/application/exploration/exploration-service.js';

describe('Exploration authenticated HTTP contract',()=>{
 it('authenticates every entry, binds verified identity, and rejects client authority and malformed proofs',async()=>{
  const app=Fastify(),identity={subject:'synthetic-exploration'},sessionId=randomUUID();
  const service={overview:vi.fn(async()=>({regions:[],session:null})),act:vi.fn(async()=>({operationId:'stored'})),presence:vi.fn(async()=>({active:true}))};
  registerAuthenticationContext(app);registerErrorHandler(app);
  await app.register(registerExplorationRoutes,{authenticate:createAuthenticationHook({verify:async token=>token==='local'?identity:null}),service:service as unknown as ExplorationService});
  try{
   const headers={authorization:'Bearer local'},start={kind:'START',sessionId:null,regionKey:'mondstadt',idempotencyKey:randomUUID()};
   for(const request of [{url:'/api/v1/exploration'},{method:'POST' as const,url:'/api/v1/exploration/actions',payload:start},{method:'POST' as const,url:`/api/v1/exploration/sessions/${sessionId}/presence`,payload:{tabKey:randomUUID(),sequence:1,visible:true}}])expect((await app.inject(request)).statusCode).toBe(401);
   expect(service.overview).not.toHaveBeenCalled();expect(service.act).not.toHaveBeenCalled();expect(service.presence).not.toHaveBeenCalled();
   expect((await app.inject({url:'/api/v1/exploration',headers})).statusCode).toBe(200);expect(service.overview).toHaveBeenCalledWith(identity);
   for(const payload of [{...start,playerId:randomUUID()},{...start,reward:{amount:'500'}},{...start,idempotencyKey:'invalid'},{kind:'OPEN',sessionId,idempotencyKey:randomUUID(),chestIndex:3,path:''},{kind:'OPEN',sessionId,idempotencyKey:randomUUID(),chestIndex:1,path:'U'.repeat(2049)},{kind:'OPEN',sessionId,idempotencyKey:randomUUID(),chestIndex:1,path:'R;DROP'}])expect((await app.inject({method:'POST',url:'/api/v1/exploration/actions',headers,payload})).statusCode).toBe(400);
   expect(service.act).not.toHaveBeenCalled();
   expect((await app.inject({method:'POST',url:'/api/v1/exploration/actions',headers,payload:start})).statusCode).toBe(200);expect(service.act).toHaveBeenCalledExactlyOnceWith(identity,start);
   const presence={tabKey:randomUUID(),sequence:1,visible:true};
   for(const payload of [{...presence,sequence:0},{...presence,x:1}, {...presence,visible:'true'}])expect((await app.inject({method:'POST',url:`/api/v1/exploration/sessions/${sessionId}/presence`,headers,payload})).statusCode).toBe(400);
   expect((await app.inject({method:'POST',url:`/api/v1/exploration/sessions/${sessionId}/presence`,headers,payload:presence})).statusCode).toBe(200);expect(service.presence).toHaveBeenCalledExactlyOnceWith(identity,sessionId,presence);
  }finally{await app.close()}
 });
});
