import type { DailyChallengeDto } from '../api/types'
import { apiErrorMessage } from '../utils/formatters'

type AssignedChallenge = NonNullable<DailyChallengeDto['challenge']>

export function dailyChallengeProgressSentence(challenge: AssignedChallenge): string {
  const unit = challenge.type === 'pulls'
    ? 'Invocations effectuées'
    : challenge.type === 'conversion'
      ? 'particules converties'
      : 'messages comptabilisés'
  return `${challenge.progress} / ${challenge.target} ${unit}.`
}

export function dailyChallengeErrorMessage(error: unknown, action: 'purchase' | 'switch'): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null
  const messages: Readonly<Record<string, string>> = {
    DAILY_CHALLENGE_ALREADY_ASSIGNED: 'Vous avez déjà un Défi aujourd’hui.',
    DAILY_CHALLENGE_NOT_ASSIGNED: 'Aucun Défi n’est attribué aujourd’hui.',
    DAILY_CHALLENGE_SWITCH_UNAVAILABLE: 'Ce Défi ne peut plus être changé.',
    DAILY_CHALLENGE_POOL_UNAVAILABLE: 'Aucun autre Défi n’est disponible pour le moment.',
    DAILY_CHALLENGE_IDEMPOTENCY_CONFLICT: 'Une opération précédente doit d’abord être vérifiée ou reprise avant de continuer.',
  }
  if (code === 'DAILY_CHALLENGE_WALLET_INSUFFICIENT') {
    return action === 'purchase'
      ? 'Vous n’avez pas assez de Moras pour acheter le Défi.'
      : 'Vous n’avez pas assez de Moras pour changer de Défi.'
  }
  return typeof code === 'string' && messages[code] ? messages[code] : apiErrorMessage(error)
}

export function isDailyChallengeCompletionTransition(previous: DailyChallengeDto['status'], next: DailyChallengeDto): boolean {
  return previous === 'ACTIVE' && next.status === 'COMPLETED' && next.challenge !== null
}
