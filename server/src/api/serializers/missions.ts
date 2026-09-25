import type { CurrentPlayerMissions } from '../../application/missions/get-current-player-missions.js';
import type { PermanentMissionProjection, PermanentMissionProjectionEntry } from '../../application/missions/permanent-mission-service.js';

export function toCurrentPlayerMissionsDto(view: CurrentPlayerMissions) {
  return { catchUpApplied: view.catchUpApplied, ...toPermanentMissionProjectionDto(view) };
}

/** Shared safe projection serializer for future authorized personal or profile consumers. */
export function toPermanentMissionProjectionDto(view: PermanentMissionProjection) {
  return {
    ranks: {
      B: view.ranks.B.map(toMissionDto),
      A: view.ranks.A.map(toMissionDto),
      S: view.ranks.S.map(toMissionDto),
    },
    z: view.z.status === 'LOCKED'
      ? { status: 'LOCKED' as const }
      : {
          status: view.z.status,
          unlockedAt: view.z.unlockedAt.toISOString(),
          missions: view.z.missions.map(toMissionDto),
        },
  };
}

export function toMissionDto(mission: PermanentMissionProjectionEntry) {
  return {
    externalKey: mission.externalKey,
    rank: mission.rank,
    displayName: mission.displayName,
    description: mission.description,
    progressLabel: mission.progressLabel,
    progress: mission.progress.toString(),
    target: mission.target.toString(),
    status: mission.status,
    rewardPrimogems: mission.rewardPrimogems.toString(),
    completedAt: mission.completedAt?.toISOString() ?? null,
  };
}
