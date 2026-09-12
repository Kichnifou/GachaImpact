import { useState } from 'react'
import type { DailyChallengeDto, DailyChallengeMutationDto, DailyCombatDto, DailyCombatFightDto, DailyRewardClaimDto, DailyRewardTodayDto, ElementKey, WheelSpinDto, WheelTodayDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { formatResourceAmount, formatWheelOverviewResult } from '../utils/formatters'
import WheelCard from '../components/WheelCard'
import DailyRewardCard from '../components/DailyRewardCard'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import type { ScreenId } from '../types'
import { dailyChallengeErrorMessage, dailyChallengeProgressSentence } from '../daily-challenge/presentation'
import DailyCombatScreen from './DailyCombatScreen'

type ActivitiesScreenProps = {
  screen: ScreenId
  wheelToday: WheelTodayDto
  onSpinWheel: () => Promise<WheelSpinDto>
  dailyRewardToday: DailyRewardTodayDto
  elementKey: ElementKey
  onClaimDailyReward: () => Promise<DailyRewardClaimDto>
  dailyChallenge: DailyChallengeDto
  dailyCombat?: DailyCombatDto
  dailiesOverviewRequestToken?: number
  onPurchaseDailyChallenge: (idempotencyKey: string) => Promise<DailyChallengeMutationDto>
  onSwitchDailyChallenge: (idempotencyKey: string) => Promise<DailyChallengeMutationDto>
  onSetDailyCombatSlot?: (position: number, characterId: string) => Promise<DailyCombatDto>
  onRemoveDailyCombatSlot?: (position: number) => Promise<DailyCombatDto>
  onCopyActiveTeamToDailyCombat?: () => Promise<DailyCombatDto>
  onAutoSelectDailyCombat?: () => Promise<DailyCombatDto>
  onClearDailyCombatLoadout?: () => Promise<DailyCombatDto>
  onFightDailyCombat?: (idempotencyKey: string) => Promise<DailyCombatFightDto>
  onOpenParticleConversion: () => void
  onNavigate: (screen: ScreenId) => void
}

function ActivitiesScreen({ screen, wheelToday, onSpinWheel, dailyRewardToday, dailyChallenge, dailyCombat = unavailableDailyCombat, dailiesOverviewRequestToken = 0, elementKey, onClaimDailyReward, onPurchaseDailyChallenge, onSwitchDailyChallenge, onSetDailyCombatSlot = async () => unavailableDailyCombat, onRemoveDailyCombatSlot = async () => unavailableDailyCombat, onCopyActiveTeamToDailyCombat = async () => unavailableDailyCombat, onAutoSelectDailyCombat = async () => unavailableDailyCombat, onClearDailyCombatLoadout = async () => unavailableDailyCombat, onFightDailyCombat = async () => { throw new Error('Combat indisponible.') }, onOpenParticleConversion, onNavigate }: ActivitiesScreenProps) {
  if (screen === 'activities-dailies') return <DailiesScreen wheelToday={wheelToday} onSpinWheel={onSpinWheel} dailyRewardToday={dailyRewardToday} dailyChallenge={dailyChallenge} dailyCombat={dailyCombat} dailiesOverviewRequestToken={dailiesOverviewRequestToken} elementKey={elementKey} onClaimDailyReward={onClaimDailyReward} onPurchaseDailyChallenge={onPurchaseDailyChallenge} onSwitchDailyChallenge={onSwitchDailyChallenge} onSetDailyCombatSlot={onSetDailyCombatSlot} onRemoveDailyCombatSlot={onRemoveDailyCombatSlot} onCopyActiveTeamToDailyCombat={onCopyActiveTeamToDailyCombat} onAutoSelectDailyCombat={onAutoSelectDailyCombat} onClearDailyCombatLoadout={onClearDailyCombatLoadout} onFightDailyCombat={onFightDailyCombat} onOpenParticleConversion={onOpenParticleConversion} onNavigate={onNavigate} />
  if (screen === 'activities-combat') return <DailyCombatScreen value={dailyCombat} onSetSlot={onSetDailyCombatSlot} onRemoveSlot={onRemoveDailyCombatSlot} onCopyActive={onCopyActiveTeamToDailyCombat} onAuto={onAutoSelectDailyCombat} onClear={onClearDailyCombatLoadout} onFight={onFightDailyCombat} />
  const content = screen === 'activities-missions' ? { title: 'Missions', description: 'Les missions permanentes seront disponibles ici.', tabs: ['B', 'A', 'S', 'Z'] } : screen === 'activities-event' ? { title: 'Événement', description: 'Les événements mensuels seront accessibles ici.', tabs: ['Jeux', 'Shop', 'Classement'] } : { title: 'Concours', description: 'Le Concours C6 sera accessible ici lorsqu’il sera implémenté.', tabs: [] }
  return <div className="screen-content activity-shell"><ScreenHeader eyebrow="Activités" title={content.title} description={content.description} /><nav className="activity-inner-tabs" aria-label={`Sections ${content.title}`}>{content.tabs.map((tab) => <button type="button" disabled key={tab}>{tab}</button>)}</nav><section className="panel unavailable-shell"><strong>Bientôt disponible</strong><p>Aucune progression fictive n’est affichée.</p></section></div>
}

const unavailableDailyCombat: DailyCombatDto = {
  businessDate: '', status: 'BLOCKED', encounter: { id: '', enemies: [] },
  loadout: { nextAttemptMode: 'MANUAL', slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null, ko: false })) },
  availableCharacters: [], koCharacterIds: [], availableCharacterCount: 0, preview: null, canFight: false,
  reward: { primogems: '800', moras: '20000' }, lastAttempt: null,
  playerStats: { totalFights: '0', totalWins: '0', totalLosses: '0', totalManualWins: '0' },
}

type DailyOverviewCardProps = {
  title: string
  status: string
  completed?: boolean
  detail?: string
  obtained?: string
  onAccess?: () => void
  accessLabel?: string
}

function DailyOverviewCard({ title, status, completed = false, detail, obtained, onAccess, accessLabel }: DailyOverviewCardProps) {
  return (
    <section className="panel daily-overview-card" data-daily-activity={title}>
      <div>
        <h2>{title}</h2>
        <p className={completed ? 'daily-overview-complete' : undefined}>{status}</p>
        {detail && <p className="daily-overview-detail">{detail}</p>}
        {obtained && <p className="daily-overview-obtained">Obtenu : {obtained}</p>}
      </div>
      {!completed && <div className="daily-overview-action-slot"><button type="button" className="small-primary-button" onClick={onAccess} disabled={!onAccess} aria-label={accessLabel ?? `Accéder à ${title}`}>Accéder</button></div>}
    </section>
  )
}

function DailiesScreen({ wheelToday, onSpinWheel, dailyRewardToday, dailyChallenge, dailyCombat = unavailableDailyCombat, dailiesOverviewRequestToken = 0, elementKey, onClaimDailyReward, onPurchaseDailyChallenge, onSwitchDailyChallenge, onOpenParticleConversion, onNavigate }: Omit<ActivitiesScreenProps, 'screen'>) {
  const [selection, setSelection] = useState<{ tab: 'overview' | 'wheel' | 'challenge'; requestToken: number }>({ tab: 'overview', requestToken: dailiesOverviewRequestToken })
  const tab = selection.requestToken === dailiesOverviewRequestToken ? selection.tab : 'overview'
  const selectTab = (next: typeof tab) => setSelection({ tab: next, requestToken: dailiesOverviewRequestToken })
  const tabs = <nav className="activity-inner-tabs" aria-label="Sections Quotidiennes"><button className={tab === 'overview' ? 'active' : ''} onClick={() => selectTab('overview')}>Aperçu</button><button className={tab === 'wheel' ? 'active' : ''} onClick={() => selectTab('wheel')}>Roue</button><button className={tab === 'challenge' ? 'active' : ''} onClick={() => selectTab('challenge')}>Défi</button></nav>
  const challengeCompleted = dailyChallenge.status === 'COMPLETED' && Boolean(dailyChallenge.challenge)
  const challengeStatus = challengeCompleted ? '✅ Terminé' : dailyChallenge.assigned && dailyChallenge.challenge ? `${dailyChallenge.challenge.displayName} · ${dailyChallenge.challenge.progress} / ${dailyChallenge.challenge.target}` : `Disponible — ${formatResourceAmount(dailyChallenge.purchaseCost)} Moras`
  const combatOverview = dailyCombatOverview(dailyCombat)
  return <div className="screen-content activity-shell dailies-shell long-screen-layout"><ScreenHeader eyebrow="Activités" title="Quotidiennes" description="Retrouvez les activités du jour et leur disponibilité réelle." /><ScrollableScreenPanel className="dailies-frame" fixed={tabs}>{tab === 'overview' && <div className="dailies-overview"><div className="daily-overview-item" data-daily-activity="Récompense quotidienne"><DailyRewardCard variant="overview" today={dailyRewardToday} elementKey={elementKey} onClaim={onClaimDailyReward} /></div><DailyOverviewCard title="Roue" status={wheelToday.spun ? '✅ Terminé' : 'Une tentative disponible aujourd’hui.'} completed={wheelToday.spun} detail={wheelToday.spun ? 'Roue utilisée aujourd’hui.' : undefined} obtained={wheelToday.spun && wheelToday.result ? formatWheelOverviewResult(wheelToday.result) : undefined} onAccess={() => selectTab('wheel')} /><DailyOverviewCard title="Défi" status={challengeStatus} completed={challengeCompleted} detail={challengeCompleted ? dailyChallengeProgressSentence(dailyChallenge.challenge!) : undefined} obtained={challengeCompleted ? `+${formatResourceAmount(dailyChallenge.challenge!.rewardPrimogems)} Primogemmes` : undefined} onAccess={() => selectTab('challenge')} /><DailyOverviewCard title="Combat" status={combatOverview.status} completed={dailyCombat.status === 'COMPLETED'} detail={combatOverview.detail} obtained={dailyCombat.status === 'COMPLETED' ? `+${formatResourceAmount(dailyCombat.reward.primogems)} Primogemmes · +${formatResourceAmount(dailyCombat.reward.moras)} Moras` : undefined} onAccess={() => onNavigate('activities-combat')} /><DailyOverviewCard title="Expédition" status="Bientôt disponible. Le système Expédition n’est pas encore implémenté." onAccess={() => onNavigate('characters-box')} /><DailyOverviewCard title="Amitié" status="Bientôt disponible. Social et Amis ne sont pas encore implémentés." accessLabel="Accéder à Amitié — Social et Amis bientôt disponibles" /><DailyOverviewCard title="Événement" status="Bientôt disponible. Le système Événement n’est pas encore implémenté." onAccess={() => onNavigate('activities-event')} /></div>}{tab === 'wheel' && <WheelCard today={wheelToday} onSpin={onSpinWheel} />}{tab === 'challenge' && <DailyChallengeCard value={dailyChallenge} onPurchase={onPurchaseDailyChallenge} onSwitch={onSwitchDailyChallenge} onOpenParticleConversion={onOpenParticleConversion} onNavigate={onNavigate} />}</ScrollableScreenPanel></div>
}

function dailyCombatOverview(value: DailyCombatDto) {
  if (value.status === 'COMPLETED') return { status: '✅ Terminé', detail: 'Victoire obtenue aujourd’hui.' }
  if (value.status === 'BLOCKED') return { status: 'Bloqué aujourd’hui', detail: 'Moins de 4 personnages non-KO sont disponibles.' }
  if (value.status === 'IN_PROGRESS') return { status: 'En cours', detail: `${value.koCharacterIds.length} personnages KO.` }
  return { status: 'À faire', detail: 'Aucune tentative aujourd’hui.' }
}

export function DailyChallengeCard({ value, onPurchase, onSwitch, onOpenParticleConversion, onNavigate }: { value: DailyChallengeDto; onPurchase: (key: string) => Promise<DailyChallengeMutationDto>; onSwitch: (key: string) => Promise<DailyChallengeMutationDto>; onOpenParticleConversion: () => void; onNavigate: (screen: ScreenId) => void }) {
  const [pending, setPending] = useState<'purchase' | 'switch' | null>(null)
  const [intent, setIntent] = useState<{ action: 'purchase' | 'switch'; key: string } | null>(null)
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: 'purchase' | 'switch') => {
    if (pending) return
    const current = intent?.action === action ? intent : { action, key: crypto.randomUUID() }
    setIntent(current); setPending(action); setError(null)
    try { await (action === 'purchase' ? onPurchase(current.key) : onSwitch(current.key)); setIntent(null); setConfirmSwitch(false) }
    catch (reason) { if (!isAmbiguousMutationError(reason)) setIntent(null); setError(dailyChallengeErrorMessage(reason, action)) }
    finally { setPending(null) }
  }
  if (!value.assigned || !value.challenge) return <section className="panel daily-challenge-card available" data-challenge-state="available">
    <header className="daily-challenge-header"><div><span className="eyebrow">Défi du jour</span><small>{value.businessDate}</small></div><strong>Disponible</strong></header>
    <div className="daily-challenge-content"><h2>Un objectif pour aujourd’hui</h2><p>Obtenez un objectif aléatoire à accomplir avant le reset journalier. Il sera révélé après l’achat.</p><dl><div><dt>Prix</dt><dd>{formatResourceAmount(value.purchaseCost)} Moras</dd></div><div><dt>Récompense</dt><dd>800 Primogemmes</dd></div></dl></div>
    <div className="daily-challenge-progress-zone available"><span>Objectif révélé après attribution.</span><p className={`daily-challenge-feedback${error ? ' error' : ''}`} role={error ? 'alert' : undefined}>{error ?? ''}</p></div>
    <div className="daily-challenge-actions"><button type="button" className="small-primary-button" disabled={Boolean(pending)} onClick={() => void run('purchase')}>{pending === 'purchase' ? 'Attribution…' : 'Acheter le Défi'}</button></div>
  </section>
  const challenge = value.challenge
  const progressPercent = Number(BigInt(challenge.progress) * 100n / BigInt(challenge.target))
  const requestSwitch = () => BigInt(challenge.progress) > 0n ? setConfirmSwitch(true) : void run('switch')
  const completed = value.status === 'COMPLETED'
  const primaryAction = challenge.type === 'conversion'
    ? { label: 'Convertir', run: onOpenParticleConversion }
    : challenge.type === 'pulls'
      ? { label: 'Aller à l’Invocation', run: () => onNavigate('invocation') }
      : null
  return <section className={`panel daily-challenge-card ${value.status.toLowerCase()}`} data-challenge-state={value.status.toLowerCase()}>
    <header className="daily-challenge-header"><div><span className="eyebrow">Défi du jour</span><small>{value.businessDate}</small></div><strong className={completed ? 'complete' : undefined}>{completed ? '✅ Terminé' : 'Actif'}</strong></header>
    <div className="daily-challenge-content"><h2>{challenge.displayName}</h2><p>{challenge.description}</p><span className="daily-challenge-reward">{completed ? '+' : ''}{challenge.rewardPrimogems} Primogemmes</span></div>
    <div className="daily-challenge-progress-zone"><div className="daily-challenge-progress" aria-label={`${challenge.progress} sur ${challenge.target}`}><span style={{ width: `${progressPercent}%` }} /></div><p>{dailyChallengeProgressSentence(challenge)}</p><p className={`daily-challenge-feedback${error ? ' error' : ''}`} role={error ? 'alert' : undefined}>{error ?? ''}</p></div>
    <div className={`daily-challenge-actions${confirmSwitch ? ' confirming' : ''}`}>{completed
      ? <span className="daily-challenge-received">Récompense reçue</span>
      : confirmSwitch
        ? <div className="daily-challenge-confirm" role="dialog" aria-label="Confirmer le remplacement"><p>Votre progression sera perdue.</p><div><button type="button" className="daily-challenge-cancel" onClick={() => setConfirmSwitch(false)}>Annuler</button><button type="button" className="small-primary-button" disabled={Boolean(pending)} onClick={() => void run('switch')}>{pending === 'switch' ? 'Changement…' : `Confirmer · ${formatResourceAmount(value.nextSwitchCost ?? '0')} Moras`}</button></div></div>
        : <>{primaryAction && <button type="button" className="small-primary-button daily-challenge-context-action" onClick={primaryAction.run}>{primaryAction.label}</button>}<button type="button" className="daily-challenge-switch-button" disabled={!value.canSwitch || Boolean(pending)} onClick={requestSwitch}>{pending === 'switch' ? 'Changement…' : `Changer de Défi · ${formatResourceAmount(value.nextSwitchCost ?? '0')} Moras`}</button></>}
    </div>
  </section>
}
export default ActivitiesScreen
