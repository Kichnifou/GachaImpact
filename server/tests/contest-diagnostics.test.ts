import { afterEach, expect, it, vi } from 'vitest';
import { contestDiagnostics } from '../src/application/contest/contest-diagnostics.js';

afterEach(() => vi.useRealTimers());

it('observes the exact pending stage once, preserves its result and clears its timer', async () => {
  vi.useFakeTimers();
  const sink = vi.fn();
  const stage = contestDiagnostics(sink);
  let release!: (value: number) => void;
  const request = stage('view.theme', () => new Promise<number>(resolve => { release = resolve; }));
  await vi.advanceTimersByTimeAsync(2_000);
  expect(sink.mock.calls.map(([event]) => [event.stage, event.state])).toEqual([['view.theme', 'START'], ['view.theme', 'WAITING']]);
  await vi.advanceTimersByTimeAsync(6_000);
  expect(sink).toHaveBeenCalledTimes(2);
  release(7);
  await expect(request).resolves.toBe(7);
  expect(sink.mock.lastCall?.[0]).toMatchObject({ stage: 'view.theme', state: 'DONE' });
  expect(vi.getTimerCount()).toBe(0);
});

it('never exposes an error message or arbitrary code and never changes business failures', async () => {
  const sink = vi.fn(), stage = contestDiagnostics(sink);
  const error = Object.assign(new Error('sensitive SQL or identity'), { code: 'sensitive-code' });
  await expect(stage('current.player', async () => { throw error; })).rejects.toBe(error);
  expect(JSON.stringify(sink.mock.calls)).not.toContain('sensitive');
  const throwingSink = contestDiagnostics(() => { throw new Error('sink unavailable'); });
  await expect(throwingSink('view.theme', async () => 9)).resolves.toBe(9);
});
