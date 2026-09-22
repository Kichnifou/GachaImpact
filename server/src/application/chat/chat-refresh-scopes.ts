export const chatRefreshScopes = [
  'player', 'resources', 'progression', 'gacha', 'bannerVotes', 'box', 'teams',
  'inventory', 'bank', 'shop', 'dailyChallenge', 'wheel', 'social', 'trades',
  'expedition', 'dailyCombat', 'monthlyBoss', 'contest', 'event', 'giftCodes', 'notifications',
] as const;
export type ChatRefreshScope = typeof chatRefreshScopes[number];

/** Effects are derived from completed server operations, never from the public command text. */
export function scopesForOperation(type: string): ChatRefreshScope[] {
  if (type === 'gacha.pull') return ['resources', 'gacha', 'box', 'inventory', 'dailyChallenge', 'progression', 'teams', 'dailyCombat', 'monthlyBoss', 'contest'];
  if (type === 'gacha.target') return ['gacha'];
  if (type === 'wheel.spin') return ['wheel', 'resources'];
  if (type.startsWith('bank.')) return ['bank', 'resources'];
  if (type === 'particles.convert') return ['resources', 'inventory', 'dailyChallenge'];
  if (type === 'shop.purchase') return ['shop', 'resources', 'inventory', 'gacha'];
  if (type === 'box.stella.use') return ['box', 'inventory', 'resources', 'teams', 'dailyCombat', 'monthlyBoss', 'contest'];
  if (type.startsWith('friendship.')) return ['social', 'resources', 'notifications'];
  if (type.startsWith('trades.')) return ['trades', 'resources', 'inventory', 'notifications'];
  if (type === 'daily-combat.fight') return ['dailyCombat', 'resources', 'notifications', 'teams'];
  if (type === 'monthly-boss.attack') return ['monthlyBoss', 'resources', 'notifications', 'teams'];
  if (type.startsWith('expedition.')) return ['expedition', 'resources', 'notifications'];
  if (type.startsWith('event.')) return ['event', 'resources', 'inventory', 'notifications'];
  if (type === 'gift-code.claim') return ['giftCodes', 'resources', 'event', 'notifications'];
  return [];
}
