import { useEffect, useState } from 'react'
import type { ContestDto, ContestHistoryDto, ContestLegendDto, ContestSnapshotDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import CharacterAssetImage from '../components/CharacterAssetImage'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'

type Props = {
  value: ContestDto
  onRefresh: () => Promise<ContestDto>
  onOpen: (characterId: string, key: string) => Promise<ContestDto>
  onJoin: (characterId: string, key: string) => Promise<ContestDto>
  onSelectLegend: (characterId: string, key: string) => Promise<ContestDto>
  onReady: (ready: boolean, key: string) => Promise<ContestDto>
  onStart: (key: string) => Promise<ContestDto>
  onSpectate: (key: string) => Promise<ContestDto>
  onLeave: (key: string) => Promise<ContestDto>
  onCancel: (key: string) => Promise<ContestDto>
  onPlay: (action: 'BASIC' | 'RISK', key: string) => Promise<ContestDto>
  onSupport: (slot: number, key: string) => Promise<ContestDto>
  onRemoveParticipant: (playerId: string, key: string) => Promise<ContestDto>
  onLoadHistory: (page: number) => Promise<ContestHistoryDto>
  onLoadHistoryDetail: (contestId: string) => Promise<ContestSnapshotDto>
}

export default function ContestScreen(props: Props) {
  const [legendDraftId, setSelectedLegendId] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [intent, setIntent] = useState<{ signature: string; key: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [legendsOpen, setLegendsOpen] = useState(false)
  const [history, setHistory] = useState<ContestHistoryDto | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const activeContestId = props.value.active?.id
  const refresh = props.onRefresh
  const authoritativeLegendId = props.value.active?.status === 'LOBBY' ? props.value.active.viewer.selectedCharacterId : null
  const selectedLegendId = authoritativeLegendId ?? (props.value.legends.some((legend) => legend.character.id === legendDraftId) ? legendDraftId : '')

  useEffect(() => {
    const revalidate = () => { void refresh().catch(() => undefined) }
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') revalidate() }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', onVisibilityChange)
    const poll = activeContestId ? window.setInterval(revalidate, 2_000) : null
    const clock = activeContestId ? window.setInterval(() => setNow(Date.now()), 1_000) : null
    return () => {
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (poll !== null) window.clearInterval(poll)
      if (clock !== null) window.clearInterval(clock)
    }
  }, [activeContestId, refresh])

  const run = async (signature: string, request: (key: string) => Promise<ContestDto>): Promise<ContestDto | null> => {
    if (pending) return null
    const current = intent?.signature === signature ? intent : { signature, key: crypto.randomUUID() }
    setIntent(current); setPending(signature); setError(null)
    try { const value = await request(current.key); setIntent(null); return value }
    catch (reason) { if (!isAmbiguousMutationError(reason)) setIntent(null); setError(apiErrorMessage(reason)) }
    finally { setPending(null) }
    return null
  }
  const openHistory = async (page = 1) => {
    setHistoryOpen(true); setHistoryError(null)
    try { setHistory(await props.onLoadHistory(page)) } catch (reason) { setHistoryError(apiErrorMessage(reason)) }
  }
  const fixed = <div className="contest-toolbar"><div><span className="eyebrow">Thème du jour</span><strong>{props.value.theme.label}</strong></div><div className="contest-toolbar-actions"><button type="button" onClick={() => setLegendsOpen(true)}>Mes Légendes</button><button type="button" onClick={() => void openHistory()}>Historique</button></div></div>

  return <div className="screen-content contest-screen long-screen-layout">
    <ScreenHeader eyebrow="Activités" title="Concours" description="Faites briller vos Légendes C6 dans un affrontement public au tour par tour." />
    <ScrollableScreenPanel className="contest-frame" fixed={fixed}>
      {!props.value.active && !props.value.lastResult && <ContestEmpty value={props.value} selectedLegendId={selectedLegendId} onSelect={setSelectedLegendId} pending={pending} onOpen={() => void run(`open:${selectedLegendId}`, (key) => props.onOpen(selectedLegendId, key))} />}
      {props.value.active?.status === 'LOBBY' && <ContestLobby {...props} contest={props.value.active} selectedLegendId={selectedLegendId} onSelect={setSelectedLegendId} pending={pending} run={run} now={now} />}
      {props.value.active?.status === 'RUNNING' && <ContestRunning {...props} contest={props.value.active} pending={pending} run={run} now={now} />}
      {!props.value.active && props.value.lastResult && <ContestResult contest={props.value.lastResult} legends={props.value.legends} theme={props.value.theme} canOpen={props.value.permissions.canOpen} selectedLegendId={selectedLegendId} onSelect={setSelectedLegendId} pending={pending} onOpen={() => void run(`open:${selectedLegendId}`, (key) => props.onOpen(selectedLegendId, key))} />}
      <p className={`contest-feedback${error ? ' error' : ''}`} role={error ? 'alert' : undefined}>{error ?? ''}</p>
    </ScrollableScreenPanel>
    {legendsOpen && <LegendsModal legends={props.value.legends} onClose={() => setLegendsOpen(false)} />}
    {historyOpen && <HistoryModal history={history} error={historyError} onPage={openHistory} onLoadDetail={props.onLoadHistoryDetail} onClose={() => setHistoryOpen(false)} />}
  </div>
}

function ContestEmpty({ value, selectedLegendId, onSelect, pending, onOpen }: { value: ContestDto; selectedLegendId: string; onSelect: (id: string) => void; pending: string | null; onOpen: () => void }) {
  return <section className="panel contest-empty"><span className="contest-theme-glyph" aria-hidden="true">✦</span><h2>Aucun Concours actif</h2><p>Ouvrez un lobby et devenez son premier participant.</p>
    {value.legends.length > 0 ? <LegendSelect legends={value.legends} theme={value.theme} value={selectedLegendId} onChange={onSelect} /> : <p className="contest-empty-note">Une Légende 5★ C6 active est nécessaire pour participer.</p>}
    {value.dailyUsed && <p className="contest-empty-note">Votre participation quotidienne est déjà utilisée.</p>}
    <button type="button" className="primary-button" disabled={!value.permissions.canOpen || Boolean(pending) || !selectedLegendId} onClick={onOpen}>{pending ? 'Ouverture…' : 'Ouvrir un lobby'}</button>
  </section>
}

type Runner = (signature: string, request: (key: string) => Promise<ContestDto>) => Promise<ContestDto | null>
function ContestLobby(props: Props & { contest: ContestSnapshotDto; selectedLegendId: string; onSelect: (id: string) => void; pending: string | null; run: Runner; now: number }) {
  const { contest, value } = props
  const me = contest.participants.find((item) => item.slot === contest.viewer.participantSlot)
  const changeLegend = async (characterId: string) => {
    const previous = contest.viewer.selectedCharacterId ?? ''
    props.onSelect(characterId)
    const updated = await props.run(`legend:${characterId}`, (key) => props.onSelectLegend(characterId, key))
    if (updated?.active?.viewer.selectedCharacterId) props.onSelect(updated.active.viewer.selectedCharacterId)
    else {
      try {
        const refreshed = await props.onRefresh()
        props.onSelect(refreshed.active?.viewer.selectedCharacterId ?? previous)
      } catch { props.onSelect(previous) }
    }
  }
  return <>
    <section className="panel contest-state-header"><div><span className="eyebrow">Lobby public</span><h2>{contest.theme.label}</h2></div><Countdown label="Fermeture" deadline={contest.lobbyDeadlineAt} now={props.now} /></section>
    <ParticipantGrid contest={contest} organizerCanRemove={contest.viewer.organizer} onRemove={(playerId) => void props.run(`remove:${playerId}`, (key) => props.onRemoveParticipant(playerId, key))} pending={props.pending} />
    <SpectatorStrip contest={contest} />
    {!me && <section className="panel contest-join-panel"><LegendSelect legends={value.legends} theme={value.theme} value={props.selectedLegendId} onChange={props.onSelect} /><div className="contest-inline-actions"><button type="button" className="primary-button" disabled={!value.permissions.canJoin || !props.selectedLegendId || Boolean(props.pending)} onClick={() => void props.run(`join:${props.selectedLegendId}`, (key) => props.onJoin(props.selectedLegendId, key))}>Participer</button>{value.permissions.canSpectate && <button type="button" onClick={() => void props.run('spectate', props.onSpectate)}>Regarder activement</button>}</div></section>}
    {me && <section className="panel contest-lobby-controls"><LegendSelect legends={value.legends} theme={value.theme} value={props.selectedLegendId} onChange={(id) => void changeLegend(id)} /><div className="contest-inline-actions"><button type="button" className={me.ready ? 'contest-ready active' : 'contest-ready'} onClick={() => void props.run(`ready:${!me.ready}`, (key) => props.onReady(!me.ready, key))}>{me.ready ? '✓ Prêt' : 'Je suis prêt'}</button>{contest.viewer.organizer && <button type="button" className="primary-button" disabled={!value.permissions.canStart} onClick={() => void props.run('start', props.onStart)}>Lancer</button>}<button type="button" onClick={() => void props.run('leave', props.onLeave)}>Quitter</button>{contest.viewer.organizer && <button type="button" className="danger-button" onClick={() => void props.run('cancel', props.onCancel)}>Annuler le lobby</button>}</div></section>}
  </>
}

function ContestRunning(props: Props & { contest: ContestSnapshotDto; pending: string | null; run: Runner; now: number }) {
  const { contest, value } = props
  const deadline = contest.phase === 'SUPPORT' ? contest.supportDeadlineAt : contest.turnDeadlineAt
  return <>
    <section className="panel contest-state-header"><div><span className="eyebrow">Manche {contest.currentRound}</span><h2>{contest.phase === 'SUPPORT' ? 'Soutien du public' : 'Concours en cours'}</h2></div><Countdown label={contest.phase === 'SUPPORT' ? 'Soutien' : 'Tour'} deadline={deadline} now={props.now} /></section>
    <ParticipantGrid contest={contest} />
    <SpectatorStrip contest={contest} />
    {value.permissions.canPlay && <section className="panel contest-turn-actions"><h3>À vous de jouer</h3><p>L’action sûre rapporte vos points de base. Le risque rapporte 0, ×1 ou ×2.</p><div><button type="button" className="primary-button" disabled={Boolean(props.pending)} onClick={() => void props.run('play:BASIC', (key) => props.onPlay('BASIC', key))}>Action de base</button><button type="button" disabled={Boolean(props.pending)} onClick={() => void props.run('play:RISK', (key) => props.onPlay('RISK', key))}>Prendre un risque</button></div></section>}
    {value.permissions.canSupport && <section className="panel contest-support-actions"><h3>Vous avez été choisi pour soutenir</h3><p>Sélectionnez n’importe quel participant : votre soutien lui accordera 1, 2 ou 3 points.</p><div>{contest.participants.map((item) => <button type="button" key={item.slot} onClick={() => void props.run(`support:${item.slot}`, (key) => props.onSupport(item.slot, key))}>{item.displayName}</button>)}</div></section>}
    {!value.permissions.canPlay && !value.permissions.canSupport && <p className="contest-watching">Le serveur poursuit la partie. Cette vue s’actualise automatiquement.</p>}
    {value.permissions.canLeave && <div className="contest-footer-actions"><button type="button" onClick={() => void props.run('leave', props.onLeave)}>Quitter le Concours</button>{value.permissions.canCancel && <button type="button" className="danger-button" onClick={() => void props.run('cancel', props.onCancel)}>Annuler le Concours</button>}</div>}
  </>
}

function ParticipantGrid({ contest, organizerCanRemove = false, onRemove, pending }: { contest: ContestSnapshotDto; organizerCanRemove?: boolean; onRemove?: (playerId: string) => void; pending?: string | null }) {
  return <div className="contest-participant-grid">{contest.participants.map((item) => <article className={`panel contest-participant${item.activeTurn ? ' active-turn' : ''}${item.finalRank === 1 ? ' winner' : ''}`} key={item.slot}>
    <div className="contest-avatar"><CharacterAssetImage characterName={item.characterName ?? item.displayName} className="contest-avatar-image" assetPaths={item.kind === 'HUMAN' ? [item.avatar] : []} fallback={<span>{item.kind === 'BOT' ? '◆' : item.displayName.slice(0, 1).toUpperCase()}</span>} /></div>
    <span className="contest-slot">#{item.slot}{item.turnOrder ? ` · tour ${item.turnOrder}` : ''}</span><h3>{item.displayName}</h3><p>{item.characterName}</p>
    {item.basePoints !== null && <div className="contest-score"><strong>{item.score}</strong><span>points · base +{item.basePoints}</span></div>}
    {item.title && <span className="contest-title">{item.title}</span>}{contest.status === 'LOBBY' && <span className={item.ready ? 'contest-ready-state ready' : 'contest-ready-state'}>{item.ready ? 'Prêt' : 'Pas prêt'}</span>}
    {item.replaced && <span className="contest-replaced">Remplacement IA</span>}
    {item.finalRank && <strong className="contest-rank">{item.finalRank}<sup>e</sup> · {formatResourceAmount(item.rewardPrimogems ?? '0')} Primos</strong>}
    {organizerCanRemove && item.playerId && item.playerId !== contest.organizerPlayerId && <button type="button" className="contest-remove" disabled={Boolean(pending)} onClick={() => onRemove?.(item.playerId!)}>Retirer</button>}
  </article>)}</div>
}

function SpectatorStrip({ contest }: { contest: ContestSnapshotDto }) {
  if (contest.spectators.length === 0) return null
  return <section className="panel contest-spectators" aria-label="Spectateurs actifs"><span className="eyebrow">Spectateurs actifs</span><div>{contest.spectators.map((spectator) => <span className={spectator.selected ? 'selected' : ''} key={spectator.playerId}>{spectator.displayName}{spectator.selected ? ' · soutien sélectionné' : ''}</span>)}</div></section>
}

function ContestResult({ contest, legends, theme, canOpen, selectedLegendId, onSelect, pending, onOpen }: { contest: ContestSnapshotDto; legends: readonly ContestLegendDto[]; theme: ContestDto['theme']; canOpen: boolean; selectedLegendId: string; onSelect: (id: string) => void; pending: string | null; onOpen: () => void }) {
  const winner = contest.participants.find((item) => item.slot === contest.winnerSlot)
  return <><section className="panel contest-result-hero"><span className="eyebrow">Dernier résultat</span><h2>{winner?.displayName ?? 'Concours terminé'} remporte le Concours</h2><p>{contest.theme.label} · {contest.currentRound} manche{contest.currentRound > 1 ? 's' : ''}</p>{contest.promotions.length > 0 && <div className="contest-promotions" aria-label="Promotions de titre">{contest.promotions.map((promotion) => <strong key={`${promotion.playerId}:${promotion.slot}`}>✨ {promotion.characterName ?? 'Légende'} devient {promotion.title} !</strong>)}</div>}{canOpen && <div className="contest-new-lobby"><LegendSelect legends={legends} theme={theme} value={selectedLegendId} onChange={onSelect} /><button type="button" className="primary-button" disabled={!selectedLegendId || Boolean(pending)} onClick={onOpen}>{pending ? 'Ouverture…' : 'Ouvrir un nouveau lobby'}</button></div>}</section><ParticipantGrid contest={contest} /></>
}

function LegendSelect({ legends, theme, value, onChange }: { legends: readonly ContestLegendDto[]; theme: ContestDto['theme']; value: string; onChange: (id: string) => void }) {
  return <label className="contest-legend-select"><span>Légende participante</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={legends.length === 0}><option value="">Choisir une Légende</option>{legends.map((legend) => <option key={legend.character.id} value={legend.character.id}>{legend.character.name} — {legend.stats[theme.statKey]}/20</option>)}</select></label>
}

function Countdown({ label, deadline, now }: { label: string; deadline: string | null; now: number }) {
  const remaining = deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1_000)) : 0
  return <div className="contest-countdown"><span>{label}</span><strong>{Math.floor(remaining / 60).toString().padStart(2, '0')}:{(remaining % 60).toString().padStart(2, '0')}</strong></div>
}

function LegendsModal({ legends, onClose }: { legends: readonly ContestLegendDto[]; onClose: () => void }) {
  return <div className="history-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="panel history-modal contest-legends-modal" role="dialog" aria-modal="true" aria-label="Mes Légendes"><header><div><span className="eyebrow">Concours</span><h2>Mes Légendes</h2></div><button type="button" onClick={onClose} aria-label="Fermer">✕</button></header><div className="history-modal-body contest-legends-list">{legends.length === 0 ? <p>Aucune Légende 5★ C6 active.</p> : legends.map((legend) => <article key={legend.character.id}><h3>{legend.character.name}</h3><div className="contest-five-stats"><span>Force <strong>{legend.stats.strength}/20</strong></span><span>Intelligence <strong>{legend.stats.intelligence}/20</strong></span><span>Beauté <strong>{legend.stats.beauty}/20</strong></span><span>Charisme <strong>{legend.stats.charisma}/20</strong></span><span>Popularité <strong>{legend.stats.popularity}/20</strong></span></div><p>{legend.totals.contests} participations · {legend.totals.wins} victoires</p><div className="contest-title-list">{Object.values(legend.themes).map((theme, index) => <span key={index}>{theme.title ?? 'Aucun titre'} · {theme.participations} / {theme.wins}</span>)}</div></article>)}</div><footer className="history-modal-pagination"><span /><span>{legends.length} Légende{legends.length > 1 ? 's' : ''}</span><button type="button" onClick={onClose}>Fermer</button></footer></section></div>
}

function HistoryModal({ history, error, onPage, onLoadDetail, onClose }: { history: ContestHistoryDto | null; error: string | null; onPage: (page: number) => Promise<void>; onLoadDetail: (contestId: string) => Promise<ContestSnapshotDto>; onClose: () => void }) {
  const [detail, setDetail] = useState<ContestSnapshotDto | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailPending, setDetailPending] = useState(false)
  const loadDetail = async (contestId: string) => {
    setDetailPending(true); setDetailError(null)
    try { setDetail(await onLoadDetail(contestId)) } catch (reason) { setDetailError(apiErrorMessage(reason)) }
    finally { setDetailPending(false) }
  }
  const changePage = async (page: number) => { setDetail(null); setDetailError(null); await onPage(page) }
  return <div className="history-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="panel history-modal contest-history-modal" role="dialog" aria-modal="true" aria-label="Historique des Concours"><header><div><span className="eyebrow">Concours terminés</span><h2>{detail ? 'Détail du Concours' : 'Historique'}</h2></div><button type="button" onClick={onClose} aria-label="Fermer">✕</button></header>{detail ? <ContestHistoryDetail contest={detail} onBack={() => setDetail(null)} /> : <><div className="history-modal-body contest-history-list">{error && <p role="alert">{error}</p>}{detailError && <p role="alert">{detailError}</p>}{!history && !error && <p>Chargement…</p>}{history && history.contests.length === 0 && <p>Aucun Concours terminé.</p>}{history?.contests.map((contest) => <article key={contest.id}><div><strong>{formatBusinessDate(contest.businessDate)} · {contest.theme.label}</strong><span>{contest.currentRound} manche{contest.currentRound > 1 ? 's' : ''} · vainqueur {contest.winner?.displayName ?? '—'}</span></div><button type="button" disabled={detailPending} onClick={() => void loadDetail(contest.id)}>Détails →</button></article>)}</div><footer className="history-modal-pagination"><button type="button" disabled={!history || history.page <= 1} onClick={() => history && void changePage(history.page - 1)}>Précédent</button><span>Page {history?.page ?? 1} / {history?.pageCount ?? 1}</span><button type="button" disabled={!history || history.page >= history.pageCount} onClick={() => history && void changePage(history.page + 1)}>Suivant</button></footer></>}</section></div>
}

function ContestHistoryDetail({ contest, onBack }: { contest: ContestSnapshotDto; onBack: () => void }) {
  const ranked = [...contest.participants].sort((left, right) => (left.finalRank ?? 99) - (right.finalRank ?? 99))
  const ordered = [...contest.participants].sort((left, right) => (left.turnOrder ?? 99) - (right.turnOrder ?? 99))
  const importantEvents = contest.historyEvents.filter((event) => event.kind !== 'TITLE_PROMOTED')
  return <><div className="history-modal-body contest-history-detail"><button type="button" className="contest-history-back" onClick={onBack}>← Retour à la liste</button><dl><div><dt>Date métier</dt><dd>{formatBusinessDate(contest.businessDate)}</dd></div><div><dt>Début</dt><dd>{formatContestTime(contest.startedAt)}</dd></div><div><dt>Fin</dt><dd>{formatContestTime(contest.finishedAt)}</dd></div><div><dt>Durée</dt><dd>{formatDuration(contest.startedAt, contest.finishedAt)}</dd></div><div><dt>Thème</dt><dd>{contest.theme.label}</dd></div><div><dt>Manches</dt><dd>{contest.currentRound}</dd></div></dl><section><h3>Ordre de tour</h3><p>{ordered.map((item) => `${item.turnOrder ?? '—'}. ${item.displayName}`).join(' · ')}</p></section><section><h3>Classement complet</h3><div className="contest-history-ranking">{ranked.map((item) => <article className={item.slot === contest.winnerSlot ? 'winner' : ''} key={item.slot}><strong>#{item.finalRank} {item.displayName}{item.slot === contest.winnerSlot ? ' · vainqueur' : ''}</strong><span>{item.kind === 'HUMAN' ? `Humain · ${item.characterName ?? 'Légende inconnue'}` : 'Bot'}</span><span>{item.score} points · {formatResourceAmount(item.rewardPrimogems ?? '0')} Primos</span>{item.replaced && <span>Remplacé par l’IA · {replacementReason(item.replacementReason)}</span>}</article>)}</div></section>{contest.promotions.length > 0 && <section><h3>Promotions de titre</h3><div className="contest-promotions">{contest.promotions.map((promotion) => <strong key={`${promotion.playerId}:${promotion.slot}`}>✨ {promotion.characterName ?? 'Légende'} devient {promotion.title} !</strong>)}</div></section>}<section><h3>Moments importants</h3>{importantEvents.length ? <ul>{importantEvents.map((event, index) => <li key={`${event.kind}:${event.occurredAt}:${index}`}>{historyEventLabel(event)}</li>)}</ul> : <p>Aucun départ, remplacement ou soutien à signaler.</p>}</section></div><footer className="history-modal-pagination"><button type="button" onClick={onBack}>Retour</button><span>Résultat terminé</span><span /></footer></>
}

function historyEventLabel(event: ContestSnapshotDto['historyEvents'][number]) {
  if (event.kind === 'PARTICIPANT_LEFT') return `${event.playerName ?? 'Un participant'} a quitté le Concours${event.slot ? ` (slot ${event.slot})` : ''}.`
  if (event.kind === 'PARTICIPANT_REPLACED') return `${event.playerName ?? 'Un participant'} a été remplacé par l’IA${event.slot ? ` (slot ${event.slot})` : ''} · ${replacementReason(event.reason)}.`
  if (event.kind === 'SUPPORT_SELECTED') return `${event.playerName ?? 'Un spectateur'} a été sélectionné pour le soutien${event.round ? ` à la manche ${event.round}` : ''}.`
  if (event.kind === 'SUPPORT_PLAYED') return `${event.playerName ?? 'Un spectateur'} a soutenu ${event.targetName ?? `le slot ${event.slot ?? '—'}`} de ${event.points ?? 0} point${event.points === 1 ? '' : 's'}.`
  if (event.kind === 'SUPPORT_SKIPPED') return `Le soutien${event.round ? ` de la manche ${event.round}` : ''} n’a pas été joué.`
  return `${event.characterName ?? 'Une Légende'} devient ${event.title}.`
}

function replacementReason(reason: ContestSnapshotDto['participants'][number]['replacementReason'] | string | null | undefined) {
  if (reason === 'LEFT') return 'départ volontaire'
  if (reason === 'INACTIVE') return 'inactivité'
  if (reason === 'ADMIN_REMOVAL') return 'retrait administratif'
  return 'remplacement'
}

function formatBusinessDate(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date(`${value}T12:00:00Z`)) }
function formatContestTime(value: string | null) { return value ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(value)) : '—' }
function formatDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt || !finishedAt) return '—'
  const seconds = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1_000))
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}
