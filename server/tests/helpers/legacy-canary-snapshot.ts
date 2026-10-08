import { parseStreamerbotSnapshot, snapshotFileNames } from '../../src/application/migration/streamerbot-snapshot.js';
import { createVerifiedTwitchReport } from '../../src/application/migration/verified-twitch-report.js';

/** Synthetic fixtures only, no private operator source. */
export function canarySnapshot(overrides: Record<string, unknown> = {}, identity: { legacyLogin?: string; twitchUserId?: string } = {}) {
  const categories = ['messages', 'pulls', 'characters4', 'characters5', 'morasEarned', 'mainParticlesEarned', 'expeditions', 'combatWins', 'friendHeartsSent'];
  const zKeys = ['c6_5_characters_z', 'perfect_friendship_z', 'level_100_z', 'manual_combat_wins_z'];
  const viewer = { element: 'Cryo', xp: 300, primogems: 120, moras: 80,
    particles: Object.fromEntries(['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].map(key => [key, 0])),
    bank: { moras: 40, lastInterestDate: '2026-10-05' }, pity: { pity5: 3, pity4: 2 }, guarantee: { guaranteedFeatured5: false },
    box: { '1': { characterId: 1, constellation: 6, copies: 7, firstObtainedAt: '2026-09-01 12:00:00' } }, boxFavorites: ['1'],
    team: [1], savedTeams: { '2': { name: 'Private saved team', characters: [1], savedAt: '2026-09-02 12:00:00' } },
    dates: { firstSeen: '2026-09-01 10:00:00', lastSeen: '2026-10-05 14:00:00', lastMessageTime: '2026-10-05 13:00:00', lastXpDate: '2026-10-05', lastWheelDate: null, lastDailyFirstMessageReward: null },
    options: { boxSort: 'd', boxSortDescending: true }, favor: { daysRemaining: 3, obtainedDate: '2026-10-04', lastClaimDate: '2026-10-05' }, missions: { daily: null },
    longMissions: { unlockedZ: false, categories: Object.fromEntries(categories.map(key => [key, { progress: 0, active: false, activeRank: '', completedRanks: [], acceptedRanks: [], startedAt: '', baselineValue: 0 }])),
      z: Object.fromEntries(zKeys.map(key => [key, { active: false, completed: false, progress: 0, acceptedAt: '' }])) },
    combat: { characterWins: { '1': 2 }, characterLosses: { '1': 1 }, lostCharacters: {} }, expedition: { active: false, lastStartedDate: null },
    coffre: {}, specialItems: { masterlessStellaFortuna: 0 }, usedCodes: [], stats: { totalMessages: 10, countedMessages: 9,
      level100OverflowRewardsClaimed: 0, totalPulls: 4, totalFiveStars: 0, totalFourStars: 0, fiftyFiftyLostStreak: 0,
      fiftyFiftyWon: 0, fiftyFiftyLost: 0, lastPullWasFiveStar: true, totalPrimosEarned: 120, totalPrimosSpent: 0,
      totalMorasEarned: 80, totalMorasSpent: 0, totalMainElementParticlesEarned: 0, totalFriendHeartsSent: 0, totalWheelSpins: 4,
      totalWheelJackpots: 1, totalExpeditionsCompleted: 0, totalCombatFights: 3, totalCombatWins: 2, totalCombatLosses: 1, totalManualCombatWins: 0 } };
  Object.assign(viewer, overrides);
  const files = Object.fromEntries(snapshotFileNames.map(name => [name, JSON.stringify(name === 'viewers_data.json' ? { fixture_canary: viewer }
    : name === 'c6_characters.json' ? { fixture_canary: { characters: { '1': { characterId: 1, createdAt: '2026-09-01 12:00:00',
      stats: { strength: 20, intelligence: 12, beauty: 8, charisma: 9, popularity: 3 },
      contestStats: { totalContests: 7, totalWins: 2, intelligenceContests: 3, intelligenceWins: 1 }, titles: { intelligence: 'Sage de Bronze' } } } } } : {})]));
  files['friendships_data.json'] = JSON.stringify({ friendships: { deferred: { users: ['fixture_canary', 'not_migrated'], level: 1, sparkleHearts: 0 } }, requests: [] });
  const legacyLogin = identity.legacyLogin ?? 'fixture_canary';
  for (const name of Object.keys(files)) files[name] = files[name]!.replaceAll('"fixture_canary"', JSON.stringify(legacyLogin));
  const snapshot = parseStreamerbotSnapshot(files);
  const report = createVerifiedTwitchReport(snapshot, { users: [{ legacyLogin, twitchUserId: identity.twitchUserId ?? '900000000001', currentLogin: legacyLogin, displayName: 'Private canary', renamed: false }], missing: [], conflicts: [], duplicates: 0 }, new Date(), { kind: 'CANARY', legacyLogin });
  return { snapshot, report };
}
