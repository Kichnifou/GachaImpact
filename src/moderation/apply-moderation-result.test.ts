import { describe, expect, it, vi } from 'vitest'
import type { ModerationStateDto } from '../api/types'
import { applyModerationResultToActor } from './apply-moderation-result'

const result = (playerId: string): ModerationStateDto => ({
  player: { id: playerId, displayName: playerId, elementKey: 'hydro', level: 1, tester: false },
  permissions: { roles: ['ADMIN'], capabilities: { moderationAccess: true, selfResourceTools: true, selfGameplayTools: true, superTools: true, canSelectPlayers: true, canManageTesters: true } },
  resources: { primogems: '0', moras: '0', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } },
  progression: { totalXp: '0', level: 1, xpIntoCurrentStep: '0', xpPerStep: '30', isMaxLevel: false, level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0' },
  gachaState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
  stella: { quantity: '42' },
})

describe('moderation result actor isolation', () => {
  it('does not synchronize actor caches for an external target', () => {
    const syncActorStella = vi.fn()
    const onApplied = vi.fn()
    const external = result('external-player')
    applyModerationResultToActor({ actorPlayerId: 'self', result: external, syncActorStella, onApplied })
    expect(syncActorStella).not.toHaveBeenCalled()
    expect(onApplied).toHaveBeenCalledWith(external, false)
  })

  it('synchronizes actor caches for a self-targeted result', () => {
    const syncActorStella = vi.fn()
    const onApplied = vi.fn()
    const self = result('self')
    applyModerationResultToActor({ actorPlayerId: 'self', result: self, syncActorStella, onApplied })
    expect(syncActorStella).toHaveBeenCalledWith('42')
    expect(onApplied).toHaveBeenCalledWith(self, true)
  })
})
