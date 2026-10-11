import {describe,it,expect} from 'vitest';
import {harness,actor,commandId} from './helpers/chat-command-harness.js';
import {PlayerCommandResolver,type ChatCommandServices} from '../src/application/chat/player-command-resolver.js';
import type {PlayerCommandContext} from '../src/application/chat/player-command-context.js';
import {withPlayerCommandExecution} from '../src/application/player/player-command-execution.js';
import {commandText} from '../src/application/chat/command-presentation.js';
import {AppError} from '../src/api/errors.js';
describe.each(['INTERNAL_CHAT','TWITCH'] as const)('public command presentation %s',source=>{
 const setup=()=>{const h=harness();const resolver=new PlayerCommandResolver(h.chat as unknown as PlayerCommandContext,h.services as unknown as ChatCommandServices,source);
  return {...h,send:(text:string)=>withPlayerCommandExecution({now:new Date('2026-10-11T10:00:00Z'),source,responseBodyLimit:420},()=>resolver.resolve(actor,text,commandId))};};
 it.each(['!infos Absent','!faveur Absent','!echanger Absent'])('warns on %s without creating a trade',async command=>{
  const h=setup();expect(await h.send(command)).toBe('⚠️ Joueur introuvable.');expect(h.services.tradeService.create).not.toHaveBeenCalled();
 });
 it('adds the explicit exchange success and preserves the owner, amount and source',async()=>{
  const h=setup();expect(await h.send('!echanger Autre 3')).toMatch(/^✅ 🤝 Demande d’échange envoyée à Autre/);
  expect(h.services.tradeService.create).toHaveBeenCalledWith('self','other',3n,commandId,source);
 });
 it('warns about a missing request without mutating',async()=>{
  const h=setup();expect(await h.send('!echanger accepter Introuvable')).toBe('⚠️ Demande d’échange introuvable.');expect(h.services.tradeService.mutate).not.toHaveBeenCalled();
 });
 it('preserves existing icons and never doubles a status prefix',()=>{
  for(const text of ['✅ Fait','⚠️ Refus','ℹ️ Information','❌ Erreur','🎯 Cible'])expect(commandText(commandText(text))).toBe(text);
 });
 it('formats a real public service error with the error status',async()=>{
  const h=setup();h.services.spinDailyWheelChat.execute.mockRejectedValue(new AppError('Service momentanément indisponible.',503,'FIXTURE_UNAVAILABLE'));
  expect(await h.send('!roue')).toBe('❌ Service momentanément indisponible.');
 });
 it('packs long directory continuations with their icons inside the real transport budget',async()=>{
  const h=setup();const players=Array.from({length:20},(_,i)=>({id:String(i),displayName:`Joueur ${i} ${'🌟'.repeat(40)}`,status:'ONLINE'}));
  h.services.socialService.connected.mockResolvedValue({players,total:20} as never);
  const result=await h.send('!liste online'),parts=typeof result==='string'?[result]:result;
  expect(parts.length).toBeGreaterThan(1);for(const part of parts){expect(part).toMatch(/^ℹ️ /);expect(Array.from(part).length).toBeLessThanOrEqual(source==='TWITCH'?420:500);}
  for(const player of players)expect(parts.filter(part=>part.includes(player.displayName))).toHaveLength(1);
 });
});
