import { useCallback, useEffect, useState } from 'react'
import type { PlayerMissionsDto } from '../api/types'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage } from '../utils/formatters'
import MissionProjectionView from '../missions/MissionProjectionView'

type MissionsScreenProps = Readonly<{ onLoad: () => Promise<PlayerMissionsDto> }>

function MissionsScreen({ onLoad }: MissionsScreenProps) {
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
  let content
  if (loading && !value) content = <div className="missions-state" role="status">Chargement des Missions…</div>
  else if (error) content = <div className="missions-state" role="alert"><strong>Missions indisponibles</strong><p>{error}</p><button type="button" className="small-primary-button" onClick={retry}>Réessayer</button></div>
  else content = value ? <MissionProjectionView value={value} /> : null

  return <div className="screen-content activity-shell missions-screen long-screen-layout"><ScreenHeader eyebrow="Activités" title="Missions" description="Suivez vos objectifs permanents et leurs récompenses." /><ScrollableScreenPanel className="missions-frame">{content}</ScrollableScreenPanel></div>
}

export default MissionsScreen
