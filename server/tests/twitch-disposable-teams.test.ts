import { expect, it } from 'vitest';
import { isEmptyBaseTeams } from '../src/application/twitch/twitch-profile-claim.js';

const defaults = () => Array.from({ length: 10 }, (_, index) => ({ id: String(index), playerId: 'private', displayPosition: index + 1,
  name: null, isBaseSlot: true, legacySavedAt: null, isActive: index === 0, createdAt: new Date(), updatedAt: new Date() }));
it('accepts only the exact ten default empty team headers, independent of ordering', () => {
  expect(isEmptyBaseTeams(defaults().reverse())).toBe(true);
  expect(isEmptyBaseTeams(defaults().slice(1))).toBe(false);
  expect(isEmptyBaseTeams([...defaults(), defaults()[0]!])).toBe(false);
  expect(isEmptyBaseTeams(defaults().map(row => ({ ...row, futureState: null })))).toBe(false);
});
it.each(['name', 'base', 'legacy', 'active', 'position'] as const)('protects modified %s team headers', kind => {
  const rows: Record<string, unknown>[] = defaults();
  if (kind === 'name') rows[0]!.name = 'Chosen';
  if (kind === 'base') rows[0]!.isBaseSlot = false;
  if (kind === 'legacy') rows[0]!.legacySavedAt = new Date();
  if (kind === 'active') rows[0]!.isActive = false;
  if (kind === 'position') rows[0]!.displayPosition = 2;
  expect(isEmptyBaseTeams(rows)).toBe(false);
});
