import { AsyncLocalStorage } from 'node:async_hooks';
export type TwitchTimingPhase = 'observation' | 'echo' | 'giveaway' | 'favor' | 'authority' | 'identity' | 'activity' | 'activityPrepare' | 'activityBusiness' | 'receiptTransaction' | 'intentPrepare' | 'business' | 'responsePublication' | 'token' | 'finalAuthority' | 'helix';
type Dimensions = { execution?: 'consultation' | 'mutation'; transport?: 'warm' | 'cold'; token?: 'warm' | 'cold' | 'pending'; identity?: 'existing' | 'resolved'; dailyReward?: 'granted' | 'alreadyClaimed' };
type Timing = { start: number; phases: Partial<Record<TwitchTimingPhase, { count: number; ms: number; failed: number }>>; markers: Record<string, number>; dimensions: Dimensions };
const scope = new AsyncLocalStorage<Timing>();
const round = (v: number) => Math.round(Math.max(0, v) * 100) / 100;
export function twitchTimingDimensions(value: Dimensions) {
  const current = scope.getStore(); if (!current) return;
  const rank = { warm: 0, pending: 1, cold: 2 };
  const previous = current.dimensions;
  current.dimensions = { ...previous, ...value,
    ...(previous.transport === 'cold' ? { transport: 'cold' as const } : {}),
    ...(previous.token && (!value.token || rank[previous.token] > rank[value.token]) ? { token: previous.token } : {}),
  };
}
export function twitchTimingMark(name: 'firstSendAttempt' | 'firstHttpAttempt' | 'firstHttpConfirmed' | 'firstDurableSent' | 'lastDurableSent') {
  const current = scope.getStore(); if (current && (name === 'lastDurableSent' || current.markers[name] === undefined)) current.markers[name] = round(performance.now() - current.start);
}
export async function twitchTimingPhase<T>(phase: TwitchTimingPhase, action: () => Promise<T>): Promise<T> {
  const current = scope.getStore(); if (!current) return action();
  const start = performance.now(); let failed = 0;
  try { return await action(); } catch (error) { failed = 1; throw error; }
  finally { const value = current.phases[phase] ?? { count: 0, ms: 0, failed: 0 }; value.count++; value.ms += performance.now() - start; value.failed += failed; current.phases[phase] = value; }
}
/** Caller supplies only registry-owned handler/validated quantity. Never accepts raw payload/identity/error text. */
export async function withTwitchCommandTiming<T>(start: number, handler: string, pullCount: 1 | 5 | 10 | undefined, emit: (value: object) => void, action: () => Promise<T>): Promise<T> {
  const timing: Timing = { start, phases: {}, markers: {}, dimensions: {} }; let outcome = 'RETURNED';
  return scope.run(timing, async () => {
    try { return await action(); } catch (error) { outcome = 'THREW'; throw error; }
    finally {
      const phases = Object.fromEntries(Object.entries(timing.phases).map(([key, value]) => [key, { ...value, ms: round(value.ms) }]));
      try { emit({ version: 1, handler, ...(pullCount ? { pullCount } : {}), processingOutcome: outcome, totalMs: round(performance.now() - start), phasesInclusive: true, phases, markers: timing.markers, dimensions: timing.dimensions }); } catch { /* Telemetry cannot affect a receipt, mutation or external send. */ }
    }
  });
}
