import type { RandomSource } from '../wheel/wheel.js';

export const EVENT_GAME_A_COOLDOWN_MS = 3_000;

export type EventGameAWindow = Readonly<{ startMinute: number; endMinute: number }>;
export type EventGameAState = Readonly<{ version: 1; gameA: Readonly<{ windows: readonly [EventGameAWindow, EventGameAWindow, EventGameAWindow] }> }>;

const ranges = [[7 * 60, 11 * 60], [12 * 60, 17 * 60], [18 * 60, 22 * 60]] as const;

export function generateEventGameAState(random: RandomSource): EventGameAState {
  const windows = ranges.map(([minimum, maximum]) => {
    const startMinute = minimum + random.nextInt(maximum - minimum + 1);
    return { startMinute, endMinute: startMinute + 60 };
  }) as unknown as EventGameAState['gameA']['windows'];
  return { version: 1, gameA: { windows } };
}

export function parseEventGameAState(value: unknown): EventGameAState {
  const record = asRecord(value);
  const gameA = asRecord(record?.gameA);
  const windows = gameA?.windows;
  if (record?.version !== 1 || !Array.isArray(windows) || windows.length !== 3) throw new Error('Invalid Event Game A daily state.');
  const parsed = windows.map((window, index) => {
    const entry = asRecord(window);
    const [minimum, maximum] = ranges[index]!;
    if (!entry || !Number.isInteger(entry.startMinute) || !Number.isInteger(entry.endMinute)) throw new Error('Invalid Event Game A window.');
    const startMinute = entry.startMinute as number;
    const endMinute = entry.endMinute as number;
    if (startMinute < minimum || startMinute > maximum || endMinute !== startMinute + 60) throw new Error('Invalid Event Game A window.');
    return { startMinute, endMinute };
  }) as unknown as EventGameAState['gameA']['windows'];
  return { version: 1, gameA: { windows: parsed } };
}

export function activeEventGameAWindow(windows: readonly EventGameAWindow[], localMinute: number): number | null {
  const index = windows.findIndex(({ startMinute, endMinute }) => localMinute >= startMinute && localMinute < endMinute);
  return index < 0 ? null : index;
}

export function eventGameASucceeded(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 100) throw new RangeError('An Event Game A roll must be between 0 and 99.');
  return roll < 20;
}

export function computeEventRefreshAfterMs(input: Readonly<{
  now: Date;
  nextBusinessResetAt: Date;
  completedToday: boolean;
  windows: readonly Readonly<{ startAt: Date; endAt: Date }>[];
  cooldownEndsAt: Date | null;
}>): number {
  const nowMs = input.now.getTime();
  const candidates = [input.nextBusinessResetAt.getTime()];
  if (!input.completedToday) {
    for (const window of input.windows) candidates.push(window.startAt.getTime(), window.endAt.getTime());
    if (input.cooldownEndsAt) candidates.push(input.cooldownEndsAt.getTime());
  }
  const futureCandidates = candidates.filter((candidate) => Number.isFinite(candidate) && candidate > nowMs);
  if (futureCandidates.length === 0) return 0;
  return Math.max(0, Math.min(...futureCandidates) - nowMs);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
