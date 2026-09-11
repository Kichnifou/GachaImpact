import type { DailyChallengeDto } from '../api/types'

type AssignedChallenge = NonNullable<DailyChallengeDto['challenge']>

export function dailyChallengeProgressSentence(challenge: AssignedChallenge): string {
  const unit = challenge.type === 'pulls'
    ? 'Invocations effectuées'
    : challenge.type === 'conversion'
      ? 'particules converties'
      : 'messages comptabilisés'
  return `${challenge.progress} / ${challenge.target} ${unit}.`
}

export function isDailyChallengeCompletionTransition(previous: DailyChallengeDto['status'], next: DailyChallengeDto): boolean {
  return previous === 'ACTIVE' && next.status === 'COMPLETED' && next.challenge !== null
}
