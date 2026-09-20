import { Prisma, type PrismaClient, type PrivacyLevel } from '../../../generated/prisma/client.js';

/** R518 + R519. Missing rows use this versioned policy; overrides are never reset. */
export const PRIVACY_POLICY_VERSION = 1;
export const privacyDefaults = {
  ACTIVE_TEAM: 'PUBLIC', BOX: 'PUBLIC', COLLECTION: 'PUBLIC', GENERAL_STATISTICS: 'PUBLIC',
  MISSIONS: 'PUBLIC', LAST_ACTIVITY: 'PUBLIC', PITY_GUARANTEE: 'PUBLIC', PRIVATE_MESSAGES: 'PUBLIC', PRESENCE: 'PUBLIC',
  FRIEND_LIST: 'FRIENDS', CURRENCY_BALANCES: 'PRIVATE', BANK: 'PRIVATE', INVENTORY: 'PRIVATE',
  SAVED_TEAMS: 'PRIVATE', ACTIVE_EXPEDITION: 'PRIVATE', DAILY_COMBAT: 'PRIVATE', BOSS_STATE: 'PRIVATE', DETAILED_HISTORY: 'PRIVATE',
} as const satisfies Record<string, PrivacyLevel>;
export type PrivacyCategory = keyof typeof privacyDefaults;
export const privacyCategories = Object.keys(privacyDefaults) as PrivacyCategory[];

export function activeFriendOf(viewer: string): Prisma.PlayerWhereInput {
  return { OR: [{ friendshipsAsA: { some: { playerBId: viewer, state: 'ACTIVE' } } }, { friendshipsAsB: { some: { playerAId: viewer, state: 'ACTIVE' } } }] };
}
export function unblockedWith(viewer: string): Prisma.PlayerWhereInput {
  return { blocksCreated: { none: { blockedPlayerId: viewer } }, blocksReceived: { none: { blockerPlayerId: viewer } } };
}
export function privacyAllowedWhere(viewer: string, category: PrivacyCategory): Prisma.PlayerWhereInput {
  const fallback = privacyDefaults[category];
  const defaultAccess: Prisma.PlayerWhereInput[] = fallback === 'PRIVATE' ? [] : [{ AND: [
    { privacySettings: { none: { categoryKey: category } } }, ...(fallback === 'FRIENDS' ? [activeFriendOf(viewer)] : []),
  ] }];
  const visibility: Prisma.PlayerWhereInput = { OR: [
    ...defaultAccess,
    { privacySettings: { some: { categoryKey: category, level: 'PUBLIC' } } },
    { AND: [{ privacySettings: { some: { categoryKey: category, level: 'FRIENDS' } } }, activeFriendOf(viewer)] },
  ] };
  const blockedCategory = category === 'PRESENCE' || category === 'LAST_ACTIVITY' || category === 'PRIVATE_MESSAGES';
  return { OR: [{ id: viewer }, { AND: [visibility, ...(blockedCategory ? [unblockedWith(viewer)] : [])] }] };
}

export class PrivacyService {
  constructor(private readonly database: PrismaClient) {}
  async settings(playerId: string) {
    const rows = await this.database.privacySetting.findMany({ where: { playerId }, select: { categoryKey: true, level: true } });
    const overrides = new Map(rows.map(r => [r.categoryKey, r.level]));
    return { version: PRIVACY_POLICY_VERSION, settings: privacyCategories.map(categoryKey => ({ categoryKey, level: overrides.get(categoryKey) ?? privacyDefaults[categoryKey] })) };
  }
  async save(playerId: string, categoryKey: PrivacyCategory, level: PrivacyLevel) {
    await this.database.privacySetting.upsert({ where: { playerId_categoryKey: { playerId, categoryKey } }, create: { playerId, categoryKey, level }, update: { level } });
    return this.settings(playerId);
  }
  async permissions(owner: string, viewer: string) {
    if (owner === viewer) return Object.fromEntries(privacyCategories.map(c => [c, true])) as Record<PrivacyCategory, boolean>;
    const [settings, friendship, block] = await Promise.all([
      this.settings(owner),
      this.database.player.count({ where: { id: owner, ...activeFriendOf(viewer) } }),
      this.database.player.count({ where: { id: owner, ...unblockedWith(viewer) } }),
    ]);
    return Object.fromEntries(settings.settings.map(({ categoryKey, level }) => [categoryKey,
      (level === 'PUBLIC' || level === 'FRIENDS' && friendship > 0) &&
      (!['PRESENCE', 'LAST_ACTIVITY', 'PRIVATE_MESSAGES'].includes(categoryKey) || block > 0),
    ])) as Record<PrivacyCategory, boolean>;
  }
}
