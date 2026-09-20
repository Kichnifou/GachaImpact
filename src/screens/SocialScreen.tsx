import { useEffect, useState } from 'react'
import { elementKeys, type ElementKey } from '../api/types'
import AppButton from '../components/AppButton'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import PlayerIdentity from '../social/PlayerIdentity'
import { presenceLabels, type DirectoryPage, type SocialActions, type PresenceStatus, type FriendSort, type RelationshipFilter, type RelationshipState } from '../social/types'
import type { FriendshipController } from '../social/use-friendships'
import { apiErrorMessage, elementLabels } from '../utils/formatters'
import { normalizeCharacterSearch } from '../characters/character-catalog'

export type SocialTab = 'friends' | 'requests' | 'players'
const relationLabels: Record<RelationshipFilter, string> = { ALL: 'Toutes les relations', SELF: 'Moi', FRIEND: 'Amis', SENT: 'Demandes envoyées', RECEIVED: 'À accepter', NONE: 'À ajouter' }

function RelationAction({ relation, pending, onAction }: { relation: RelationshipState; pending: boolean; onAction: () => void }) {
  if (relation === 'NONE') return <AppButton disabled={pending} onClick={onAction}>Ajouter</AppButton>
  if (relation === 'RECEIVED') return <AppButton disabled={pending} onClick={onAction}>Accepter</AppButton>
  return <AppButton disabled>{relation === 'SELF' ? 'Toi' : relation === 'SENT' ? 'Envoyée' : 'Ami'}</AppButton>
}

export default function SocialScreen({ actions, onProfile, controller, initialTab = 'friends', selectedTab, onTabChange }: { actions: SocialActions; onProfile: (id: string) => void; controller: FriendshipController; initialTab?: SocialTab; selectedTab?: SocialTab; onTabChange?: (tab: SocialTab) => void }) {
  const [localTab, setLocalTab] = useState<SocialTab>(initialTab)
  const tab = selectedTab ?? localTab
  const [q, setQ] = useState(''), [element, setElement] = useState<ElementKey | undefined>(), [status, setStatus] = useState<PresenceStatus | undefined>(), [relation, setRelation] = useState<RelationshipFilter>('ALL'), [page, setPage] = useState(1)
  const [result, setResult] = useState<DirectoryPage | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const { value, pending, refreshing, mutate, clearFeedback } = controller
  const scope = `social:${tab}`
  useEffect(() => () => clearFeedback(), [clearFeedback])
  const selectTab = (next: SocialTab) => { clearFeedback(); setLocalTab(next); onTabChange?.(next); setQ(''); setRelation('ALL'); setPage(1) }
  useEffect(() => {
    if (tab !== 'players') return
    let active = true, timer: number | undefined
    const load = async () => {
      setLoading(true)
      try { const next = await actions.directory({ q, element, status, relation: relation === 'ALL' ? undefined : relation, page }); if (active) { setResult(next); setError('') } }
      catch (reason) { if (active) setError(apiErrorMessage(reason)) }
      finally { if (active) { setLoading(false); timer = window.setTimeout(() => void load(), 30_000) } }
    }
    void load(); return () => { active = false; window.clearTimeout(timer) }
  }, [actions, q, element, status, relation, page, tab, value])
  const change = (run: () => void) => { clearFeedback(); setPage(1); run() }
  const identities = new Map(value?.players.map(player => [player.id, player]))
  const friends = (value?.friends ?? []).filter(friend => normalizeCharacterSearch(identities.get(friend.playerId)?.displayName ?? '').includes(normalizeCharacterSearch(q))).sort((a, b) => {
    const ap = identities.get(a.playerId), bp = identities.get(b.playerId)
    const group = (player: typeof ap) => player?.presence.access !== 'ALLOWED' ? 2 : player.presence.data === 'OFFLINE' ? 1 : 0
    const order = value?.sort === 'level' ? b.level - a.level : value?.sort === 'heart' ? Number(b.canSend) - Number(a.canSend) : value?.sort === 'presence' ? group(ap) - group(bp) : 0
    return order || (ap?.displayName ?? '').localeCompare(bp?.displayName ?? '', 'fr', { sensitivity: 'base' }) || a.playerId.localeCompare(b.playerId)
  })
  const identity = (id: string) => { const player = identities.get(id); return player ? <PlayerIdentity player={player} onOpen={() => onProfile(id)} status={player.presence.access === 'ALLOWED' ? presenceLabels[player.presence.data] : undefined} /> : <span>Joueur indisponible</span> }
  const requests = (value?.requests ?? []).filter(request => relation === 'ALL' || request.direction === relation)
  return <div className="screen-content social-screen long-screen-layout">
    <ScreenHeader eyebrow="Communauté" title="Social" />
    <ScrollableScreenPanel className="social-frame" fixed={<>
      <nav className="secondary-navigation social-tabs" aria-label="Rubriques Social">{([['friends', 'Amis'], ['requests', 'Demandes'], ['players', 'Joueurs']] as const).map(([id, label]) => <AppButton key={id} className={tab === id ? 'active' : ''} aria-pressed={tab === id} onClick={() => selectTab(id)}>{label}</AppButton>)}</nav>
      {tab !== 'requests' && <div className="moderation-browser-filters social-filters">
        <label><span>Rechercher</span><input type="search" value={q} placeholder="Pseudo du joueur…" onChange={event => change(() => setQ(event.target.value))} /></label>
        {tab === 'players' ? <><label><span>Élément</span><select value={element ?? ''} onChange={event => change(() => setElement(event.target.value ? event.target.value as ElementKey : undefined))}><option value="">Tous</option>{elementKeys.map(key => <option key={key} value={key}>{elementLabels[key]}</option>)}</select></label><label><span>Statut</span><select value={status ?? ''} onChange={event => change(() => setStatus(event.target.value ? event.target.value as PresenceStatus : undefined))}><option value="">Tous</option>{Object.entries(presenceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><span>Relation</span><select value={relation} onChange={event => change(() => setRelation(event.target.value as RelationshipFilter))}>{Object.entries(relationLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></> : <label><span>Trier les amis</span><select value={value?.sort ?? 'presence'} disabled={pending || !value} onChange={event => { clearFeedback(); void controller.saveSort(event.target.value as FriendSort) }}><option value="presence">Présence</option><option value="name">Alphabétique</option><option value="level">Niveau d’amitié</option><option value="heart">Cœur disponible</option></select></label>}
      </div>}
      {tab === 'requests' && <div className="moderation-browser-filters social-filters"><label><span>Relation</span><select value={relation} onChange={event => change(() => setRelation(event.target.value as RelationshipFilter))}><option value="ALL">Toutes les demandes</option><option value="RECEIVED">À accepter</option><option value="SENT">Envoyées</option></select></label></div>}
      {tab === 'friends' && <div className="social-bulk-action"><AppButton className="social-bulk-button" disabled={pending || !value?.summary.available} onClick={() => void mutate('all', 'HEART', undefined, scope)}>Envoyer des cœurs</AppButton></div>}
      <div className="social-feedback" role="status">{pending ? 'Enregistrement…' : controller.feedbackScope === scope ? controller.feedback : ''}</div>
      {(controller.error || error) && <p role="alert">{controller.error || error}</p>}
    </>} footer={tab === 'players' ? <div className="social-pagination"><AppButton disabled={loading || (result?.page ?? page) <= 1} onClick={() => setPage((result?.page ?? page) - 1)}>Précédent</AppButton><span>Page {result?.page ?? page} / {result?.totalPages ?? 1}</span><AppButton disabled={loading || !result || result.page >= result.totalPages} onClick={() => setPage((result?.page ?? page) + 1)}>Suivant</AppButton></div> : undefined}>
      <div className="social-player-list" aria-busy={pending || loading}>
        {tab === 'friends' && (!value ? <p>Chargement des amis…</p> : friends.length ? friends.map(friend => <div className="social-row" key={friend.id}><div className="social-friend-main">{identity(friend.playerId)}<p className="friendship-detail">{friend.tier} · Niveau {friend.level} · {friend.totalHearts} cœur(s)</p></div><div className="social-row-actions"><AppButton disabled={pending || !friend.canSend} onClick={() => void mutate(friend.playerId, 'HEART', undefined, scope)}>{friend.heartSent ? 'Cœur envoyé ✓' : 'Envoyer un cœur'}</AppButton><AppButton variant="danger" disabled={pending} onClick={() => void mutate(friend.playerId, 'REMOVE', undefined, scope)}>Retirer</AppButton></div></div>) : <p>{q ? 'Aucun ami trouvé.' : 'Aucun ami actif. Retrouvez les joueurs dans l’onglet Joueurs.'}</p>)}
        {tab === 'requests' && (!value || (refreshing && !requests.length) ? <p>Chargement des demandes…</p> : requests.length ? [...requests].sort((a, b) => Number(b.direction === 'RECEIVED') - Number(a.direction === 'RECEIVED')).map(request => <div className={`social-row ${request.direction === 'RECEIVED' ? 'social-row-attention' : ''}`} key={request.id}>{identity(request.playerId)}<div className="social-row-actions">{request.direction === 'RECEIVED' ? <><AppButton disabled={pending} onClick={() => void mutate(request.playerId, 'ACCEPT', request.id, scope)}>Accepter</AppButton><AppButton disabled={pending} onClick={() => void mutate(request.playerId, 'REFUSE', request.id, scope)}>Refuser</AppButton></> : <AppButton disabled={pending} onClick={() => void mutate(request.playerId, 'CANCEL', request.id, scope)}>Annuler</AppButton>}</div></div>) : <p>Aucune demande pour ce filtre.</p>)}
        {tab === 'players' && (!result ? <p>Chargement des joueurs…</p> : result.players.length ? result.players.map(player => <div className={`social-row ${player.relation === 'RECEIVED' ? 'social-row-attention' : ''}`} key={player.id}><PlayerIdentity player={player} onOpen={() => onProfile(player.id)} status={player.presence.access === 'ALLOWED' ? presenceLabels[player.presence.data] : undefined} /><div className="social-row-actions"><RelationAction relation={player.relation} pending={pending} onAction={() => void mutate(player.id, player.relation === 'RECEIVED' ? 'ACCEPT' : 'ADD', player.requestId ?? undefined, scope)} /></div></div>) : <p>Aucun joueur trouvé.</p>)}
      </div>
    </ScrollableScreenPanel>
  </div>
}
