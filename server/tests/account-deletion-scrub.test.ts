import {describe,it,expect} from 'vitest';
import {scrubAccountDetail,type ErasureContext} from '../src/application/player/account-deletion-scrub.js';
import {compactDetail} from '../src/application/retention/lossless-detail-storage.js';
import {encodeIntentReads} from '../src/application/twitch/twitch-intent-storage.js';
const context:ErasureContext={playerId:'target',externalIds:new Set(['123','auth-uuid']),names:new Set(['alice']),authoredMessageIds:new Set(['authored'])};
describe('account erasure historical copies',()=>{
 it('removes birthday dates in frozen own/peer profile copies without touching other birthdays or economic year/amount',()=>{
   const birthday={access:'ALLOWED',data:{day:29,month:2}};
   const value={profiles:[{player:{id:'target',displayName:'Alice'},birthday},{player:{id:'peer',displayName:'Alice'},birthday}],year:2026,amount:'50000'};
   expect(scrubAccountDetail(value,context)).toMatchObject({profiles:[{birthday:{access:'PRIVATE'}},{birthday}],year:2026,amount:'50000'});
   expect(scrubAccountDetail({player:{id:'peer',displayName:'Bob'},birthday},context,true)).toMatchObject({birthday});
   expect(scrubAccountDetail({id:'target',displayName:'Alice',birthdayDay:29,birthdayMonth:2,birthdayRegisteredAt:'date',birthdayLastRewardYear:2026},context)).toMatchObject({birthdayDay:null,birthdayMonth:null,birthdayRegisteredAt:null,birthdayLastRewardYear:null});
 });
 it('removes authored text without relying on names and preserves peer-authored content',()=>{
   expect(scrubAccountDetail([{authorPlayerId:'target',content:'private without identity'},{authorPlayerId:'peer',content:'Peer-owned text'}],context))
     .toEqual([{authorPlayerId:'target',content:null},{authorPlayerId:'peer',content:'Peer-owned text'}]);
 });
 it('removes quoted authored messages from peer reply snapshots',()=>{
   expect(scrubAccountDetail({authorPlayerId:'peer',content:'Peer-owned',replyToMessageId:'authored',replyPreview:'Private target text'},context))
     .toEqual({authorPlayerId:'peer',content:'Peer-owned',replyToMessageId:'authored',replyPreview:null});
 });
 it('does not confuse Twitch numeric IDs with economic amounts or display names with character names',()=>{
   expect(scrubAccountDetail({amount:'123',character:{name:'Alice'},twitchUserId:'123',displayName:'Alice'},context))
     .toEqual({amount:'123',character:{name:'Alice'},twitchUserId:null,displayName:'Compte supprimé'});
 });
 it('decodes nested Twitch and R1099 lossless storage before removing personal copies',()=>{
   const rows=Array.from({length:200},()=>({authorPlayerId:'target',content:'private '.repeat(20)}));
   const value=compactDetail({frozen:encodeIntentReads({messages:rows})});
   const result=JSON.stringify(scrubAccountDetail(value,context));
   expect(result).not.toContain('private');expect(result).not.toContain('brotli-base64');expect(result).toContain('target');
 });
 it('redacts identity renderings in another recipient notification without changing numbers',()=>{
   expect(scrubAccountDetail({body:'Alice a répondu.',amount:'123'},context)).toEqual({body:'Compte supprimé a répondu.',amount:'123'});
 });
 it('preserves a same-named peer and redacts scalar external identities and explicit actor names',()=>{
   expect(scrubAccountDetail({authorPlayerId:'peer',displayName:'Alice',content:'Peer text'},context)).toEqual({authorPlayerId:'peer',displayName:'Alice',content:'Peer text'});
   expect(scrubAccountDetail({actorId:'target',name:'Alice',actorName:'Alice',senderId:'123',chatterId:'123',twitchUserIds:['123','456'],amount:'123'},context))
    .toEqual({actorId:'target',name:'Compte supprimé',actorName:'Compte supprimé',senderId:null,chatterId:null,twitchUserIds:[null,'456'],amount:'123'});
 });
 it('scrubs legacy identity maps and attributed messages without touching peer text or aggregate numbers',()=>{
   const raw={kind:'BOSS_HISTORY',facts:{source:{currentBoss:{participants:{Alice:{damage:'123'},Bob:{damage:'456'}},finalBlowBy:'Alice'},globalStats:{highestHitPlayer:'Alice',damage:'123'}}}};
   expect(scrubAccountDetail(raw,context)).toEqual({kind:'BOSS_HISTORY',facts:{source:{currentBoss:{participants:{Bob:{damage:'456'}},finalBlowBy:'Compte supprimé'},globalStats:{highestHitPlayer:'Compte supprimé',damage:'123'}}}});
   expect(scrubAccountDetail({kind:'GIVEAWAY_HISTORY',facts:{source:{participants:['Alice','Bob'],messageCounts:{Alice:8,Bob:9},winner:'Alice',openedByLegacy:'Alice'}}},context))
    .toEqual({kind:'GIVEAWAY_HISTORY',facts:{source:{participants:['Bob'],messageCounts:{Bob:9},winner:'Compte supprimé',openedByLegacy:'Compte supprimé'}}});
   expect(scrubAccountDetail({kind:'EVENT_MESSAGES',facts:{source:{Alice:[{sender:'Bob',text:'Peer copy'}],Bob:[{sender:'Alice',text:'Secret without alias'},{sender:'Bob',text:'Alice is a Character name too'}]}}},context))
    .toEqual({kind:'EVENT_MESSAGES',facts:{source:{Bob:[{sender:'Compte supprimé',text:null},{sender:'Bob',text:'Alice is a Character name too'}]}}});
 });
});
