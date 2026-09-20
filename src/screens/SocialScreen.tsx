import { useEffect, useState } from 'react'
import { elementKeys, type ElementKey } from '../api/types'
import AppButton from '../components/AppButton'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import PlayerIdentity from '../social/PlayerIdentity'
import { presenceLabels, type DirectoryPage, type SocialActions } from '../social/types'
import { apiErrorMessage, elementLabels } from '../utils/formatters'

export default function SocialScreen({ actions, onProfile }: { actions: SocialActions; onProfile: (id: string) => void }) {
  const [q, setQ] = useState(''), [element, setElement] = useState<ElementKey | undefined>(), [page, setPage] = useState(1)
  const [result, setResult] = useState<DirectoryPage | null>(null), [error, setError] = useState(''), [pending, setPending] = useState(true)
  useEffect(() => {
    let active = true, timer: number | undefined
    const load = async () => {
      try { const next = await actions.directory({ q, element, page }); if (active) { setResult(next); setError('') } }
      catch (reason) { if (active) { setResult(null); setError(apiErrorMessage(reason)) } }
      finally { if (active) { setPending(false); timer = window.setTimeout(() => void load(), 30_000) } }
    }
    void load(); return () => { active = false; window.clearTimeout(timer) }
  }, [actions, q, element, page])
  const change = (run: () => void) => { setPending(true); setPage(1); run() }
  return <div className="screen-content social-screen long-screen-layout">
    <ScreenHeader eyebrow="Communauté" title="Social" description="Joueurs" />
    <ScrollableScreenPanel className="social-frame" fixed={<div className="moderation-browser-filters">
      <label><span>Rechercher</span><input type="search" value={q} placeholder="Pseudo du joueur…" onChange={e => change(() => setQ(e.target.value))} /></label>
      <label><span>Élément</span><select value={element ?? ''} onChange={e => change(() => setElement(e.target.value ? e.target.value as ElementKey : undefined))}><option value="">Tous</option>{elementKeys.map(key => <option key={key} value={key}>{elementLabels[key]}</option>)}</select></label>
    </div>} footer={<div className="social-pagination"><AppButton disabled={pending || (result?.page ?? page) <= 1} onClick={() => { setPending(true); setPage((result?.page ?? page) - 1) }}>Précédent</AppButton><span>Page {result?.page ?? page} / {result?.totalPages ?? 1}</span><AppButton disabled={pending || !result || result.page >= result.totalPages} onClick={() => { setPending(true); setPage((result?.page ?? page) + 1) }}>Suivant</AppButton></div>}>
      <div className="social-player-list" aria-busy={pending}>{error ? <p role="alert">{error}</p> : pending ? <p role="status">Chargement des joueurs…</p> : result?.players.length ? result.players.map(player => <PlayerIdentity key={player.id} player={player} onOpen={() => onProfile(player.id)} status={player.presence.access === 'ALLOWED' ? presenceLabels[player.presence.data] : undefined} />) : <p>Aucun joueur trouvé.</p>}</div>
    </ScrollableScreenPanel>
  </div>
}
