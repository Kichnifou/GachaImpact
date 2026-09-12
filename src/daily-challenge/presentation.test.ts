import { describe, expect, it } from 'vitest'
import { dailyChallengeErrorMessage } from './presentation'

describe('daily challenge presentation', () => {
  it.each([
    ['DAILY_CHALLENGE_ALREADY_ASSIGNED', 'Vous avez déjà un Défi aujourd’hui.'],
    ['DAILY_CHALLENGE_NOT_ASSIGNED', 'Aucun Défi n’est attribué aujourd’hui.'],
    ['DAILY_CHALLENGE_SWITCH_UNAVAILABLE', 'Ce Défi ne peut plus être changé.'],
    ['DAILY_CHALLENGE_POOL_UNAVAILABLE', 'Aucun autre Défi n’est disponible pour le moment.'],
    ['DAILY_CHALLENGE_IDEMPOTENCY_CONFLICT', 'Une opération précédente doit d’abord être vérifiée ou reprise avant de continuer.'],
  ])('maps %s to an explicit player-facing message', (code, expected) => {
    expect(dailyChallengeErrorMessage({ code }, 'purchase')).toBe(expected)
  })

  it('makes an insufficient wallet message contextual to purchase or switch', () => {
    const error = { code: 'DAILY_CHALLENGE_WALLET_INSUFFICIENT' }
    expect(dailyChallengeErrorMessage(error, 'purchase')).toBe('Vous n’avez pas assez de Moras pour acheter le Défi.')
    expect(dailyChallengeErrorMessage(error, 'switch')).toBe('Vous n’avez pas assez de Moras pour changer de Défi.')
  })

  it('keeps the shared API fallback for an unknown error', () => {
    expect(dailyChallengeErrorMessage({ code: 'UNKNOWN', message: 'Erreur contrôlée.' }, 'purchase')).toBe('La demande n’a pas pu être traitée.')
  })
})
