import type { PlayerMissionsDto } from '../api/types'

export function createMissionLoader(
  loadMissions: () => Promise<PlayerMissionsDto>,
  refreshResources: () => Promise<unknown>,
): () => Promise<PlayerMissionsDto> {
  let resourceRefreshPending = false
  return async () => {
    const missions = await loadMissions()
    resourceRefreshPending ||= missions.catchUpApplied
    if (resourceRefreshPending) {
      await refreshResources()
      resourceRefreshPending = false
    }
    return missions
  }
}
