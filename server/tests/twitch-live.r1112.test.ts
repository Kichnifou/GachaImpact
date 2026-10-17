import { createHmac } from 'node:crypto';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { TwitchStreamClient } from '../src/infrastructure/twitch/twitch-stream-client.js';
import type { TwitchAppAccessTokenProvider } from '../src/infrastructure/twitch/twitch-app-access-token-provider.js';
import type { TwitchLiveService } from '../src/application/twitch/twitch-live-service.js';
import { registerTwitchEventSubRoutes } from '../src/api/routes/twitch-eventsub.js';
import { buildApp } from '../src/app.js';
const row={id:'9876',user_id:'12345',user_login:'kichnifou',type:'live',started_at:'2026-10-17T10:00:00Z'};
function client(data:unknown,status=200){
  const request=vi.fn(async()=>Response.json(data,{status}));
  const tokens={getToken:vi.fn(async()=>'fixture-token'),invalidate:vi.fn()};
  return {client:new TwitchStreamClient('client',tokens as unknown as TwitchAppAccessTokenProvider,request),request,tokens};
}
describe('Twitch live Helix boundary',()=>{
  it('validates stream identity and start time; empty data alone means offline',async()=>{
    expect(await client({data:[row]}).client.current('12345')).toEqual({id:'9876',startedAt:new Date(row.started_at)});
    expect(await client({data:[]}).client.current('12345')).toBeNull();
  });
  it.each([{data:[{...row,user_id:'other'}]},{data:[{...row,user_login:'another'}]},{data:[{...row,id:''}]},{data:[{...row,started_at:'invalid'}]},{data:[row,row]},{}])('rejects uncertain truth %j',async data=>{
    await expect(client(data).client.current('12345')).rejects.toThrow();
  });
  it.each([401,429,500])('never turns HTTP %s into offline',async status=>{
    await expect(client({data:[]},status).client.current('12345')).rejects.toThrow();
  });
  it('refreshes one rejected app token',async()=>{
    const f=client({data:[row]});f.request.mockResolvedValueOnce(Response.json({},{status:401}));
    expect(await f.client.current('12345')).toMatchObject({id:row.id});
    expect(f.tokens.invalidate).toHaveBeenCalledOnce();expect(f.request).toHaveBeenCalledTimes(2);
  });
});
it('protects the lightweight projection with existing authentication',async()=>{
  const projection=vi.fn(async()=>({live:true,validForMs:45_000}));
  const app=await buildApp({host:'127.0.0.1',port:3001,supabase:{},frontendOrigin:'https://game.example'},
    {authIdentityVerifier:{verify:async()=>({subject:'synthetic'})},getOrProvisionCurrentPlayer:{} as never,twitchLive:{projection} as unknown as TwitchLiveService});
  try {
    expect((await app.inject({url:'/api/v1/twitch/live'})).statusCode).toBe(401);
    const reply=await app.inject({url:'/api/v1/twitch/live',headers:{authorization:'Bearer fixture'}});
    expect(reply.statusCode).toBe(200);expect(reply.json()).toEqual({live:true,validForMs:45_000});
    expect(reply.headers['cache-control']).toBe('no-store');
  } finally { await app.close(); }
});
it('authenticates live hints and rejects mismatched identity and signature',async()=>{
  const app=Fastify(),signal=vi.fn(async()=>undefined),secret='synthetic-event-secret';
  await app.register(registerTwitchEventSubRoutes,{secret,observer:{} as never,favorSubscriptions:{} as never,favorGifts:{} as never,favorResubs:{} as never,favorChatPresence:{} as never,live:{signal} as unknown as TwitchLiveService});
  const send=async(type:string,mismatch=false,badSignature=false)=>{
    const payload=JSON.stringify({subscription:{type,version:'1',status:'enabled',condition:{broadcaster_user_id:'12345'}},event:{broadcaster_user_id:mismatch?'54321':'12345'}}),id='synthetic-event',timestamp=new Date().toISOString();
    return app.inject({method:'POST',url:'/api/v1/twitch/eventsub',payload,headers:{'content-type':'application/json',
      'twitch-eventsub-message-id':id,'twitch-eventsub-message-timestamp':timestamp,'twitch-eventsub-message-type':'notification',
      'twitch-eventsub-message-signature':'sha256='+createHmac('sha256',badSignature?'wrong':secret).update(id).update(timestamp).update(payload).digest('hex')}});
  };
  try {
    expect((await send('stream.online')).statusCode).toBe(204);expect((await send('stream.offline')).statusCode).toBe(204);
    expect(signal).toHaveBeenCalledTimes(2);expect((await send('stream.offline',true)).statusCode).toBe(400);
    expect((await send('stream.online',false,true)).statusCode).toBe(403);expect(signal).toHaveBeenCalledTimes(2);
  } finally { await app.close(); }
});
