import { randomUUID } from 'node:crypto';
import { canarySnapshot } from './legacy-canary-snapshot.js';
import { createOwnerApprovedPopulation, identityProofHash } from '../../src/application/migration/owner-approved-population.js';
import { parseStreamerbotSnapshot, snapshotFileNames } from '../../src/application/migration/streamerbot-snapshot.js';
import { createVerifiedTwitchReport, type VerifiedTwitchReport } from '../../src/application/migration/verified-twitch-report.js';
import { validateRecoverySource, type RecoverySource } from '../../src/application/migration/legacy-recovery.js';

export const recoveryImportedAt = new Date('2026-10-09T10:00:00Z');
export const recoveryNow = new Date('2026-10-09T13:00:00Z');

/** Entirely synthetic source, identities and resources; no production capture. */
export function recoveryDomainSource() {
  const approved = Array.from({ length: 43 }, (_, index) => ({ legacyLogin: `domain_profile_${index}`, twitchUserId: String(975510000000 + index) }));
  const names = [...approved.map(m => m.legacyLogin), 'domain_quarantine_a', 'domain_quarantine_b',
    ...Array.from({ length: 171 }, (_, index) => `domain_discarded_${index}`)];
  const seed = canarySnapshot().snapshot;
  const base = (seed.sources['viewers_data.json'] as Record<string, Record<string, unknown>>).fixture_canary!;
  const viewers = Object.fromEntries(names.map(name => [name, { ...structuredClone(base), stats: { ...(base.stats as object),
    totalBossDamage: 0, totalBossAttacks: 0, bossesParticipated: 0, bossesDefeated: 0, totalBossFinalBlows: 0, highestBossHit: 0, lastBossParticipationMonth: '' } }]));
  const hero = approved[3]!.legacyLogin, peer = approved[0]!.legacyLogin;
  Object.assign(viewers[hero]!.stats, { totalBossDamage: 1_000_000, totalBossAttacks: 100, bossesParticipated: 2,
    bossesDefeated: 1, highestBossHit: 10_000, lastBossParticipationMonth: '2026-10' });
  const participant = (damage: number, attacks: number, highestHit: number, lastAttackDate: string) => ({ damage, attacks, highestHit, lastAttackDate });
  const boss = (month: string, defeated: boolean, finalBlowBy: string, participants: Record<string, ReturnType<typeof participant>>) => {
    const totalDamage = Object.values(participants).reduce((sum, row) => sum + row.damage, 0);
    return { month, name: 'Synthetic source Boss', maxHp: 1_500_000, currentHp: 1_500_000 - totalDamage,
      resistance: 'pyro', defeated, createdAt: `${month}-01 07:00:00`,
      defeatedAt: defeated ? `${month}-${month === '2026-08' ? '27' : '16'} 20:00:00` : '', finalBlowBy,
      totalDamage, totalAttacks: Object.values(participants).reduce((sum, row) => sum + row.attacks, 0), rewardsDistributed: defeated, participants };
  };
  const bossSource = { history: [boss('2026-08', true, hero, { [hero]: participant(900_000, 90, 10_000, '2026-08-27'), [peer]: participant(600_000, 60, 10_000, '2026-08-26') }),
    boss('2026-09', true, peer, { [hero]: participant(400_000, 20, 20_000, '2026-09-15'), [peer]: participant(1_100_000, 55, 20_000, '2026-09-16') })],
  currentBoss: boss('2026-10', false, '', { [hero]: participant(10_000, 2, 6_000, '2026-10-06'), [peer]: participant(20_000, 4, 8_000, '2026-10-06') }),
  globalStats: { totalBossesGenerated: 3, totalBossesDefeated: 2, totalDamage: 3_030_000, totalAttacks: 231, highestHit: 20_000, highestHitPlayer: peer } };
  const eventSource = { year: 2026, month: 10, participants: Object.fromEntries(approved.filter((_m, i) => i >= 3 && i % 2 === 1).map(m => [m.legacyLogin,
    { joined: true, joinedAt: '2026-10-01 12:00:00', points: 12, currency: 20, milestonesClaimed: [10], daily: { '2026-10-06': { gameA: 1, gameB: 0, gameC: 0 } } }])),
  calendar: {}, collectionPurchases: {}, dailyWindows: {}, monthlyDraw: { drawDone: false },
  gameB: { '2026-10-06': { found: true, winner: hero, code: '00000' } },
  messages: { [approved[6]!.legacyLogin]: [{ sender: approved[7]!.legacyLogin, text: 'Synthetic historical message', createdAt: '2026-10-06 12:00:00', read: false },
    { sender: approved[7]!.legacyLogin, text: 'Synthetic already read message', createdAt: '2026-10-05 12:00:00', read: true }] } };
  const giveaway = { status: 'closed', openedAt: '2026-10-01 19:25:11', closedAt: '2026-10-01 21:10:29',
    openedBy: peer, closedBy: peer, winner: hero, rewardPrimos: 1600, chatRewardsDistributed: true,
    participants: [hero, approved[5]!.legacyLogin], participantCount: 2, messageCounts: { [peer]: 20, [hero]: 10, [approved[5]!.legacyLogin]: 4 },
    lastParticipant: approved[5]!.legacyLogin, lastWishAt: '2026-10-01 19:39:40' };
  const sources: Record<string, unknown> = { ...seed.sources, 'viewers_data.json': viewers, 'monthly_boss.json': bossSource,
    'monthly_events_data.json': eventSource, 'giveaway.json': giveaway, 'friendships_data.json': { friendships: {}, requests: [] } };
  const sourceFiles = Object.fromEntries(snapshotFileNames.map(name => [name, JSON.stringify(sources[name])]));
  const snapshot = parseStreamerbotSnapshot(sourceFiles);
  const users = approved.map((member, index) => ({ ...member, currentLogin: index === 0 ? 'kichnifou' : member.legacyLogin,
    displayName: `Synthetic domain ${index}`, renamed: index === 0 }));
  const historicalReport: VerifiedTwitchReport = { version: 1, verification: 'TWITCH_HELIX', snapshotHash: snapshot.hash,
    resolvedAt: new Date(Date.now() - 1000).toISOString(), users, missing: names.slice(43, 45), conflicts: [], duplicates: 0 };
  const population = createOwnerApprovedPopulation(historicalReport, snapshot);
  const freshReport = createVerifiedTwitchReport(snapshot, { users, missing: [], conflicts: [], duplicates: 0 }, new Date(), { kind: 'FINAL_POPULATION', population });
  const input: RecoverySource = { operationId: randomUUID(), sourceFiles, historicalSourceFiles: sourceFiles, population, historicalReport, freshReport, cutoverAt: recoveryImportedAt };
  const populationHash = validateRecoverySource(input).populationHash;
  const reports = users.map(user => createVerifiedTwitchReport(snapshot, { users: [user], missing: [], conflicts: [], duplicates: 0 }, new Date(), { kind: 'CANARY', legacyLogin: user.legacyLogin }));
  return { input, approved, snapshot, reports, population, populationHash, reportHashes: reports.map(identityProofHash) };
}
