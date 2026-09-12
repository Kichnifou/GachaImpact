import { useState } from 'react'
import type { DailyRewardClaimDto, DailyRewardTodayDto, ElementKey } from '../api/types'
import { apiErrorMessage } from '../utils/formatters'
import { formatDailyRewardDetails } from '../daily-reward/presentation'

type DailyRewardCardProps = {
  today: DailyRewardTodayDto
  elementKey: ElementKey
  onClaim: () => Promise<DailyRewardClaimDto>
  variant?: 'sidebar' | 'overview'
}

function DailyRewardCard({ today, elementKey, onClaim, variant = 'sidebar' }: DailyRewardCardProps) {
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

  const claimed = today.claimed || freshClaim !== null
  if (variant === 'overview') return (
    <section className="panel daily-overview-card daily-reward-overview-card">
      <div>
        <h2>Récompense quotidienne</h2>
        <p className={claimed ? 'daily-overview-complete' : undefined}>{claimed ? '✅ Terminé' : 'Disponible aujourd’hui.'}</p>
        {claimed && <p className="daily-overview-detail">Récompense récupérée aujourd’hui.</p>}
        {claimed && <p className="daily-overview-obtained">Obtenu : {formatDailyRewardDetails(freshClaim ?? today, elementKey)}</p>}
        {!claimed && <p className={`daily-overview-feedback${errorMessage ? ' error' : ''}`} role={errorMessage ? 'alert' : undefined}>{errorMessage ?? ''}</p>}
      </div>
      {!claimed && <div className="daily-overview-action-slot"><button type="button" className="small-primary-button" onClick={claim} disabled={isClaiming}>{isClaiming ? 'Récupération…' : 'Récupérer'}</button></div>}
    </section>
  )

  return (
    <section className="panel daily-card">
      <div className="daily-icon" aria-hidden="true">♢</div>
      <div>
        <span className="eyebrow">Récompense quotidienne</span>
        {freshClaim ? (
          <p role="status"><strong className="daily-overview-complete">✅ Terminé</strong><br />Récompense récupérée aujourd’hui.<br />{formatDailyRewardDetails(freshClaim, elementKey)}</p>
        ) : today.claimed ? (
          <p role="status"><strong className="daily-overview-complete">✅ Terminé</strong><br />Récompense récupérée aujourd’hui.</p>
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
