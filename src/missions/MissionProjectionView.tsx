import { useState } from 'react'
import type { PermanentMissionDto, PermanentMissionProjectionDto, PermanentMissionRankDto } from '../api/types'
import { formatResourceAmount } from '../utils/formatters'
import { lockedZMessage, orderMissionCards, preferredMissionRank, progressPercent } from './mission-presentation'

const ranks = ['B', 'A', 'S', 'Z'] as const

export default function MissionProjectionView({ value }: Readonly<{ value: PermanentMissionProjectionDto }>) {
  const [rank, setRank] = useState<PermanentMissionRankDto>(() => preferredMissionRank(value))
  const missions = rank === 'Z' ? value.z.status === 'LOCKED' ? [] : value.z.missions : value.ranks[rank]
  return <div className="mission-projection-view">
    <nav className="activity-inner-tabs missions-rank-tabs" aria-label="Rangs des Missions">{ranks.map(candidate => <button type="button" className={rank === candidate ? 'active' : ''} aria-pressed={rank === candidate} key={candidate} onClick={() => setRank(candidate)}>{candidate}</button>)}</nav>
    <div className="mission-projection-content">
      {rank === 'Z' && value.z.status === 'LOCKED'
        ? <div className="missions-state missions-z-locked"><strong>Rang Z verrouillé</strong><p>{lockedZMessage}</p></div>
        : <>{rank === 'Z' && value.z.status === 'COMPLETED' && <p className="mission-rank-summary">✅ Rang Z terminé</p>}<div className="mission-grid" data-mission-rank={rank}>{orderMissionCards(missions).map(mission => <MissionCard key={mission.externalKey} mission={mission} />)}</div></>}
    </div>
  </div>
}

export function MissionCard({ mission }: Readonly<{ mission: PermanentMissionDto }>) {
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
