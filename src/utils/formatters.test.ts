import { describe, expect, it } from 'vitest'

import { apiErrorMessage, formatResourceAmount, formatWheelResult, formatFreshWheelResult, formatWheelOverviewResult } from './formatters'

describe('gameplay presentation mapping', () => {
  it.each([
    [{ resultType: 'nothing', resourceKey: null, amount: null }, 'Pas de gain'],
    [{ resultType: 'particles', resourceKey: 'particles_cryo', amount: '500' }, '✨ Félicitations ! Tu obtiens +500 particules Cryo !'],
    [{ resultType: 'moras', resourceKey: 'moras', amount: '50000' }, '🎉 Félicitations ! Tu obtiens +50 000 Moras !'],
    [{ resultType: 'primogems', resourceKey: 'primogems', amount: '1600' }, '🌟 JACKPOT ! +1 600 Primos !'],
  ] as const)('celebrates only actual fresh rewards', (result, expected) => {
    expect(formatFreshWheelResult(result)).toContain(expected)
    expect(formatFreshWheelResult(result)).not.toContain('Déjà utilisée')
  })
  it('formats lossless bigint strings without converting through number', () => {
    expect(formatResourceAmount('9007199254740993')).toBe(
      9_007_199_254_740_993n.toLocaleString('fr-FR'),
    )
  })

  it.each([
    [{ resultType: 'nothing', resourceKey: null, amount: null }, 'rien aujourd’hui'],
    [{ resultType: 'particles', resourceKey: 'particles_hydro', amount: '500' }, '500 particules Hydro'],
    [{ resultType: 'moras', resourceKey: 'moras', amount: '50000' }, '50 000 Moras'],
    [{ resultType: 'primogems', resourceKey: 'primogems', amount: '1600' }, '1 600 Primos'],
  ] as const)('maps a Wheel result to readable French', (result, expectedText) => {
    expect(
      formatWheelResult(result),
    ).toContain(expectedText)
  })

  it.each([
    [{ resultType: 'nothing', resourceKey: null, amount: null }, 'Rien'],
    [{ resultType: 'particles', resourceKey: 'particles_hydro', amount: '500' }, '+500 particules Hydro'],
    [{ resultType: 'moras', resourceKey: 'moras', amount: '50000' }, '+50 000 Moras'],
    [{ resultType: 'primogems', resourceKey: 'primogems', amount: '1600' }, '+1 600 Primos'],
  ] as const)('keeps the completed overview result compact and factual', (result, expected) => {
    const text = formatWheelOverviewResult(result)
    expect(text).toBe(expected)
    expect(text).not.toMatch(/JACKPOT|Félicitations/)
  })

  it.each([
    ['DAILY_COMBAT_POSITION_INVALID', 'Cet emplacement de Combat est invalide.'],
    ['DAILY_COMBAT_CHARACTER_NOT_OWNED', 'Ce personnage ne fait pas partie de votre Box.'],
    ['DAILY_COMBAT_CHARACTER_INACTIVE', 'Ce personnage n’est plus disponible.'],
    ['DAILY_COMBAT_CHARACTER_DUPLICATE', 'Ce personnage est déjà sélectionné.'],
    ['DAILY_COMBAT_LOADOUT_INCOMPLETE', 'Sélectionnez 4 personnages.'],
    ['DAILY_COMBAT_CHARACTER_KO', 'Un personnage sélectionné est KO jusqu’à demain.'],
    ['DAILY_COMBAT_ALREADY_COMPLETED', 'Le Combat quotidien est déjà terminé.'],
    ['DAILY_COMBAT_NOT_ENOUGH_AVAILABLE', 'Vous n’avez plus assez de personnages disponibles aujourd’hui.'],
    ['DAILY_COMBAT_ENCOUNTER_UNAVAILABLE', 'Le Combat du jour est momentanément indisponible.'],
    ['DAILY_COMBAT_IDEMPOTENCY_CONFLICT', 'Une tentative précédente doit d’abord être vérifiée ou reprise avant de continuer.'],
  ] as const)('maps the known Combat error %s to controlled player-facing copy', (code, expected) => {
    const message = apiErrorMessage({ code })
    expect(message).toBe(expected)
    expect(message).not.toBe('La demande n’a pas pu être traitée.')
  })
})
