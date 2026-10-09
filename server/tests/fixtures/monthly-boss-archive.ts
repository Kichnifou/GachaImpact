import { createHash, randomUUID } from 'node:crypto';

export function bossArchiveFixture(counts = [10, 9, 8]) {
  const players = Array.from({ length: Math.max(...counts) }, (_, index) => ({ id: randomUUID(), displayName: `Canonical ${index + 1}`,
    status: 'ACTIVE', twitchIdentity: { twitchUserId: String(800000 + index) } }));
  const bindings = players.map((player, playerIndex) => ({ playerId: player.id, twitchUserId: player.twitchIdentity.twitchUserId,
    instances: counts.map((count, index) => {
      const month = `2026-${String(index + 8).padStart(2, '0')}`, createdAt = `${month}-01T00:00:00.000Z`;
      const defeated = index < counts.length - 1;
      return { sourceBossKey: createHash('sha256').update(JSON.stringify(['streamerbot-boss-v1', month, createdAt])).digest('hex'),
        month, name: `Historical Boss ${index + 1}`, maxHp: String(count * 100 + (defeated ? 0 : 200)), currentHp: defeated ? '0' : '200',
        resistance: 'cryo', defeated, createdAt, defeatedAt: defeated ? `${month}-15T00:00:00.000Z` : null, rewardsDistributed: defeated,
        totalDamage: String(count * 100), totalAttacks: String(count * 2), participantCount: count,
        contribution: playerIndex < count ? { totalDamage: '100', attackCount: '2', bestHit: '60', firstAttackAt: null, lastAttackAt: null,
          lastAttackDate: `${month}-06`, finalBlow: defeated && playerIndex === 0,
          reward: { distributed: defeated, primogems: null, moras: null, awardedAt: null, operationId: null } } : null,
      };
    }) }));
  return { players, projected: { id: randomUUID(), sourceKey: '1'.repeat(64), bindings } };
}
