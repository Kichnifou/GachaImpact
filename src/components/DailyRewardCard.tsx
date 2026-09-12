import { useState } from 'react'
import type { DailyRewardClaimDto, DailyRewardTodayDto, ElementKey } from '../api/types'
import { apiErrorMessage } from '../utils/formatters'
import { formatDailyRewardDetails } from '../daily-reward/presentation'

type DailyRewardCardProps = {
  variant: 'overview'
  today: DailyRewardTodayDto
  elementKey: ElementKey
  onClaim: () => Promise<DailyRewardClaimDto>
} | {
  variant?: 'sidebar'
  onOpenOverview?: () => void
}

function DailyRewardCard(props: DailyRewardCardProps) {
  if (props.variant !== 'overview') return <button type="button" className="panel daily-card daily-card-navigation" onClick={props.onOpenOverview} aria-label="Ouvrir Quotidiennes, aperçu du jour">
    <span className="daily-navigation-copy"><strong>Quotidiennes</strong><span>Aperçu du jour</span><small>Consultez vos activités quotidiennes.</small><em>Ouvrir l’aperçu →</em></span>
  </button>

  return <DailyRewardOverviewCard variant="overview" today={props.today} elementKey={props.elementKey} onClaim={props.onClaim} />
}

function DailyRewardOverviewCard({ today, elementKey, onClaim }: Extract<DailyRewardCardProps, { variant: 'overview' }>) {
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
  return (
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
}

export default DailyRewardCard
