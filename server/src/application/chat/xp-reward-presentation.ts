import type { PlayerXpGrantPlan } from '../../domain/player/xp-grant.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { chatNumber } from './chat-command-format.js';
import { chatElementEmojis, chatElementNames, logicalChatParts, logicalTwitchParts } from './chat-list-result.js';

/** Presentation of the executed plan and its transaction snapshot; never recalculates rewards. */
export function xpRewardPresentation(name: string, plan: PlayerXpGrantPlan,
  balances: Readonly<Record<string, bigint>> | undefined, transport: 'TWITCH' | 'INTERNAL_CHAT', limit?: number): readonly string[] {
  if (!plan.levelsReached.length && !plan.overflowRewardsGranted) return [];
  const level = plan.levelsReached.length ? `passe niveau ${chatNumber(plan.levelsReached.at(-1)!)} !` : '';
  const overflow = plan.overflowRewardsGranted ? `gagne une récompense niveau max !${plan.overflowRewardsGranted > 1 ? ` x${chatNumber(plan.overflowRewardsGranted)}` : ''}` : '';
  const prefix = `🎉 ${name} ${[level, overflow].filter(Boolean).join(' ')}`;
  const entries = plan.rewards.map(reward => {
    const value = chatNumber(reward.amount), element = reward.resourceKey.replace(/^particles_/u, '');
    const gain = reward.resourceKey === 'primogems' ? `+💠${value} primos` : reward.resourceKey === 'moras' ? `+💰${value} moras`
      : isElementKey(element) ? `+${value} particules ${chatElementEmojis[element]} ${chatElementNames[element]}` : `+${value} XP`;
    const balance = balances?.[reward.resourceKey];
    return { text: `${gain}${balance === undefined ? '' : ` (${chatNumber(balance)})`}`, separator: ' | ' };
  });
  return (transport === 'TWITCH' ? logicalTwitchParts : logicalChatParts)(prefix, entries, '🎉 Récompenses de niveau suite :', limit);
}
