import { expect, it } from 'vitest';
import { activityRangeStart } from '../src/application/player/player-activity-service.js';
it.each([
  ['2026-10-13', '5d', '2026-10-09'], ['2026-10-13', '10d', '2026-10-04'],
  ['2026-03-31', '1m', '2026-03-01'], ['2024-03-31', '1m', '2024-03-01'],
  ['2024-02-29', '1y', '2023-03-01'], ['2026-10-25', '3m', '2026-07-26'],
  ['2026-10-13', '6m', '2026-04-14'], ['2026-10-13', '2y', '2024-10-14'],
  ['2026-10-13', '5y', '2021-10-14'], ['2026-10-13', 'all', null],
] as const)('uses calendar dates for %s / %s', (today, range, expected) => expect(activityRangeStart(today, range)).toBe(expected));
