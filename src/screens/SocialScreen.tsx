import { useEffect, useState } from 'react'
import { elementKeys, type ElementKey } from '../api/types'
import AppButton from '../components/AppButton'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import PlayerIdentity from '../social/PlayerIdentity'
import { presenceLabels, type DirectoryPage, type SocialActions, type PresenceStatus, type FriendSort } from '../social/types'
import type { FriendshipController } from '../social/use-friendships'
import { apiErrorMessage, elementLabels } from '../utils/formatters'
import { normalizeCharacterSearch } from '../characters/character-catalog'

export type SocialTab = 'friends' | 'requests' | 'players'
export default function SocialScreen({ actions, onProfile, controller, initialTab = 'friends', selectedTab, onTabChange }: { actions: SocialActions; onProfile: (id: string) => void; controller: FriendshipController; initialTab?: SocialTab; selectedTab?: SocialTab; onTabChange?: (tab: SocialTab) => void }) {
  const [localTab, setLocalTab] = useState<SocialTab>(initialTab)
  const tab = selectedTab ?? localTab
  const setTab = (next: SocialTab) => { setLocalTab(next); onTabChange?.(next) }
  const [q, setQ] = useState(''), [element, setElement] = useState<ElementKey | undefined>(), [status, setStatus] = useState<PresenceStatus | undefined>(), [page, setPage] = useState(1)
  const [result, setResult] = useState<DirectoryPage | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const { value, pending, mutate } = controller
  useEffect(() => {
    if (tab !== 'players') return
    let active = true, timer: number | undefined
    const load = async () => {
      setLoading(true)
      try { const next = await actions.directory({ q, element, status, page }); if (active) { setResult(next); setError('') } }
      catch (reason) { if (active) setError(apiErrorMessage(reason)) }
      finally { if (active) { setLoading(false); timer = window.setTimeout(() => void load(), 30_000) } }
    }
    void load(); return () => { active = false; window.clearTimeout(timer) }
  }, [actions, q, element, status, page, tab, value])
  const change = (run: () => void) => { setPage(1); run() }
  const identities = new Map(value?.players.map(p => [p.id, p]))
  const friends = (value?.friends ?? []).filter(f => normalizeCharacterSearch(identities.get(f.playerId)?.displayName ?? '').includes(normalizeCharacterSearch(q))).sort((a, b) => {
    const ap = identities.get(a.playerId), bp = identities.get(b.playerId)
    const group = (p: typeof ap) => p?.presence.access !== 'ALLOWED' ? 2 : p.presence.data === 'OFFLINE' ? 1 : 0
    const order = value?.sort === 'level' ? b.level - a.level : value?.sort === 'heart' ? Number(b.canSend) - Number(a.canSend) : value?.sort === 'presence' ? group(ap) - group(bp) : 0
    return order || (ap?.displayName ?? '').localeCompare(bp?.displayName ?? '', 'fr', { sensitivity: 'base' }) || a.playerId.localeCompare(b.playerId)
  })
  const identity = (id: string) => { const p = identities.get(id); return p ? <PlayerIdentity player={p} onOpen={() => onProfile(id)} status={p.presence.access === 'ALLOWED' ? presenceLabels[p.presence.data] : undefined} /> : <span>Joueur indisponible</span> }
  return <div className="screen-content social-screen long-screen-layout">
    <ScreenHeader eyebrow="Communauté" title="Social" />
    <ScrollableScreenPanel className="social-frame" fixed={<>
      <nav className="secondary-navigation social-tabs" aria-label="Rubriques Social">{([['friends', 'Amis'], ['requests', 'Demandes'], ['players', 'Joueurs']] as const).map(([id, label]) => <AppButton key={id} className={tab === id ? 'active' : ''} aria-pressed={tab === id} onClick={() => { setTab(id); setQ(''); setPage(1) }}>{label}</AppButton>)}</nav>
      {tab !== 'requests' && <div className="moderation-browser-filters social-filters">
        <label><span>Rechercher</span><input type="search" value={q} placeholder="Pseudo du joueur…" onChange={e => change(() => setQ(e.target.value))} /></label>
        {tab === 'players' ? <><label><span>Élément</span><select value={element ?? ''} onChange={e => change(() => setElement(e.target.value ? e.target.value as ElementKey : undefined))}><option value="">Tous</option>{elementKeys.map(key => <option key={key} value={key}>{elementLabels[key]}</option>)}</select></label><label><span>Statut</span><select value={status ?? ''} onChange={e => change(() => setStatus(e.target.value ? e.target.value as PresenceStatus : undefined))}><option value="">Tous</option>{Object.entries(presenceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></> : <><label><span>Trier les amis</span><select value={value?.sort ?? 'presence'} disabled={pending || !value} onChange={e => void controller.saveSort(e.target.value as FriendSort)}><option value="presence">Présence</option><option value="name">Alphabétique</option><option value="level">Niveau d’amitié</option><option value="heart">Cœur disponible</option></select></label><AppButton disabled={pending || !value?.summary.available} onClick={() => void mutate('all', 'HEART')}>Envoyer à tous</AppButton></>}
      </div>}
      <div className="social-feedback" role="status">{pending ? 'Enregistrement…' : controller.feedback}</div>
      {(controller.error || error) && <p role="alert">{controller.error || error}</p>}
    </>} footer={tab === 'players' ? <div className="social-pagination"><AppButton disabled={loading || (result?.page ?? page) <= 1} onClick={() => setPage((result?.page ?? page) - 1)}>Précédent</AppButton><span>Page {result?.page ?? page} / {result?.totalPages ?? 1}</span><AppButton disabled={loading || !result || result.page >= result.totalPages} onClick={() => setPage((result?.page ?? page) + 1)}>Suivant</AppButton></div> : undefined}>
      <div className="social-player-list" aria-busy={pending || loading}>
        {tab === 'friends' && (!value ? <p>Chargement des amis…</p> : friends.length ? friends.map(f => <div className="social-row" key={f.id}><div>{identity(f.playerId)}<p className="friendship-detail">{f.tier} · Niveau {f.level} · {f.totalHearts} cœur(s)</p></div><div className="social-row-actions"><AppButton disabled={pending || !f.canSend} onClick={() => void mutate(f.playerId, 'HEART')}>{f.heartSent ? 'Cœur envoyé ✓' : 'Envoyer un cœur'}</AppButton><AppButton variant="danger" disabled={pending} onClick={() => void mutate(f.playerId, 'REMOVE')}>Retirer</AppButton></div></div>) : <p>{q ? 'Aucun ami trouvé.' : 'Aucun ami actif. Retrouvez les joueurs dans l’onglet Joueurs.'}</p>)}
        {tab === 'requests' && (!value ? <p>Chargement des demandes…</p> : (['RECEIVED', 'SENT'] as const).map(direction => <section key={direction}><h2>{direction === 'RECEIVED' ? 'Demandes reçues' : 'Demandes envoyées'}</h2>{value.requests.filter(r => r.direction === direction).length ? value.requests.filter(r => r.direction === direction).map(r => <div className="social-row" key={r.id}>{identity(r.playerId)}<div className="social-row-actions">{direction === 'RECEIVED' ? <><AppButton disabled={pending} onClick={() => void mutate(r.playerId, 'ACCEPT', r.id)}>Accepter</AppButton><AppButton disabled={pending} onClick={() => void mutate(r.playerId, 'REFUSE', r.id)}>Refuser</AppButton></> : <AppButton disabled={pending} onClick={() => void mutate(r.playerId, 'CANCEL', r.id)}>Annuler</AppButton>}</div></div>) : <p>Aucune demande {direction === 'RECEIVED' ? 'reçue' : 'envoyée'}.</p>}</section>))}
        {tab === 'players' && (!result ? <p>Chargement des joueurs…</p> : result.players.length ? result.players.map(p => <div className="social-row" key={p.id}><PlayerIdentity player={p} onOpen={() => onProfile(p.id)} status={p.presence.access === 'ALLOWED' ? presenceLabels[p.presence.data] : undefined} /><div className="social-row-actions">{p.relation === 'NONE' && <AppButton disabled={pending} onClick={() => void mutate(p.id, 'ADD')}>Ajouter</AppButton>}{p.relation === 'RECEIVED' && <AppButton disabled={pending} onClick={() => void mutate(p.id, 'ACCEPT', p.requestId ?? undefined)}>Accepter</AppButton>}{p.relation === 'SENT' && <span>Demande envoyée</span>}{p.relation === 'FRIEND' && <span>Ami</span>}</div></div>) : <p>Aucun joueur trouvé.</p>)}
      </div>
    </ScrollableScreenPanel>
  </div>
}
