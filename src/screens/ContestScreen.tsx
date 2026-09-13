import { useEffect, useMemo, useState } from 'react'
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
}

export default function ContestScreen(props: Props) {
  const [selectedLegendId, setSelectedLegendId] = useState(props.value.legends[0]?.character.id ?? '')
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

  useEffect(() => {
    if (!activeContestId) return
    const poll = window.setInterval(() => { void refresh().catch(() => undefined) }, 2_000)
    const clock = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => { window.clearInterval(poll); window.clearInterval(clock) }
  }, [activeContestId, refresh])

  const run = async (signature: string, request: (key: string) => Promise<ContestDto>) => {
    if (pending) return
    const current = intent?.signature === signature ? intent : { signature, key: crypto.randomUUID() }
    setIntent(current); setPending(signature); setError(null)
    try { await request(current.key); setIntent(null) }
    catch (reason) { if (!isAmbiguousMutationError(reason)) setIntent(null); setError(apiErrorMessage(reason)) }
    finally { setPending(null) }
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
      {!props.value.active && props.value.lastResult && <ContestResult contest={props.value.lastResult} onNew={() => undefined} canOpen={props.value.permissions.canOpen} selectedLegendId={selectedLegendId} onOpen={() => void run(`open:${selectedLegendId}`, (key) => props.onOpen(selectedLegendId, key))} />}
      <p className={`contest-feedback${error ? ' error' : ''}`} role={error ? 'alert' : undefined}>{error ?? ''}</p>
    </ScrollableScreenPanel>
    {legendsOpen && <LegendsModal legends={props.value.legends} onClose={() => setLegendsOpen(false)} />}
    {historyOpen && <HistoryModal history={history} error={historyError} onPage={openHistory} onClose={() => setHistoryOpen(false)} />}
  </div>
}

function ContestEmpty({ value, selectedLegendId, onSelect, pending, onOpen }: { value: ContestDto; selectedLegendId: string; onSelect: (id: string) => void; pending: string | null; onOpen: () => void }) {
  return <section className="panel contest-empty"><span className="contest-theme-glyph" aria-hidden="true">✦</span><h2>Aucun Concours actif</h2><p>Ouvrez un lobby et devenez son premier participant.</p>
    {value.legends.length > 0 ? <LegendSelect legends={value.legends} value={selectedLegendId} onChange={onSelect} /> : <p className="contest-empty-note">Une Légende 5★ C6 active est nécessaire pour participer.</p>}
    {value.dailyUsed && <p className="contest-empty-note">Votre participation quotidienne est déjà utilisée.</p>}
    <button type="button" className="primary-button" disabled={!value.permissions.canOpen || Boolean(pending) || !selectedLegendId} onClick={onOpen}>{pending ? 'Ouverture…' : 'Ouvrir un lobby'}</button>
  </section>
}

type Runner = (signature: string, request: (key: string) => Promise<ContestDto>) => Promise<void>
function ContestLobby(props: Props & { contest: ContestSnapshotDto; selectedLegendId: string; onSelect: (id: string) => void; pending: string | null; run: Runner; now: number }) {
  const { contest, value } = props
  const me = contest.participants.find((item) => item.slot === contest.viewer.participantSlot)
  return <>
    <section className="panel contest-state-header"><div><span className="eyebrow">Lobby public</span><h2>{contest.theme.label}</h2></div><Countdown label="Fermeture" deadline={contest.lobbyDeadlineAt} now={props.now} /></section>
    <ParticipantGrid contest={contest} organizerCanRemove={contest.viewer.organizer} onRemove={(playerId) => void props.run(`remove:${playerId}`, (key) => props.onRemoveParticipant(playerId, key))} pending={props.pending} />
    <SpectatorStrip contest={contest} />
    {!me && <section className="panel contest-join-panel"><LegendSelect legends={value.legends} value={props.selectedLegendId} onChange={props.onSelect} /><div className="contest-inline-actions"><button type="button" className="primary-button" disabled={!value.permissions.canJoin || !props.selectedLegendId || Boolean(props.pending)} onClick={() => void props.run(`join:${props.selectedLegendId}`, (key) => props.onJoin(props.selectedLegendId, key))}>Participer</button>{value.permissions.canSpectate && <button type="button" onClick={() => void props.run('spectate', props.onSpectate)}>Regarder activement</button>}</div></section>}
    {me && <section className="panel contest-lobby-controls"><LegendSelect legends={value.legends} value={me.playerId ? props.selectedLegendId || value.legends.find((legend) => legend.character.name === me.characterName)?.character.id || '' : ''} onChange={(id) => { props.onSelect(id); void props.run(`legend:${id}`, (key) => props.onSelectLegend(id, key)) }} /><div className="contest-inline-actions"><button type="button" className={me.ready ? 'contest-ready active' : 'contest-ready'} onClick={() => void props.run(`ready:${!me.ready}`, (key) => props.onReady(!me.ready, key))}>{me.ready ? '✓ Prêt' : 'Je suis prêt'}</button>{contest.viewer.organizer && <button type="button" className="primary-button" disabled={!value.permissions.canStart} onClick={() => void props.run('start', props.onStart)}>Lancer avec des bots</button>}<button type="button" onClick={() => void props.run('leave', props.onLeave)}>Quitter</button>{contest.viewer.organizer && <button type="button" className="danger-button" onClick={() => void props.run('cancel', props.onCancel)}>Annuler le lobby</button>}</div></section>}
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

function ContestResult({ contest, canOpen, selectedLegendId, onOpen }: { contest: ContestSnapshotDto; canOpen: boolean; selectedLegendId: string; onNew: () => void; onOpen: () => void }) {
  const winner = contest.participants.find((item) => item.slot === contest.winnerSlot)
  return <><section className="panel contest-result-hero"><span className="eyebrow">Dernier résultat</span><h2>{winner?.displayName ?? 'Concours terminé'} remporte le Concours</h2><p>{contest.theme.label} · {contest.currentRound} manche{contest.currentRound > 1 ? 's' : ''}</p>{canOpen && selectedLegendId && <button type="button" className="primary-button" onClick={onOpen}>Ouvrir un nouveau lobby</button>}</section><ParticipantGrid contest={contest} /></>
}

function LegendSelect({ legends, value, onChange }: { legends: readonly ContestLegendDto[]; value: string; onChange: (id: string) => void }) {
  return <label className="contest-legend-select"><span>Légende participante</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={legends.length === 0}><option value="">Choisir une Légende</option>{legends.map((legend) => <option key={legend.character.id} value={legend.character.id}>{legend.character.name}</option>)}</select></label>
}

function Countdown({ label, deadline, now }: { label: string; deadline: string | null; now: number }) {
  const remaining = deadline ? Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1_000)) : 0
  return <div className="contest-countdown"><span>{label}</span><strong>{Math.floor(remaining / 60).toString().padStart(2, '0')}:{(remaining % 60).toString().padStart(2, '0')}</strong></div>
}

function LegendsModal({ legends, onClose }: { legends: readonly ContestLegendDto[]; onClose: () => void }) {
  return <div className="history-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="panel history-modal contest-legends-modal" role="dialog" aria-modal="true" aria-label="Mes Légendes"><header><div><span className="eyebrow">Concours</span><h2>Mes Légendes</h2></div><button type="button" onClick={onClose} aria-label="Fermer">✕</button></header><div className="history-modal-body contest-legends-list">{legends.length === 0 ? <p>Aucune Légende 5★ C6 active.</p> : legends.map((legend) => <article key={legend.character.id}><h3>{legend.character.name}</h3><div className="contest-five-stats"><span>Force <strong>{legend.stats.strength}/20</strong></span><span>Intelligence <strong>{legend.stats.intelligence}/20</strong></span><span>Beauté <strong>{legend.stats.beauty}/20</strong></span><span>Charisme <strong>{legend.stats.charisma}/20</strong></span><span>Popularité <strong>{legend.stats.popularity}/20</strong></span></div><p>{legend.totals.contests} participations · {legend.totals.wins} victoires</p><div className="contest-title-list">{Object.values(legend.themes).map((theme, index) => <span key={index}>{theme.title ?? 'Aucun titre'} · {theme.participations} / {theme.wins}</span>)}</div></article>)}</div><footer className="history-modal-pagination"><span /><span>{legends.length} Légende{legends.length > 1 ? 's' : ''}</span><button type="button" onClick={onClose}>Fermer</button></footer></section></div>
}

function HistoryModal({ history, error, onPage, onClose }: { history: ContestHistoryDto | null; error: string | null; onPage: (page: number) => Promise<void>; onClose: () => void }) {
  const selected = useMemo(() => history?.contests ?? [], [history])
  return <div className="history-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="panel history-modal contest-history-modal" role="dialog" aria-modal="true" aria-label="Historique des Concours"><header><div><span className="eyebrow">Concours terminés</span><h2>Historique</h2></div><button type="button" onClick={onClose} aria-label="Fermer">✕</button></header><div className="history-modal-body contest-history-list">{error && <p role="alert">{error}</p>}{!history && !error && <p>Chargement…</p>}{history && selected.length === 0 && <p>Aucun Concours terminé.</p>}{selected.map((contest) => <article key={contest.id}><header><strong>{contest.businessDate} · {contest.theme.label}</strong><span>{contest.currentRound} manche{contest.currentRound > 1 ? 's' : ''}</span></header><div>{contest.participants.map((item) => <span key={item.slot}><strong>#{item.finalRank} {item.displayName}</strong> · {item.score} pts · {item.rewardPrimogems} Primos{item.replaced ? ' · remplacé' : ''}</span>)}</div></article>)}</div><footer className="history-modal-pagination"><button type="button" disabled={!history || history.page <= 1} onClick={() => history && void onPage(history.page - 1)}>Précédent</button><span>Page {history?.page ?? 1} / {history?.pageCount ?? 1}</span><button type="button" disabled={!history || history.page >= history.pageCount} onClick={() => history && void onPage(history.page + 1)}>Suivant</button></footer></section></div>
}
