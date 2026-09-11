import { useState } from 'react'
import type { DailyChallengeDto, DailyChallengeMutationDto, DailyRewardClaimDto, DailyRewardTodayDto, ElementKey, WheelSpinDto, WheelTodayDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import WheelCard from '../components/WheelCard'
import DailyRewardCard from '../components/DailyRewardCard'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import type { ScreenId } from '../types'

type ActivitiesScreenProps = {
  screen: ScreenId
  wheelToday: WheelTodayDto
  onSpinWheel: () => Promise<WheelSpinDto>
  dailyRewardToday: DailyRewardTodayDto
  elementKey: ElementKey
  onClaimDailyReward: () => Promise<DailyRewardClaimDto>
  dailyChallenge: DailyChallengeDto
  onPurchaseDailyChallenge: (idempotencyKey: string) => Promise<DailyChallengeMutationDto>
  onSwitchDailyChallenge: (idempotencyKey: string) => Promise<DailyChallengeMutationDto>
  onNavigate: (screen: ScreenId) => void
}

function ActivitiesScreen({ screen, wheelToday, onSpinWheel, dailyRewardToday, dailyChallenge, elementKey, onClaimDailyReward, onPurchaseDailyChallenge, onSwitchDailyChallenge, onNavigate }: ActivitiesScreenProps) {
  if (screen === 'activities-dailies') return <DailiesScreen wheelToday={wheelToday} onSpinWheel={onSpinWheel} dailyRewardToday={dailyRewardToday} dailyChallenge={dailyChallenge} elementKey={elementKey} onClaimDailyReward={onClaimDailyReward} onPurchaseDailyChallenge={onPurchaseDailyChallenge} onSwitchDailyChallenge={onSwitchDailyChallenge} onNavigate={onNavigate} />
  const content = screen === 'activities-missions' ? { title: 'Missions', description: 'Les missions permanentes seront disponibles ici.', tabs: ['B', 'A', 'S', 'Z'] } : screen === 'activities-combat' ? { title: 'Combat', description: 'Le domaine Combat n’est pas encore disponible dans cette version.', tabs: ['Entraînement', 'Boss'] } : screen === 'activities-event' ? { title: 'Événement', description: 'Les événements mensuels seront accessibles ici.', tabs: ['Jeux', 'Shop', 'Classement'] } : { title: 'Concours', description: 'Le Concours C6 sera accessible ici lorsqu’il sera implémenté.', tabs: [] }
  return <div className="screen-content activity-shell"><ScreenHeader eyebrow="Activités" title={content.title} description={content.description} /><nav className="activity-inner-tabs" aria-label={`Sections ${content.title}`}>{content.tabs.map((tab) => <button type="button" disabled key={tab}>{tab}</button>)}</nav><section className="panel unavailable-shell"><strong>Bientôt disponible</strong><p>Aucune progression fictive n’est affichée.</p></section></div>
}

type DailyOverviewCardProps = {
  title: string
  status: string
  onAccess?: () => void
  accessLabel?: string
}

function DailyOverviewCard({ title, status, onAccess, accessLabel }: DailyOverviewCardProps) {
  return (
    <section className="panel daily-overview-card" data-daily-activity={title}>
      <div>
        <h2>{title}</h2>
        <p>{status}</p>
      </div>
      <button type="button" className="small-primary-button" onClick={onAccess} disabled={!onAccess} aria-label={accessLabel ?? `Accéder à ${title}`}>Accéder</button>
    </section>
  )
}

function DailiesScreen({ wheelToday, onSpinWheel, dailyRewardToday, dailyChallenge, elementKey, onClaimDailyReward, onPurchaseDailyChallenge, onSwitchDailyChallenge, onNavigate }: Omit<ActivitiesScreenProps, 'screen'>) {
  const [tab, setTab] = useState<'overview' | 'wheel' | 'challenge'>('overview')
  const tabs = <nav className="activity-inner-tabs" aria-label="Sections Quotidiennes"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Aperçu</button><button className={tab === 'wheel' ? 'active' : ''} onClick={() => setTab('wheel')}>Roue</button><button className={tab === 'challenge' ? 'active' : ''} onClick={() => setTab('challenge')}>Défi</button></nav>
  const challengeStatus = dailyChallenge.status === 'COMPLETED' ? '✅ Terminé' : dailyChallenge.assigned && dailyChallenge.challenge ? `${dailyChallenge.challenge.displayName} · ${dailyChallenge.challenge.progress} / ${dailyChallenge.challenge.target}` : `Disponible — ${formatResourceAmount(dailyChallenge.purchaseCost)} Moras`
  return <div className="screen-content activity-shell dailies-shell long-screen-layout"><ScreenHeader eyebrow="Activités" title="Quotidiennes" description="Retrouvez les activités du jour et leur disponibilité réelle." /><ScrollableScreenPanel className="dailies-frame" fixed={tabs}>{tab === 'overview' && <div className="dailies-overview"><div className="daily-overview-item" data-daily-activity="Récompense quotidienne"><DailyRewardCard today={dailyRewardToday} elementKey={elementKey} onClaim={onClaimDailyReward} /></div><DailyOverviewCard title="Roue" status={wheelToday.spun ? 'Déjà utilisée aujourd’hui.' : 'Une tentative disponible aujourd’hui.'} onAccess={() => setTab('wheel')} /><DailyOverviewCard title="Défi" status={challengeStatus} onAccess={() => setTab('challenge')} /><DailyOverviewCard title="Combat" status="Bientôt disponible. Entraînement et Boss sont indisponibles." onAccess={() => onNavigate('activities-combat')} /><DailyOverviewCard title="Expédition" status="Bientôt disponible. Le système Expédition n’est pas encore implémenté." onAccess={() => onNavigate('characters-box')} /><DailyOverviewCard title="Amitié" status="Bientôt disponible. Social et Amis ne sont pas encore implémentés." accessLabel="Accéder à Amitié — Social et Amis bientôt disponibles" /><DailyOverviewCard title="Événement" status="Bientôt disponible. Le système Événement n’est pas encore implémenté." onAccess={() => onNavigate('activities-event')} /></div>}{tab === 'wheel' && <WheelCard today={wheelToday} onSpin={onSpinWheel} />}{tab === 'challenge' && <DailyChallengeCard value={dailyChallenge} onPurchase={onPurchaseDailyChallenge} onSwitch={onSwitchDailyChallenge} />}</ScrollableScreenPanel></div>
}

function DailyChallengeCard({ value, onPurchase, onSwitch }: { value: DailyChallengeDto; onPurchase: (key: string) => Promise<DailyChallengeMutationDto>; onSwitch: (key: string) => Promise<DailyChallengeMutationDto> }) {
  const [pending, setPending] = useState<'purchase' | 'switch' | null>(null)
  const [intent, setIntent] = useState<{ action: 'purchase' | 'switch'; key: string } | null>(null)
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: 'purchase' | 'switch') => {
    if (pending) return
    const current = intent?.action === action ? intent : { action, key: crypto.randomUUID() }
    setIntent(current); setPending(action); setError(null)
    try { await (action === 'purchase' ? onPurchase(current.key) : onSwitch(current.key)); setIntent(null); setConfirmSwitch(false) }
    catch (reason) { if (!isAmbiguousMutationError(reason)) setIntent(null); setError(apiErrorMessage(reason)) }
    finally { setPending(null) }
  }
  if (!value.assigned || !value.challenge) return <section className="panel daily-challenge-card available"><span className="eyebrow">Quotidiennes</span><h2>Défi du jour</h2><p>Obtenez un objectif aléatoire à accomplir avant le reset journalier. L’objectif vous sera révélé après l’achat.</p><dl><div><dt>Prix</dt><dd>{formatResourceAmount(value.purchaseCost)} Moras</dd></div><div><dt>Récompense</dt><dd>800 Primogemmes</dd></div></dl>{error && <p role="alert">{error}</p>}<button type="button" className="small-primary-button" disabled={Boolean(pending)} onClick={() => void run('purchase')}>{pending === 'purchase' ? 'Attribution…' : 'Acheter le Défi'}</button></section>
  const challenge = value.challenge
  const progressPercent = Number(BigInt(challenge.progress) * 100n / BigInt(challenge.target))
  const requestSwitch = () => BigInt(challenge.progress) > 0n ? setConfirmSwitch(true) : void run('switch')
  return <section className={`panel daily-challenge-card ${value.status.toLowerCase()}`}><span className="eyebrow">Défi du jour · {value.businessDate}</span><h2>{challenge.displayName}</h2><p>{challenge.description}</p><div className="daily-challenge-progress" aria-label={`${challenge.progress} sur ${challenge.target}`}><span style={{ width: `${progressPercent}%` }} /></div><strong>{challenge.progress} / {challenge.target} {challenge.progressLabel}</strong>{value.status === 'COMPLETED' ? <><p className="daily-challenge-complete">✅ Terminé</p><p>{challenge.rewardPrimogems} Primogemmes reçues.</p></> : <><p>État : Actif · Récompense : {challenge.rewardPrimogems} Primogemmes</p><button type="button" className="daily-challenge-switch-button" disabled={!value.canSwitch || Boolean(pending)} onClick={requestSwitch}>Changer de Défi · {formatResourceAmount(value.nextSwitchCost ?? '0')} Moras</button></>}{error && <p role="alert">{error}</p>}{confirmSwitch && <div className="daily-challenge-confirm" role="dialog" aria-label="Confirmer le remplacement"><p>Votre progression sera perdue. Remplacer ce Défi pour {formatResourceAmount(value.nextSwitchCost ?? '0')} Moras ?</p><button type="button" onClick={() => setConfirmSwitch(false)}>Annuler</button><button type="button" className="small-primary-button" disabled={Boolean(pending)} onClick={() => void run('switch')}>Confirmer</button></div>}</section>
}
export default ActivitiesScreen
