import { expect, it } from 'vitest';
import { planPlayerXpGrant } from '../src/domain/player/xp-grant.js';
import { xpRewardPresentation } from '../src/application/chat/xp-reward-presentation.js';
const state = (xp: bigint) => ({ xp, level100OverflowRewardsClaimed: 0, totalMessages: 0n, countedMessages: 0n, lastXpAt: null, lastXpMessageAt: null });
const now = new Date('2026-10-09T20:00:00Z');
it.each([['normal', 29n, 1n], ['max', 3029n, 1n], ['multiple', 3029n, 61n]] as const)('renders the executed %s plan with canonical French resources', (_, before, amount) => {
  const plan = planPlayerXpGrant(state(before), amount, 'geo', now, { nextInt: () => 5 });
  const balances = Object.fromEntries(plan.rewards.map(reward => [reward.resourceKey, reward.amount + 12345678901234567890n]));
  const output = xpRewardPresentation('Kadraw18', plan, balances, 'TWITCH', 420);
  const text = output.join(' ');
  expect(text).toMatch(/^🎉 Kadraw18/u); expect(text).not.toContain('particles_');
  expect(text).not.toContain('primogems'); expect(text).toContain('💠'); expect(text).toContain('💰');
  for (const reward of plan.rewards) expect(text).toContain(balances[reward.resourceKey]!.toLocaleString('fr-FR').replace(/[\u00a0\u202f]/gu, ' '));
  if (plan.overflowRewardsGranted) expect(text).toContain('gagne une récompense niveau max !');
  else expect(text).toContain('passe niveau 1 !');
  if (plan.overflowRewardsGranted > 1) expect(text).toContain(`x${plan.overflowRewardsGranted}`);
  expect(output.every(part => Array.from(part).length <= 420)).toBe(true);
  expect(xpRewardPresentation('Kadraw18', plan, balances, 'INTERNAL_CHAT').join(' ')).not.toContain('particles_');
});
it('packs complete reward atoms with explicit continuations and omits unproven balances', () => {
  const plan = planPlayerXpGrant(state(3029n), 61n, 'geo', now, { nextInt: () => 5 });
  const parts = xpRewardPresentation('Kadraw18', plan, undefined, 'TWITCH', 100);
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.slice(1).every(part => part.startsWith('🎉 Récompenses de niveau suite :'))).toBe(true);
  expect(parts.every(part => Array.from(part).length <= 100)).toBe(true);
  expect(parts.join(' ')).not.toContain('(');
});
