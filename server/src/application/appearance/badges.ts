export const badgeSymbols = {
  'badge:star-solid': '✦', 'badge:star-outline': '✧',
  'badge:five-star-solid': '★', 'badge:five-star-outline': '☆',
  'badge:heart-solid': '♥', 'badge:heart-outline': '♡',
  'badge:diamond-outline': '◇', 'badge:diamond-inset': '◈',
  'badge:moon': '☾', 'badge:diamond-floral': '❖',
} as const;
export function freeBadgeSymbol(item: { type: string; externalKey: string; displayName: string; isActive: boolean } | null | undefined): string | null {
  if (item?.type !== 'BADGE' || !item.isActive || !Object.hasOwn(badgeSymbols, item.externalKey)) return null;
  const symbol = badgeSymbols[item.externalKey as keyof typeof badgeSymbols];
  return item.displayName === symbol ? symbol : null;
}
