import {describe,it,expect} from 'vitest';
import {compactDetail,expandDetail} from '../src/application/retention/lossless-detail-storage.js';
import {transformDetail} from '../src/application/retention/retention-transformations.js';
import {decodeIntentReads} from '../src/application/twitch/twitch-intent-storage.js';
import {readGachaActiveTeam} from '../src/application/gacha/gacha-snapshot-storage.js';
import {loadConfig} from '../src/config/environment.js';
const team={teamId:null,elements:[],effects:[]};
const pilot={version:1,playerId:'synthetic',actorName:'Synthetic',senderId:'100000000',broadcasterId:'200000000',replyParentMessageId:'synthetic-parent',commandKey:'synthetic:key',handler:'box',stage:'RESPONSES',responses:[{status:'SENT',text:'Exact response',messageId:'synthetic-confirmed'}],intent:{now:'2026-01-01T00:00:00.000Z',reads:{box:Array.from({length:300},(_,i)=>({index:i,proof:'Durable original value '.repeat(20)}))},memory:{}}};
describe('R1099 lossless-only domain qualification',()=>{
 it('requires explicit closed domains and rejects a global delete permission',()=>{
   expect(()=>loadConfig({RETENTION_MODE:'EXECUTE'})).toThrow();
   expect(()=>loadConfig({RETENTION_MODE:'EXECUTE',RETENTION_EXECUTE_DOMAINS:'chat'})).toThrow();
   expect(loadConfig({RETENTION_MODE:'EXECUTE',RETENTION_EXECUTE_DOMAINS:'twitch_terminal,gacha,arcade'}).retentionExecuteDomains).toEqual(['twitch_terminal','gacha','arcade']);
 });
 it('preserves Twitch envelope, exact response, Event JSON and every original frozen read',()=>{
   const original={commandPilot:pilot,messageActivity:{plan:{event:{messageIds:['synthetic-event']}}},otherProof:{unchanged:true}};
   const result=transformDetail('twitch_terminal',original,null) as typeof original;
   expect(result).not.toEqual(original);expect({...result,commandPilot:{...result.commandPilot,intent:{...result.commandPilot.intent,reads:decodeIntentReads(result.commandPilot.intent.reads)}}}).toEqual(original);
   expect(transformDetail('twitch_terminal',result,null)).toEqual(result);
 });
 it.each(['EXECUTING','UNKNOWN'])('keeps unqualified Twitch stage %s intact',stage=>{
   const original={commandPilot:{...pilot,stage}};expect(transformDetail('twitch_terminal',original,null)).toEqual(original);
 });
 it.each(['PENDING','SENDING','FAILED','AMBIGUOUS'])('keeps Twitch response %s intact',status=>{
   const original={commandPilot:{...pilot,responses:[{...pilot.responses[0]!,status}]}};expect(transformDetail('twitch_terminal',original,null)).toEqual(original);
 });
 it('refuses a SENT response without external confirmation and an unknown pilot version',()=>{
   const missing={commandPilot:{...pilot,responses:[{status:'SENT',text:'Exact response'}]}};
   expect(transformDetail('twitch_terminal',missing,null)).toEqual(missing);
   const unknown={commandPilot:{...pilot,version:2}};expect(transformDetail('twitch_terminal',unknown,null)).toEqual(unknown);
 });
 it.each([false,true])('retains every Gacha snapshot field, original Team and v2 reference (v2=%s)',v2=>{
   const original={stateBefore:{pity5:0,pity4:0,captureProgress:0,fiftyFiftyLostStreak:0,totalPulls:'10',totalFiveStars:'1',totalFourStars:'2',fiftyFiftyWon:'1',fiftyFiftyLost:'0',capturesTriggered:'0',guaranteedFeatured5:false},stateAfter:{pity5:0,pity4:0,captureProgress:0,fiftyFiftyLostStreak:0,totalPulls:'10',totalFiveStars:'1',totalFourStars:'2',fiftyFiftyWon:'1',fiftyFiftyLost:'0',capturesTriggered:'0',guaranteedFeatured5:false},backToBack:true,rng:Array.from({length:400},(_,i)=>({index:i,proof:'Original RNG and economic effect '.repeat(10)})),...(v2?{snapshotVersion:2,activeTeamRef:'operation'}:{activeTeam:team})};
   const summary=v2?{gachaSnapshotVersion:2,activeTeam:team}:{};
   const result=transformDetail('gacha',original,summary);
   expect(result).not.toEqual(original);expect(expandDetail(result)).toEqual(original);expect(readGachaActiveTeam(result,summary)).toEqual(team);
 });
 it('keeps a Gacha snapshot with missing Team/state proof intact',()=>{
   const value={stateBefore:{},stateAfter:{},large:'repeat'.repeat(5000)};expect(transformDetail('gacha',value,null)).toEqual(value);
 });
 it('preserves complete Arcade response and idempotency result',()=>{
   const original={operationId:'synthetic-operation',alreadyProcessed:false,rewards:['original reward '.repeat(1000)],record:{score:1234}};
   const result=transformDetail('arcade',original,null);expect(expandDetail(result)).toEqual(original);expect(result).not.toEqual(original);
 });
 it('refuses corruption/unknown versions instead of consulting current game state',()=>{
   const compressed=compactDetail({large:'test'.repeat(2000)}) as Record<string,unknown>;
   expect(()=>expandDetail({...compressed,retentionEncoding:'unknown'} as never)).toThrow();
   const envelope=compressed.envelope as Record<string,unknown>;
   expect(()=>expandDetail({...compressed,envelope:{...envelope,sha256:'0'.repeat(64)}} as never)).toThrow();
 });
});
