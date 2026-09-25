import { useCallback, useEffect, useState } from 'react'
import type { PermanentMissionDto, PermanentMissionRankDto, PlayerMissionsDto } from '../api/types'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import { lockedZMessage, progressPercent } from '../missions/mission-presentation'

const ranks = ['B', 'A', 'S', 'Z'] as const

type MissionsScreenProps = Readonly<{ onLoad: () => Promise<PlayerMissionsDto> }>

function MissionsScreen({ onLoad }: MissionsScreenProps) {
  const [rank, setRank] = useState<PermanentMissionRankDto>('B')
  const [value, setValue] = useState<PlayerMissionsDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [requestToken, setRequestToken] = useState(0)

  useEffect(() => {
    let active = true
    void onLoad().then((next) => {
      if (active) setValue(next)
    }).catch((cause: unknown) => {
      if (active) setError(apiErrorMessage(cause))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [onLoad, requestToken])

  const retry = useCallback(() => {
    setError(null)
    setLoading(true)
    setRequestToken((current) => current + 1)
  }, [])
  const tabs = <nav className="activity-inner-tabs missions-rank-tabs" aria-label="Rangs des Missions">{ranks.map((candidate) => <button type="button" className={rank === candidate ? 'active' : ''} aria-pressed={rank === candidate} key={candidate} onClick={() => setRank(candidate)}>{candidate}</button>)}</nav>

  let content
  if (loading && !value) content = <div className="missions-state" role="status">Chargement des Missions…</div>
  else if (error) content = <div className="missions-state" role="alert"><strong>Missions indisponibles</strong><p>{error}</p><button type="button" className="small-primary-button" onClick={retry}>Réessayer</button></div>
  else if (!value) content = null
  else if (rank === 'Z' && value.z.status === 'LOCKED') content = <div className="missions-state missions-z-locked"><strong>Rang Z verrouillé</strong><p>{lockedZMessage}</p></div>
  else {
    const missions = rank === 'Z' ? value.z.status === 'LOCKED' ? [] : value.z.missions : value.ranks[rank]
    content = <>{rank === 'Z' && value.z.status === 'COMPLETED' && <p className="mission-rank-summary">✅ Rang Z terminé</p>}<div className="mission-grid" data-mission-rank={rank}>{missions.map((mission) => <MissionCard key={mission.externalKey} mission={mission} />)}</div></>
  }

  return <div className="screen-content activity-shell missions-screen long-screen-layout"><ScreenHeader eyebrow="Activités" title="Missions" description="Suivez vos objectifs permanents et leurs récompenses." /><ScrollableScreenPanel className="missions-frame" fixed={tabs}>{content}</ScrollableScreenPanel></div>
}

function MissionCard({ mission }: Readonly<{ mission: PermanentMissionDto }>) {
  const percent = progressPercent(mission.progress, mission.target)
  const status = mission.status === 'COMPLETED' ? '✅ Terminée' : mission.status === 'ACTIVE' ? '▶ En cours' : '🔒 Verrouillée'
  return <article className={`mission-card mission-card-${mission.status.toLocaleLowerCase('fr-FR')}`} data-mission-key={mission.externalKey}>
    <header><span className="mission-rank-badge">Rang {mission.rank}</span><span className="mission-status">{status}</span></header>
    <div className="mission-card-copy"><h2>{mission.displayName}</h2><p>{mission.description}</p></div>
    <div className="mission-progress-copy"><span>{mission.progressLabel}</span><strong>{formatResourceAmount(mission.progress)} / {formatResourceAmount(mission.target)}</strong></div>
    <div className="mission-progress-track" role="progressbar" aria-label={mission.progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
    <footer><span>Récompense</span><strong>+{formatResourceAmount(mission.rewardPrimogems)} Primogemmes</strong></footer>
  </article>
}

export default MissionsScreen
