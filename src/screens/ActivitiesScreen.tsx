import { useState, type ReactNode } from 'react'
import type { ContestDto, ContestHistoryDto, ContestSnapshotDto, DailyChallengeDto, DailyChallengeMutationDto, DailyCombatDto, DailyCombatFightDto, DailyRewardClaimDto, DailyRewardTodayDto, ElementKey, EventDto, EventGameAAttemptDto, EventJoinDto, ExpeditionDto, MonthlyBossAttackDto, MonthlyBossDto, MonthlyBossHistoryDto, WheelSpinDto, WheelTodayDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { formatResourceAmount, formatWheelOverviewResult } from '../utils/formatters'
import WheelCard from '../components/WheelCard'
import DailyRewardCard from '../components/DailyRewardCard'
import ExpeditionCountdown from '../components/ExpeditionCountdown'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import type { ScreenId } from '../types'
import { dailyChallengeErrorMessage, dailyChallengeProgressSentence } from '../daily-challenge/presentation'
import DailyCombatScreen, { type DailyCombatBoxBindings } from './DailyCombatScreen'
import { unavailableMonthlyBoss } from '../combat/monthly-boss-unavailable'
import { expeditionOverview } from '../expedition/expedition-presentation'
import { createExpeditionClientSnapshot, type ExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'
import { eventDailyDetail, eventHasActionableContentToday } from '../event/event-presentation'
import ContestScreen from './ContestScreen'
import EventScreen from './EventScreen'

type ActivitiesScreenProps = {
  screen: ScreenId
  wheelToday: WheelTodayDto
  onSpinWheel: () => Promise<WheelSpinDto>
  dailyRewardToday: DailyRewardTodayDto
  elementKey: ElementKey
  onClaimDailyReward: () => Promise<DailyRewardClaimDto>
  dailyChallenge: DailyChallengeDto
  dailyCombat?: DailyCombatDto
  monthlyBoss?: MonthlyBossDto
  contest?: ContestDto
  event?: EventDto
  onLoadEvent?: () => Promise<EventDto>
  onJoinEvent?: (key: string) => Promise<EventJoinDto>
  onAttemptEventGameA?: (key: string) => Promise<EventGameAAttemptDto>
  bossRequestToken?: number
  expedition?: ExpeditionClientSnapshot
  expeditionMonotonicNow?: number
  dailyCombatBox?: DailyCombatBoxBindings
  dailiesOverviewRequestToken?: number
  onPurchaseDailyChallenge: (idempotencyKey: string) => Promise<DailyChallengeMutationDto>
  onSwitchDailyChallenge: (idempotencyKey: string) => Promise<DailyChallengeMutationDto>
  onSetDailyCombatSlot?: (position: number, characterId: string) => Promise<DailyCombatDto>
  onRemoveDailyCombatSlot?: (position: number) => Promise<DailyCombatDto>
  onCopyActiveTeamToDailyCombat?: () => Promise<DailyCombatDto>
  onAutoSelectDailyCombat?: () => Promise<DailyCombatDto>
  onClearDailyCombatLoadout?: () => Promise<DailyCombatDto>
  onFightDailyCombat?: (idempotencyKey: string) => Promise<DailyCombatFightDto>
  onSetMonthlyBossSlot?: (position: number, characterId: string) => Promise<MonthlyBossDto>
  onRemoveMonthlyBossSlot?: (position: number) => Promise<MonthlyBossDto>
  onCopyActiveTeamToMonthlyBoss?: () => Promise<MonthlyBossDto>
  onClearMonthlyBossLoadout?: () => Promise<MonthlyBossDto>
  onAttackMonthlyBoss?: (bossId: string, idempotencyKey: string) => Promise<MonthlyBossAttackDto>
  onLoadMonthlyBossHistory?: (page: number) => Promise<MonthlyBossHistoryDto>
  onRefreshContest?: () => Promise<ContestDto>
  onLoadContestHistory?: (page: number) => Promise<ContestHistoryDto>
  onLoadContestHistoryDetail?: (contestId: string) => Promise<ContestSnapshotDto>
  onOpenContest?: (characterId: string, key: string) => Promise<ContestDto>
  onJoinContest?: (characterId: string, key: string) => Promise<ContestDto>
  onSelectContestLegend?: (characterId: string, key: string) => Promise<ContestDto>
  onSetContestReady?: (ready: boolean, key: string) => Promise<ContestDto>
  onStartContest?: (key: string) => Promise<ContestDto>
  onSpectateContest?: (key: string) => Promise<ContestDto>
  onLeaveContest?: (key: string) => Promise<ContestDto>
  onCancelContest?: (key: string) => Promise<ContestDto>
  onPlayContest?: (action: 'BASIC' | 'RISK', key: string) => Promise<ContestDto>
  onSupportContest?: (slot: number, key: string) => Promise<ContestDto>
  onRemoveContestParticipant?: (playerId: string, key: string) => Promise<ContestDto>
  onRemoveContestSpectator?: (playerId: string, key: string) => Promise<ContestDto>
  onOpenParticleConversion: () => void
  onOpenExpedition?: () => void
  onOpenBoss?: () => void
  onNavigate: (screen: ScreenId) => void
}

function ActivitiesScreen(props: ActivitiesScreenProps) {
  const { screen, dailyCombat = unavailableDailyCombat, monthlyBoss = unavailableMonthlyBoss, contest = unavailableContest, bossRequestToken = 0, expedition, dailyCombatBox, onSetDailyCombatSlot = async () => unavailableDailyCombat, onRemoveDailyCombatSlot = async () => unavailableDailyCombat, onCopyActiveTeamToDailyCombat = async () => unavailableDailyCombat, onAutoSelectDailyCombat = async () => unavailableDailyCombat, onClearDailyCombatLoadout = async () => unavailableDailyCombat, onFightDailyCombat = async () => { throw new Error('Combat indisponible.') }, onSetMonthlyBossSlot = async () => unavailableMonthlyBoss, onRemoveMonthlyBossSlot = async () => unavailableMonthlyBoss, onCopyActiveTeamToMonthlyBoss = async () => unavailableMonthlyBoss, onClearMonthlyBossLoadout = async () => unavailableMonthlyBoss, onAttackMonthlyBoss = async () => { throw new Error('Boss indisponible.') }, onLoadMonthlyBossHistory = async () => ({ page: 1, pageSize: 10, total: 0, totalPages: 1, bosses: [] }), onOpenBoss } = props
  if (screen === 'activities-dailies') return <DailiesScreen {...props} dailyCombat={dailyCombat} monthlyBoss={monthlyBoss} expedition={expedition} onOpenBoss={onOpenBoss} />
  if (screen === 'activities-combat') return <DailyCombatScreen value={dailyCombat} box={dailyCombatBox} onSetSlot={onSetDailyCombatSlot} onRemoveSlot={onRemoveDailyCombatSlot} onCopyActive={onCopyActiveTeamToDailyCombat} onAuto={onAutoSelectDailyCombat} onClear={onClearDailyCombatLoadout} onFight={onFightDailyCombat} monthlyBoss={monthlyBoss} bossRequestToken={bossRequestToken} onSetBossSlot={onSetMonthlyBossSlot} onRemoveBossSlot={onRemoveMonthlyBossSlot} onCopyActiveToBoss={onCopyActiveTeamToMonthlyBoss} onClearBoss={onClearMonthlyBossLoadout} onAttackBoss={onAttackMonthlyBoss} onLoadBossHistory={onLoadMonthlyBossHistory} />
  if (screen === 'activities-contest') {
    const unchanged = async () => contest
    const emptyHistory = async () => ({ page: 1, pageSize: 10, total: 0, pageCount: 1, contests: [] as const })
    const emptyDetail = async () => { throw new Error('Détail indisponible.') }
    return <ContestScreen value={contest} onRefresh={props.onRefreshContest ?? unchanged} onLoadHistory={props.onLoadContestHistory ?? emptyHistory} onLoadHistoryDetail={props.onLoadContestHistoryDetail ?? emptyDetail} onOpen={props.onOpenContest ?? unchanged} onJoin={props.onJoinContest ?? unchanged} onSelectLegend={props.onSelectContestLegend ?? unchanged} onReady={props.onSetContestReady ?? unchanged} onStart={props.onStartContest ?? unchanged} onSpectate={props.onSpectateContest ?? unchanged} onLeave={props.onLeaveContest ?? unchanged} onCancel={props.onCancelContest ?? unchanged} onPlay={props.onPlayContest ?? unchanged} onSupport={props.onSupportContest ?? unchanged} onRemoveParticipant={props.onRemoveContestParticipant ?? unchanged} onRemoveSpectator={props.onRemoveContestSpectator ?? unchanged} />
  }
  if (screen === 'activities-event' && props.event && props.onLoadEvent && props.onJoinEvent && props.onAttemptEventGameA) return <EventScreen value={props.event} onLoad={props.onLoadEvent} onJoin={props.onJoinEvent} onAttempt={props.onAttemptEventGameA} />
  const content = screen === 'activities-missions' ? { title: 'Missions', description: 'Les missions permanentes seront disponibles ici.', tabs: ['B', 'A', 'S', 'Z'] } : screen === 'activities-event' ? { title: 'Événement', description: 'Chargement du Festival mensuel indisponible.', tabs: ['Jeux', 'Shop', 'Classement'] } : { title: 'Concours', description: 'Le Concours C6 sera accessible ici lorsqu’il sera implémenté.', tabs: [] }
  return <div className="screen-content activity-shell"><ScreenHeader eyebrow="Activités" title={content.title} description={content.description} /><nav className="activity-inner-tabs" aria-label={`Sections ${content.title}`}>{content.tabs.map((tab) => <button type="button" disabled key={tab}>{tab}</button>)}</nav><section className="panel unavailable-shell"><strong>{screen === 'activities-event' ? 'Festival indisponible' : 'Bientôt disponible'}</strong><p>Aucune progression fictive n’est affichée.</p></section></div>
}

const unavailableDailyCombat: DailyCombatDto = {
  businessDate: '', status: 'BLOCKED', encounter: { id: '', enemies: [] },
  loadout: { nextAttemptMode: 'MANUAL', slots: [1, 2, 3, 4].map((position) => ({ position: position as 1 | 2 | 3 | 4, character: null, ko: false })) },
  availableCharacters: [], koCharacterIds: [], availableCharacterCount: 0, preview: null, canFight: false,
  reward: { primogems: '800', moras: '20000' }, lastAttempt: null,
  playerStats: { totalFights: '0', totalWins: '0', totalLosses: '0', totalManualWins: '0' },
}
const unavailableContest: ContestDto = {
  businessDate: '', theme: { key: 'STRENGTH', label: 'Force', title: 'Titan', statKey: 'strength' }, dailyUsed: false,
  permissions: { canOpen: false, canJoin: false, canSpectate: false, canLeave: false, canReady: false, canStart: false, canCancel: false, canPlay: false, canSupport: false },
  active: null, lastResult: null, legends: [],
}
const unavailableExpedition: ExpeditionDto = { businessDate: '', operationalStatus: 'IDLE', departureUsedToday: false, canStartToday: false, activeCharacter: null, departedAt: null, readyAt: null, remainingSeconds: 0, startedOnCurrentBusinessDate: false, totalCompleted: '0' }

type DailyOverviewCardProps = {
  title: string
  status: string
  completed?: boolean
  detail?: ReactNode
  obtained?: string
  onAccess?: () => void
  accessLabel?: string
  showAccessWhenCompleted?: boolean
  hideAction?: boolean
  actionText?: string
}

function DailyOverviewCard({ title, status, completed = false, detail, obtained, onAccess, accessLabel, showAccessWhenCompleted = false, hideAction = false, actionText = 'Accéder' }: DailyOverviewCardProps) {
  return (
    <section className="panel daily-overview-card" data-daily-activity={title}>
      <div>
        <h2>{title}</h2>
        <p className={completed ? 'daily-overview-complete' : undefined}>{status}</p>
        {detail && <p className="daily-overview-detail">{detail}</p>}
        {obtained && <p className="daily-overview-obtained">Obtenu : {obtained}</p>}
      </div>
      {!hideAction && (!completed || showAccessWhenCompleted) && <div className="daily-overview-action-slot"><button type="button" className="small-primary-button" onClick={onAccess} disabled={!onAccess} aria-label={accessLabel ?? `${actionText} ${title}`}>{actionText}</button></div>}
    </section>
  )
}

function DailiesScreen({ wheelToday, onSpinWheel, dailyRewardToday, dailyChallenge, dailyCombat = unavailableDailyCombat, monthlyBoss = unavailableMonthlyBoss, event, expedition, expeditionMonotonicNow = 0, dailiesOverviewRequestToken = 0, elementKey, onClaimDailyReward, onPurchaseDailyChallenge, onSwitchDailyChallenge, onOpenParticleConversion, onOpenExpedition, onOpenBoss, onNavigate }: Omit<ActivitiesScreenProps, 'screen'>) {
  const [selection, setSelection] = useState<{ tab: 'overview' | 'wheel' | 'challenge'; requestToken: number }>({ tab: 'overview', requestToken: dailiesOverviewRequestToken })
  const tab = selection.requestToken === dailiesOverviewRequestToken ? selection.tab : 'overview'
  const selectTab = (next: typeof tab) => setSelection({ tab: next, requestToken: dailiesOverviewRequestToken })
  const tabs = <nav className="activity-inner-tabs" aria-label="Sections Quotidiennes"><button className={tab === 'overview' ? 'active' : ''} onClick={() => selectTab('overview')}>Aperçu</button><button className={tab === 'wheel' ? 'active' : ''} onClick={() => selectTab('wheel')}>Roue</button><button className={tab === 'challenge' ? 'active' : ''} onClick={() => selectTab('challenge')}>Défi</button></nav>
  const challengeCompleted = dailyChallenge.status === 'COMPLETED' && Boolean(dailyChallenge.challenge)
  const challengeStatus = challengeCompleted ? '✅ Terminé' : dailyChallenge.assigned && dailyChallenge.challenge ? `${dailyChallenge.challenge.displayName} · ${dailyChallenge.challenge.progress} / ${dailyChallenge.challenge.target}` : `Disponible — ${formatResourceAmount(dailyChallenge.purchaseCost)} Moras`
  const combatOverview = dailyCombatOverview(dailyCombat)
  const bossCompleted = monthlyBoss.attackState !== 'AVAILABLE'
  const bossDetail = monthlyBoss.attackState === 'DEFEATED' ? 'Boss vaincu ce mois-ci.' : monthlyBoss.attackState === 'USED' ? 'Attaque effectuée.' : 'Une attaque disponible.'
  return <div className="screen-content activity-shell dailies-shell long-screen-layout"><ScreenHeader eyebrow="Activités" title="Quotidiennes" description="Retrouvez les activités du jour et leur disponibilité réelle." /><ScrollableScreenPanel className="dailies-frame" fixed={tabs}>{tab === 'overview' && <div className="dailies-overview">
    <div className="daily-overview-item" data-daily-activity="Récompense quotidienne"><DailyRewardCard variant="overview" today={dailyRewardToday} elementKey={elementKey} onClaim={onClaimDailyReward} /></div>
    <DailyOverviewCard title="Roue" status={wheelToday.spun ? '✅ Terminé' : 'Une tentative disponible.'} completed={wheelToday.spun} detail={wheelToday.spun ? 'Roue utilisée.' : undefined} obtained={wheelToday.spun && wheelToday.result ? formatWheelOverviewResult(wheelToday.result) : undefined} onAccess={() => selectTab('wheel')} />
    <DailyOverviewCard title="Défi" status={challengeStatus} completed={challengeCompleted} detail={challengeCompleted ? dailyChallengeProgressSentence(dailyChallenge.challenge!) : undefined} obtained={challengeCompleted ? `+${formatResourceAmount(dailyChallenge.challenge!.rewardPrimogems)} Primogemmes` : undefined} onAccess={() => selectTab('challenge')} />
    <DailyOverviewCard title="Combat" status={combatOverview.status} completed={dailyCombat.status === 'COMPLETED'} detail={combatOverview.detail} obtained={dailyCombat.status === 'COMPLETED' ? `+${formatResourceAmount(dailyCombat.reward.primogems)} Primogemmes · +${formatResourceAmount(dailyCombat.reward.moras)} Moras` : undefined} onAccess={() => onNavigate('activities-combat')} />
    <DailyOverviewCard title="Boss" status={bossCompleted ? '✅ Terminé' : 'À faire'} completed={bossCompleted} detail={bossDetail} onAccess={onOpenBoss} />
    <ExpeditionOverviewCard snapshot={expedition} monotonicNow={expeditionMonotonicNow} onAccess={onOpenExpedition ?? (() => onNavigate('characters-box'))} />
    <DailyOverviewCard title="Amitié" status="Bientôt disponible. Social et Amis ne sont pas encore implémentés." accessLabel="Accéder à Amitié — Social et Amis bientôt disponibles" />
    <DailyOverviewCard title="Événement" status={event ? `${event.festival.emoji} ${event.festival.title}` : 'Synchronisation du Festival…'} detail={event ? `${eventDailyDetail(event)} · ${formatResourceAmount(event.currency.amount)} ${event.festival.currency.label}` : undefined} hideAction={event ? !eventHasActionableContentToday(event) : false} onAccess={() => onNavigate('activities-event')} />
  </div>}{tab === 'wheel' && <WheelCard today={wheelToday} onSpin={onSpinWheel} />}{tab === 'challenge' && <DailyChallengeCard value={dailyChallenge} onPurchase={onPurchaseDailyChallenge} onSwitch={onSwitchDailyChallenge} onOpenParticleConversion={onOpenParticleConversion} onNavigate={onNavigate} />}</ScrollableScreenPanel></div>
}

function ExpeditionOverviewCard({ snapshot = unavailableExpeditionSnapshot, monotonicNow, onAccess }: { snapshot?: ExpeditionClientSnapshot; monotonicNow: number; onAccess: () => void }) {
  const value = snapshot.value
  const presentation = expeditionOverview(value, 0)
  const detail = value.operationalStatus === 'RUNNING'
    ? <>{value.activeCharacter?.name ?? 'Personnage'} · <ExpeditionCountdown snapshot={snapshot} monotonicNow={monotonicNow} /></>
    : presentation.detail
  const ready = value.operationalStatus === 'READY'
  return <DailyOverviewCard title="Expédition" {...presentation} detail={detail} onAccess={value.operationalStatus === 'RUNNING' || value.operationalStatus === 'IDLE' && value.departureUsedToday ? undefined : onAccess} showAccessWhenCompleted={ready} actionText={ready ? 'Récupérer' : 'Accéder'} />
}

const unavailableExpeditionSnapshot = createExpeditionClientSnapshot(unavailableExpedition, 0)

function dailyCombatOverview(value: DailyCombatDto) {
  if (value.status === 'COMPLETED') return { status: '✅ Terminé', detail: 'Victoire obtenue.' }
  if (value.status === 'BLOCKED') return { status: 'Bloqué', detail: 'Moins de 4 personnages disponibles.' }
  if (value.status === 'IN_PROGRESS') return { status: 'En cours', detail: `${value.koCharacterIds.length} personnages KO.` }
  return { status: 'Prêt à combattre' }
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
    <div className="daily-challenge-content"><h2>Un objectif à révéler</h2><p>Obtenez un objectif aléatoire à accomplir avant le reset journalier. Il sera révélé après l’achat.</p><dl><div><dt>Prix</dt><dd>{formatResourceAmount(value.purchaseCost)} Moras</dd></div><div><dt>Récompense</dt><dd>800 Primogemmes</dd></div></dl></div>
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
