import { useTutorialView } from '../tutorial/tutorial-presentation'
import type { FavorDto } from '../api/types'
import { projectDailies, type DailyItem } from '../dailies/daily-summary'
import type { DailyClaimController } from '../dailies/use-daily-claim'
import { useState, type ReactNode } from 'react'
import type { ContestDto, ContestHistoryDto, ContestSnapshotDto, DailyChallengeDto, DailyChallengeMutationDto, DailyCombatDto, DailyCombatFightDto, DailyRewardClaimDto, DailyRewardTodayDto, ElementKey, EventDto, EventRankingDto, EventGameAAttemptDto, EventJoinDto, MonthlyBossAttackDto, MonthlyBossDto, MonthlyBossHistoryDto, PlayerMissionsDto, WheelSpinDto, WheelTodayDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { formatResourceAmount } from '../utils/formatters'
import WheelCard from '../components/WheelCard'
import DailyRewardCard from '../components/DailyRewardCard'
import ExpeditionCountdown from '../components/ExpeditionCountdown'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import type { ScreenId } from '../types'
import { dailyChallengeErrorMessage, dailyChallengeProgressSentence } from '../daily-challenge/presentation'
import DailyCombatScreen, { type DailyCombatBoxBindings } from './DailyCombatScreen'
import { unavailableMonthlyBoss } from '../combat/monthly-boss-unavailable'
import type { ExpeditionClientSnapshot } from '../expedition/expedition-client-snapshot'
import type { EventDailyDestination, EventDailyOpenIntent } from '../event/event-presentation'
import ContestScreen from './ContestScreen'
import ContestUnavailable from '../contest/ContestUnavailable'
import type { ContestAvailability } from '../contest/contest-request-coordinator'
import EventScreen from './EventScreen'
import ArcadeScreen, { type ArcadeScreenProps } from './ArcadeScreen'
import MissionsScreen from './MissionsScreen'
import type { EventDailyBonusClaimDto, EventCalendarClaimDto, EventGameBAttemptDto, EventGameCRecipientQuery, EventGameCRecipientsDto, EventGameCSendDto } from '../api/types'

type ActivitiesScreenProps = {
  dailyItems?: readonly DailyItem[]
  dailyClaim?: DailyClaimController
  dailiesRequestedTab?: 'overview' | 'wheel' | 'challenge'
  friendshipDate?: string
  onArcadeMutation?: ArcadeScreenProps['onMutation']
  arcadeFeedbackPending?: boolean
  favor?: FavorDto | null
  favorError?: boolean
  friendship?: { earnedPrimogemsToday?: string; activeFriends: number; available: number; alreadySent: number }
  friendshipError?: string
  onOpenFriends?: () => void
  sessionUserId: string
  screen: ScreenId
  onLoadMissions?: () => Promise<PlayerMissionsDto>
  wheelToday: WheelTodayDto
  onSpinWheel: () => Promise<WheelSpinDto>
  dailyRewardToday: DailyRewardTodayDto
  elementKey: ElementKey
  onClaimDailyReward: () => Promise<DailyRewardClaimDto>
  dailyChallenge: DailyChallengeDto
  dailyCombat?: DailyCombatDto
  monthlyBoss?: MonthlyBossDto
  contest?: ContestDto | null
  contestAvailability?: ContestAvailability
  event?: EventDto
  onLoadEvent?: () => Promise<EventDto>
  onJoinEvent?: (key: string) => Promise<EventJoinDto>
  onClaimEventCalendar?: (key: string) => Promise<EventCalendarClaimDto>
  onClaimEventDailyBonus?: (key: string) => Promise<EventDailyBonusClaimDto>
  onLoadEventRanking?: () => Promise<EventRankingDto>
  onConvertEventShop?: (target: 'PRIMOGEMS' | 'MORAS', quantity: number, key: string) => Promise<EventDto>
  onPurchaseEventCollection?: (key: string) => Promise<EventDto>
  onAttemptEventGameA?: (key: string) => Promise<EventGameAAttemptDto>
  onAttemptEventGameB?: (code: string, key: string) => Promise<EventGameBAttemptDto>
  onSearchEventGameCRecipients?: (query: EventGameCRecipientQuery) => Promise<EventGameCRecipientsDto>
  onSendEventGameC?: (recipientPlayerId: string, message: string, key: string) => Promise<EventGameCSendDto>
  onConsultEventGameCMessages?: () => Promise<EventDto>
  eventDailyIntent?: EventDailyOpenIntent | null
  onEventDailyIntentConsumed?: (token: string) => void
  onOpenDailyEvent?: (destination: EventDailyDestination) => void
  eventMessagesRequestToken?: number
  eventShopRequestToken?: number
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
  onOpenEventHistory?: () => void
}

function ActivitiesScreen(props: ActivitiesScreenProps) {
  const { screen, dailyCombat = unavailableDailyCombat, monthlyBoss = unavailableMonthlyBoss, contest, bossRequestToken = 0, expedition, dailyCombatBox, onSetDailyCombatSlot = async () => unavailableDailyCombat, onRemoveDailyCombatSlot = async () => unavailableDailyCombat, onCopyActiveTeamToDailyCombat = async () => unavailableDailyCombat, onAutoSelectDailyCombat = async () => unavailableDailyCombat, onClearDailyCombatLoadout = async () => unavailableDailyCombat, onFightDailyCombat = async () => { throw new Error('Combat indisponible.') }, onSetMonthlyBossSlot = async () => unavailableMonthlyBoss, onRemoveMonthlyBossSlot = async () => unavailableMonthlyBoss, onCopyActiveTeamToMonthlyBoss = async () => unavailableMonthlyBoss, onClearMonthlyBossLoadout = async () => unavailableMonthlyBoss, onAttackMonthlyBoss = async () => { throw new Error('Boss indisponible.') }, onLoadMonthlyBossHistory = async () => ({ page: 1, pageSize: 10, total: 0, totalPages: 1, bosses: [] }), onOpenBoss } = props
  if (screen === 'activities-dailies') return <DailiesScreen {...props} dailyCombat={dailyCombat} monthlyBoss={monthlyBoss} expedition={expedition} onOpenBoss={onOpenBoss} />
  if (screen === 'activities-missions' && props.onLoadMissions) return <MissionsScreen onLoad={props.onLoadMissions} />
  if (screen === 'activities-combat') return <DailyCombatScreen value={dailyCombat} box={dailyCombatBox} onSetSlot={onSetDailyCombatSlot} onRemoveSlot={onRemoveDailyCombatSlot} onCopyActive={onCopyActiveTeamToDailyCombat} onAuto={onAutoSelectDailyCombat} onClear={onClearDailyCombatLoadout} onFight={onFightDailyCombat} monthlyBoss={monthlyBoss} bossRequestToken={bossRequestToken} onSetBossSlot={onSetMonthlyBossSlot} onRemoveBossSlot={onRemoveMonthlyBossSlot} onCopyActiveToBoss={onCopyActiveTeamToMonthlyBoss} onClearBoss={onClearMonthlyBossLoadout} onAttackBoss={onAttackMonthlyBoss} onLoadBossHistory={onLoadMonthlyBossHistory} />
  if (screen === 'activities-arcade') return <ArcadeScreen key={props.sessionUserId} playerId={props.sessionUserId} onMutation={props.onArcadeMutation} feedbackPending={props.arcadeFeedbackPending} />
  if (screen === 'activities-contest') {
    if (!contest) return <ContestUnavailable availability={props.contestAvailability ?? { phase: 'unavailable', pending: false }} onRetry={props.onRefreshContest} />
    const unchanged = async () => contest
    const emptyHistory = async () => ({ page: 1, pageSize: 10, total: 0, pageCount: 1, contests: [] as const })
    const emptyDetail = async () => { throw new Error('Détail indisponible.') }
    return <ContestScreen value={contest} onRefresh={props.onRefreshContest ?? unchanged} onLoadHistory={props.onLoadContestHistory ?? emptyHistory} onLoadHistoryDetail={props.onLoadContestHistoryDetail ?? emptyDetail} onOpen={props.onOpenContest ?? unchanged} onJoin={props.onJoinContest ?? unchanged} onSelectLegend={props.onSelectContestLegend ?? unchanged} onReady={props.onSetContestReady ?? unchanged} onStart={props.onStartContest ?? unchanged} onSpectate={props.onSpectateContest ?? unchanged} onLeave={props.onLeaveContest ?? unchanged} onCancel={props.onCancelContest ?? unchanged} onPlay={props.onPlayContest ?? unchanged} onSupport={props.onSupportContest ?? unchanged} onRemoveParticipant={props.onRemoveContestParticipant ?? unchanged} onRemoveSpectator={props.onRemoveContestSpectator ?? unchanged} />
  }
if (screen === 'activities-event' && props.event && props.onLoadEvent && props.onJoinEvent && props.onAttemptEventGameA) return <EventScreen key={`${props.sessionUserId}:${props.event.edition.id}`} sessionUserId={props.sessionUserId} value={props.event} onLoad={props.onLoadEvent} onLoadRanking={props.onLoadEventRanking} onJoin={props.onJoinEvent} onClaimCalendar={props.onClaimEventCalendar} onClaimDailyBonus={props.onClaimEventDailyBonus} onConvertShop={props.onConvertEventShop} onPurchaseCollection={props.onPurchaseEventCollection} onAttempt={props.onAttemptEventGameA} onAttemptB={props.onAttemptEventGameB ?? (async () => { throw new Error('Jeu B indisponible.') })} onSearchRecipients={props.onSearchEventGameCRecipients} onSendGameC={props.onSendEventGameC} onConsultMessages={props.onConsultEventGameCMessages} dailyIntent={props.eventDailyIntent} onDailyIntentConsumed={props.onEventDailyIntentConsumed} openMessagesToken={props.eventMessagesRequestToken} openShopToken={props.eventShopRequestToken} onOpenCodes={() => props.onNavigate?.("codes")} onOpenHistory={props.onOpenEventHistory} />
  const content = screen === 'activities-missions' ? { title: 'Missions', description: 'Chargement des missions permanentes indisponible.', tabs: ['B', 'A', 'S', 'Z'] } : screen === 'activities-event' ? { title: 'Événement', description: 'Chargement du Festival mensuel indisponible.', tabs: ['Général', 'Jeux', 'Shop', 'Classement'] } : { title: 'Concours', description: 'Le Concours C6 sera accessible ici lorsqu’il sera implémenté.', tabs: [] }
  return <div className="screen-content activity-shell"><ScreenHeader eyebrow="Activités" title={content.title} description={content.description} /><nav className="activity-inner-tabs" aria-label={`Sections ${content.title}`}>{content.tabs.map((tab) => <button type="button" disabled key={tab}>{tab}</button>)}</nav><section className="panel unavailable-shell"><strong>{screen === 'activities-event' ? 'Festival indisponible' : screen === 'activities-missions' ? 'Missions indisponibles' : 'Bientôt disponible'}</strong><p>Aucune progression fictive n’est affichée.</p></section></div>
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
  detail?: ReactNode
  obtained?: string
  damage?: string
  onAccess?: () => void
  accessLabel?: string
  showAccessWhenCompleted?: boolean
  hideAction?: boolean
  actionText?: string
}

function DailyOverviewCard({ title, status, completed = false, detail, obtained, damage, onAccess, accessLabel, showAccessWhenCompleted = false, hideAction = false, actionText = 'Accéder' }: DailyOverviewCardProps) {
  return (
    <section className="panel daily-overview-card" data-daily-activity={title}>
      <div>
        <h2>{title}</h2>
        <p className={completed ? 'daily-overview-complete' : undefined}>{status}</p>
        {detail && <p className="daily-overview-detail">{detail}</p>}
        {obtained && <p className="daily-overview-obtained">Obtenu : {obtained}</p>}
        {damage && <p className="daily-overview-obtained">Dégâts : {damage} PV retirés</p>}
      </div>
      {!hideAction && (!completed || showAccessWhenCompleted) && <div className="daily-overview-action-slot"><button type="button" className="small-primary-button" onClick={onAccess} disabled={!onAccess} aria-label={accessLabel ?? `${actionText} ${title}`}>{actionText}</button></div>}
    </section>
  )
}

function DailiesScreen(props: Omit<ActivitiesScreenProps, 'screen'>) {
  const { wheelToday, onSpinWheel, dailyRewardToday, dailyChallenge, elementKey, onClaimDailyReward, onPurchaseDailyChallenge, onSwitchDailyChallenge, onOpenParticleConversion, onOpenExpedition, onOpenBoss, onNavigate, onOpenDailyEvent, onOpenFriends, dailyClaim, dailiesOverviewRequestToken = 0, dailiesRequestedTab = 'overview' } = props
  const [selection, setSelection] = useState<{ tab: 'overview' | 'wheel' | 'challenge'; requestToken: number }>({ tab: dailiesRequestedTab, requestToken: dailiesOverviewRequestToken })
  const normalTab = selection.requestToken === dailiesOverviewRequestToken ? selection.tab : dailiesRequestedTab
  const selectTab = (next: typeof tab) => setSelection({ tab: next, requestToken: dailiesOverviewRequestToken })
  const tab = useTutorialView('activities-dailies', normalTab, ['overview', 'wheel', 'challenge'])
  const tabs = <nav className="activity-inner-tabs" aria-label="Sections Quotidiennes"><button className={tab === 'overview' ? 'active' : ''} onClick={() => selectTab('overview')}>Aperçu</button><button className={tab === 'wheel' ? 'active' : ''} onClick={() => selectTab('wheel')}>Roue</button><button className={tab === 'challenge' ? 'active' : ''} onClick={() => selectTab('challenge')}>Défi</button></nav>
  const items = props.dailyItems ?? projectDailies({ elementKey, favor: props.favor, reward: dailyRewardToday, wheel: wheelToday, challenge: dailyChallenge, combat: props.dailyCombat, boss: props.monthlyBoss, expedition: props.expedition, monotonicNow: props.expeditionMonotonicNow, event: props.event, friendship: props.friendship, friendshipDate: props.friendshipDate ?? dailyRewardToday.businessDate, errors: { favor: props.favorError, friendship: Boolean(props.friendshipError) } })
  const access = (item: DailyItem) => {
    switch (item.destination?.kind) {
      case 'wheel': selectTab('wheel'); break
      case 'challenge': selectTab('challenge'); break
      case 'combat': onNavigate('activities-combat'); break
      case 'boss': onOpenBoss?.(); break
      case 'expedition': if (onOpenExpedition) onOpenExpedition(); else onNavigate('characters-box'); break
      case 'friends': onOpenFriends?.(); break
      case 'event': if (onOpenDailyEvent) onOpenDailyEvent(item.destination.destination); else onNavigate('activities-event'); break
    }
  }
  return <div className="screen-content activity-shell dailies-shell long-screen-layout"><ScreenHeader eyebrow="Activités" title="Quotidiennes" description="Retrouvez les activités du jour et leur disponibilité réelle." /><ScrollableScreenPanel className="dailies-frame" fixed={tabs}>{tab === 'overview' && <div data-tutorial-anchor="dailies-overview" className="dailies-overview">
    {items.map(item => item.id === 'reward' ? <div key={item.id} className="daily-overview-item" data-daily-activity={item.title}><DailyRewardCard variant="overview" today={dailyRewardToday} elementKey={elementKey} onClaim={onClaimDailyReward} controller={dailyClaim} summary={item} /></div> : <DailyOverviewCard key={item.id} title={item.title} status={item.status} completed={item.state === 'completed'} detail={item.id === 'expedition' && item.state === 'in_progress' && props.expedition ? <>{props.expedition.value.activeCharacter?.name ?? 'Personnage'} · <ExpeditionCountdown snapshot={props.expedition} monotonicNow={props.expeditionMonotonicNow ?? 0} /></> : item.detail} obtained={item.obtained} damage={item.damage} hideAction={item.id === 'favor' || item.id === 'expedition' && item.state === 'in_progress' || item.state === 'completed' || item.id === 'friendship' && !item.actionable || item.id === 'event' && !item.destination} onAccess={item.destination && !(item.id === 'expedition' && item.state === 'in_progress') ? () => access(item) : undefined} actionText={item.id === 'expedition' && item.status === 'À récupérer' ? 'Récupérer' : 'Accéder'} />)}
  </div>}{tab === 'wheel' && <WheelCard today={wheelToday} onSpin={onSpinWheel} />}{tab === 'challenge' && <DailyChallengeCard value={dailyChallenge} onPurchase={onPurchaseDailyChallenge} onSwitch={onSwitchDailyChallenge} onOpenParticleConversion={onOpenParticleConversion} onNavigate={onNavigate} />}</ScrollableScreenPanel></div>
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
  if (!value.assigned || !value.challenge) return <section data-business-pending={Boolean(pending)} data-tutorial-anchor="dailies-challenge" className="panel daily-challenge-card available" data-challenge-state="available">
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
  return <section data-business-pending={Boolean(pending)} data-tutorial-anchor="dailies-challenge" className={`panel daily-challenge-card ${value.status.toLowerCase()}`} data-challenge-state={value.status.toLowerCase()}>
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
