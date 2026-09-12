import { describe, expect, it } from 'vitest'
import type { BoxCharacterDto, ExpeditionDto } from '../api/types'
import { expeditionOverview, prioritizeReady } from './expedition-presentation'

const character = { id: 'ready', externalKey: 'ready', name: 'Furina', rarity: 5, elementKey: 'hydro', weaponType: null, region: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null } as const
const idle: ExpeditionDto = { businessDate: '2026-09-12', operationalStatus: 'IDLE', departureUsedToday: false, canStartToday: true, activeCharacter: null, departedAt: null, readyAt: null, remainingSeconds: 0, startedOnCurrentBusinessDate: false, totalCompleted: '0' }
describe('Expedition presentation', () => {
  it('uses the four exact Quotidiennes states without a fake obtained reward', () => {
    expect(expeditionOverview(idle, 0)).toEqual({ status: 'À faire', detail: 'Aucune expédition lancée aujourd’hui.', completed: false })
    expect(expeditionOverview({ ...idle, operationalStatus: 'RUNNING', activeCharacter: character, readyAt: '1970-01-01T01:00:00Z' }, 0)).toMatchObject({ status: 'En cours', detail: 'Furina · 01:00:00 · Départ précédent · le départ du jour sera disponible après récupération.' })
    expect(expeditionOverview({ ...idle, operationalStatus: 'READY', activeCharacter: character }, 0)).toMatchObject({ status: 'À récupérer', detail: 'Furina est revenu. Le départ du jour reste disponible après récupération.' })
    expect(expeditionOverview({ ...idle, departureUsedToday: true, canStartToday: false }, 0)).toEqual({ status: '✅ Terminé', detail: 'Expédition effectuée aujourd’hui.', completed: true })
  })
  it('places READY before favorites without changing card data', () => {
    const base = { externalKey: 'x', rarity: 5, elementKey: 'hydro', weaponType: null, region: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null, constellation: 0, copies: 1, firstObtainedAt: '2026-01-01', c6CompetitionStats: null } as const
    const rows = [{ ...base, id: 'favorite', name: 'Favorite', favorite: true }, { ...base, id: 'ready', name: 'Ready', favorite: false }] satisfies BoxCharacterDto[]
    expect(prioritizeReady(rows, { ...idle, operationalStatus: 'READY', activeCharacter: character }).map(row => row.id)).toEqual(['ready', 'favorite'])
  })
})
