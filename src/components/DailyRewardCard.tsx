import { useState } from 'react'
import type { DailyRewardClaimDto, DailyRewardTodayDto, ElementKey } from '../api/types'
import { apiErrorMessage } from '../utils/formatters'
import { formatDailyRewardDetails } from '../daily-reward/presentation'

type DailyRewardCardProps = {
  today: DailyRewardTodayDto
  elementKey: ElementKey
  onClaim: () => Promise<DailyRewardClaimDto>
}

function DailyRewardCard({ today, elementKey, onClaim }: DailyRewardCardProps) {
  const [isClaiming, setIsClaiming] = useState(false)
  const [freshClaim, setFreshClaim] = useState<DailyRewardClaimDto | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const claim = async () => {
    if (today.claimed || isClaiming) return
    setIsClaiming(true)
    setErrorMessage(null)
    try {
      const result = await onClaim()
      setFreshClaim(result.alreadyClaimed ? null : result)
    } catch (error) {
      setErrorMessage(apiErrorMessage(error))
    } finally {
      setIsClaiming(false)
    }
  }

  return (
    <section className="panel daily-card">
      <div className="daily-icon" aria-hidden="true">♢</div>
      <div>
        <span className="eyebrow">Récompense quotidienne</span>
        {freshClaim ? (
          <p role="status"><strong>Récompense récupérée !</strong><br />{formatDailyRewardDetails(freshClaim, elementKey)}</p>
        ) : today.claimed ? (
          <p role="status">Déjà récupérée aujourd’hui.</p>
        ) : (
          <p>Votre cadeau du jour est prêt.</p>
        )}
        {errorMessage && <p className="form-feedback error" role="alert">{errorMessage}</p>}
        {!today.claimed && <button type="button" className="small-primary-button" onClick={claim} disabled={isClaiming}>{isClaiming ? 'Récupération…' : 'Récupérer'}</button>}
      </div>
    </section>
  )
}

export default DailyRewardCard
