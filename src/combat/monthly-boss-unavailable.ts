import type { MonthlyBossDto } from '../api/types'

export const unavailableMonthlyBoss: MonthlyBossDto = {
  businessDate: '',
  boss: { id: '00000000-0000-0000-0000-000000000000', monthStart: '2026-01-01', name: 'Boss mensuel indisponible', baseHp: '1', hpVariationPercent: 0, maxHp: '1', currentHp: '1', resistanceElementKey: 'anemo', defeatedAt: null, finalBlowPlayer: null, nextBaseAdjustment: null },
  status: 'ALIVE', attackState: 'AVAILABLE', canAttack: false,
  loadout: { slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null })) },
  availableCharacters: [], preview: null, reward: { primogems: '16000', moras: '500000' }, participation: null, ranking: [], defeatedSummary: null,
  playerStats: { totalDamage: '0', totalAttacks: '0', totalParticipated: '0', totalRewarded: '0', finalBlows: '0', bestHit: '0' },
}
