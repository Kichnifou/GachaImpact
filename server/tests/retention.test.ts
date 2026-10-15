import { afterEach, describe, expect, it, vi } from 'vitest';
import { capacityLevel, classify, cycleDue, expirationSql, nextCycleAt, retentionPolicies } from '../src/application/retention/retention-policy.js';
import { RetentionScheduler } from '../src/application/retention/retention-scheduler.js';
import { loadConfig } from '../src/config/environment.js';
import { RetentionEngine } from '../src/application/retention/retention-engine.js';
import type { PrismaClient } from '../generated/prisma/client.js';

afterEach(()=>vi.useRealTimers());
describe('retention B1 closed policy and scheduler',()=>{
  it.each(Object.entries(retentionPolicies))('%s has its canonical calendar expression',(domain,policy)=>{
    const sql=expirationSql('stamp',policy);
    expect(sql).toContain(`interval '${policy}'`);expect(sql).toContain('< $1');expect(sql).not.toContain('<=');
    expect(sql.includes('Europe/Paris')).toBe(domain!=='twitch_passive');
  });
  it.each([['2026-03-28T03:00:00Z','2026-03-29T02:00:00.000Z'],['2026-10-24T02:00:00Z','2026-10-25T03:00:00.000Z'],['2026-12-31T03:00:00Z','2027-01-01T03:00:00.000Z']])('schedules Paris04 across DST/year %s',(now,next)=>{
    expect(nextCycleAt(new Date(now)).toISOString()).toBe(next);
  });
  it('catches up current day only after04; equality admits cycle',()=>{
    expect(cycleDue(new Date('2026-10-15T01:59:59Z'))).toBeUndefined();
    expect(cycleDue(new Date('2026-10-15T02:00:00Z'))).toBe('2026-10-15');
  });
  it.each([[249_999_999,0],[250_000_000,250],[350_000_000,350],[400_000_000,400]])('decimal MB alert %s',(bytes,level)=>expect(capacityLevel(bytes)).toBe(level));
  it('never interprets unknown, nonterminal or no-policy data as eligible',()=>{
    const base={hasPolicy:true,knownDate:true,expired:true,terminal:true,protected:false};
    expect(classify(base)).toBe('EXPIRED_UNQUALIFIED');expect(classify({...base,protected:true})).toBe('EXPIRED_PROTECTED');
    expect(classify({...base,knownDate:false})).toBe('UNKNOWN');expect(classify({...base,terminal:false})).toBe('PROTECTED');
    expect(classify({...base,knownDate:false,terminal:false})).toBe('PROTECTED');
    expect(classify({...base,hasPolicy:false})).toBe('NO_POLICY');expect(classify({...base,expired:false})).toBe('WITHIN_RETENTION');
  });
  it.each(['EXECUTE','DELETE','true','DRY_RUN_DELETE'])('rejects destructive/invalid configuration %s',mode=>expect(()=>loadConfig({RETENTION_MODE:mode})).toThrow());
  it('defaults disabled and performs no registry or business access',async()=>{
    const db={$transaction:vi.fn()} as unknown as PrismaClient;
    const engine=new RetentionEngine(db,'DISABLED',{now:()=>new Date()});
    expect(loadConfig({}).retentionMode).toBe('DISABLED');expect(await engine.run()).toEqual({skipped:'DISABLED'});expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('treats claim lock contention as skipped but never hides a database failure',async()=>{
    const transaction=vi.fn().mockRejectedValueOnce({meta:{code:'55P03'}}).mockRejectedValueOnce(new Error('registry unavailable'));
    const engine=new RetentionEngine({$transaction:transaction} as unknown as PrismaClient,'DRY_RUN',{now:()=>new Date('2026-10-15T05:00:00Z')},()=>{});
    expect((await engine.run()).skipped).toBe('BUSY_COMPLETED_OR_BACKOFF');await expect(engine.run()).rejects.toThrow('registry unavailable');
  });
  it('does not block start, serializes ticks and stops without rearming',async()=>{
    vi.useFakeTimers();let finish!:()=>void;let observed:AbortSignal|undefined;
    const run=vi.fn(async(signal?:AbortSignal)=>{observed=signal;await new Promise<void>(resolve=>finish=resolve);return {};});
    const scheduler=new RetentionScheduler({mode:'DRY_RUN',run},{now:()=>new Date('2026-10-15T05:00:00Z')},()=>{});
    scheduler.start();expect(run).toHaveBeenCalledTimes(1);scheduler.start();expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);expect(run).toHaveBeenCalledTimes(1);
    const stopping=scheduler.stop();expect(observed?.aborted).toBe(true);finish();await stopping;
    await vi.advanceTimersByTimeAsync(120_000);expect(run).toHaveBeenCalledTimes(1);
  });
  it('disabled scheduler has no timer and errors never create a hot retry loop',async()=>{
    vi.useFakeTimers();const run=vi.fn().mockRejectedValue(new Error('private details'));
    const log=vi.fn();const scheduler=new RetentionScheduler({mode:'DISABLED',run},{now:()=>new Date()},log);
    scheduler.start();await scheduler.stop();expect(run).not.toHaveBeenCalled();
    const active=new RetentionScheduler({mode:'DRY_RUN',run},{now:()=>new Date()},log);active.start();await vi.advanceTimersByTimeAsync(59_999);
    expect(run).toHaveBeenCalledTimes(1);expect(JSON.stringify(log.mock.calls)).not.toContain('private details');await active.stop();
  });
  it('sleeps until the next Paris night after a successful cycle',async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-15T05:00:00Z'));
    const run=vi.fn().mockResolvedValue({status:'SUCCESS'});
    const scheduler=new RetentionScheduler({mode:'DRY_RUN',run},{now:()=>new Date()},()=>{});scheduler.start();
    await vi.advanceTimersByTimeAsync(60_000);expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(21*3600_000-60_000);expect(run).toHaveBeenCalledTimes(2);await scheduler.stop();
  });
});
