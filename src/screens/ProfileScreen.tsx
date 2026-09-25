import { useEffect, useState, type ReactNode } from 'react'
import AppButton from '../components/AppButton'
import CharacterCard from '../components/CharacterCard'
import CollectionFilters, { type CharacterRarityFilter, type CharacterSortDirection, type CharacterSortKey } from '../components/CollectionFilters'
import InventoryObjectCard from '../components/InventoryObjectCard'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import ScreenHeader from '../components/ScreenHeader'
import GameAssetIcon from '../components/GameAssetIcon'
import MissionProjectionView from '../missions/MissionProjectionView'
import { compareCharacters, normalizeCharacterSearch } from '../characters/character-catalog'
import type { ElementKey, PermanentMissionProjectionDto } from '../api/types'
import { presenceLabels, type Access, type Profile, type SocialActions } from '../social/types'
import { apiErrorMessage, elementLabels, formatResourceAmount } from '../utils/formatters'
import { getElementAssetPath } from '../utils/gameAssets'
import { relationshipContext } from '../social/relationship'
import type { FriendshipController } from '../social/use-friendships'

function Section<T>({ value, children }: { value: Access<T>; children: (data: T) => ReactNode }) {
  return value.access === 'PRIVATE' ? <p className="profile-private">Cette rubrique est privée.</p> : children(value.data)
}
function LastActivity({ value }: { value: Access<string | null> }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(timer) }, [])
  if (value.access === 'PRIVATE') return <p>Dernière activité privée</p>
  if (!value.data) return <p>Aucune activité récente.</p>
  const date = new Date(value.data), minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000))
  const relative = minutes < 1 ? 'À l’instant' : minutes < 60 ? `Il y a ${minutes} min` : minutes < 1440 ? `Il y a ${Math.floor(minutes / 60)} h` : `Il y a ${Math.floor(minutes / 1440)} j`
  return <details className="profile-last-activity"><summary title={date.toLocaleString('fr-FR')}>Dernière activité : {relative}</summary><time dateTime={value.data}>{date.toLocaleString('fr-FR')}</time></details>
}
const tabs = ['Aperçu', 'Team active', 'Box', 'Collection', 'Statistiques', 'Missions'] as const
export default function ProfileScreen({ playerId, ownerPlayerId, actions, controller, onDirectory, onPrivacy, onMessage, onTrade }: { playerId: string; ownerPlayerId: string; actions: SocialActions; controller: FriendshipController; onDirectory: () => void; onPrivacy: () => void; onMessage?: (player: { id: string; displayName: string; elementKey: ElementKey | null }) => void; onTrade?: (player: { id: string; displayName: string }) => void }) {
  const [value, setValue] = useState<Profile | null>(null), [error, setError] = useState(''), [tab, setTab] = useState<typeof tabs[number]>('Aperçu')
  const [missions, setMissions] = useState<Access<PermanentMissionProjectionDto> | null>(null), [missionsError, setMissionsError] = useState(''), [missionsRequest, setMissionsRequest] = useState(0)
  const [missionsTarget, setMissionsTarget] = useState('')
  const [query, setQuery] = useState(''), [rarity, setRarity] = useState<CharacterRarityFilter>('all'), [element, setElement] = useState<ElementKey | null>(null), [sortKey, setSortKey] = useState<CharacterSortKey>('name'), [direction, setDirection] = useState<CharacterSortDirection>('asc')
  const clearFeedback = controller.clearFeedback
  useEffect(() => () => clearFeedback(), [clearFeedback])
  useEffect(() => {
    let active = true, timer: number | undefined
    const load = async () => {
      try { const next = await actions.profile(playerId); if (active) { setValue(next); setError('') } }
      catch (reason) { if (active) { setValue(null); setError(apiErrorMessage(reason)) } }
      finally { if (active) timer = window.setTimeout(() => void load(), 30_000) }
    }
    void load(); return () => { active = false; window.clearTimeout(timer) }
  }, [actions, playerId])
  useEffect(() => {
    if (tab !== 'Missions') return
    let active = true
    const load = playerId === ownerPlayerId
      ? actions.ownMissions().then(data => ({ access: 'ALLOWED' as const, data }))
      : actions.playerMissions(playerId)
    void load.then(next => { if (active) { setMissions(next); setMissionsError(''); setMissionsTarget(playerId) } }).catch(reason => { if (active) { setMissions(null); setMissionsError(apiErrorMessage(reason)); setMissionsTarget(playerId) } })
    return () => { active = false }
  }, [actions, missionsRequest, ownerPlayerId, playerId, tab])
  const currentMissions = missionsTarget === playerId ? missions : null
  const currentMissionsError = missionsTarget === playerId ? missionsError : ''
  const team = value && <Section value={value.team}>{team => team ? <div className="character-grid">{team.slots.map(slot => slot.character ? <CharacterCard key={slot.position} character={slot.character} footer={<p className="profile-character-meta">C{slot.character.constellation}</p>} /> : <div key={slot.position} className="profile-empty-slot">Emplacement {slot.position} vide</div>)}</div> : <p>Aucune Team active.</p>}</Section>
  const relation = relationshipContext(controller.value, ownerPlayerId, playerId), feedbackScope = `profile:${playerId}`
  const socialActions = relation.state === 'SELF' ? null : <div className="profile-social-actions">
    {relation.state === 'LOADING' && <AppButton disabled>Chargement…</AppButton>}
    {relation.state === 'NONE' && <AppButton disabled={controller.pending} onClick={() => void controller.mutate(playerId, 'ADD', undefined, feedbackScope)}>Ajouter</AppButton>}
    {relation.state === 'SENT' && <AppButton disabled>Demande envoyée</AppButton>}
    {relation.state === 'RECEIVED' && <><AppButton disabled={controller.pending} onClick={() => void controller.mutate(playerId, 'ACCEPT', relation.requestId, feedbackScope)}>Accepter</AppButton><AppButton disabled={controller.pending} onClick={() => void controller.mutate(playerId, 'REFUSE', relation.requestId, feedbackScope)}>Refuser</AppButton></>}
    {relation.state === 'FRIEND' && <AppButton disabled={controller.pending || !relation.friend?.canSend} onClick={() => void controller.mutate(playerId, 'HEART', undefined, feedbackScope)}>{relation.friend?.heartSent ? 'Cœur envoyé ✓' : 'Envoyer un cœur'}</AppButton>}
    {playerId !== ownerPlayerId && value && onMessage && <AppButton onClick={() => onMessage({ id: playerId, displayName: value.player.displayName, elementKey: value.player.elementKey })}>Message privé</AppButton>}
    {playerId !== ownerPlayerId && value && onTrade && <AppButton onClick={() => onTrade({ id: playerId, displayName: value.player.displayName })}>Échanger</AppButton>}
    {relation.state === 'FRIEND' && <AppButton variant="danger" disabled={controller.pending} onClick={() => void controller.mutate(playerId, 'REMOVE', undefined, feedbackScope)}>Retirer</AppButton>}
  </div>
  return <div className="screen-content profile-screen long-screen-layout">
    <ScreenHeader eyebrow="Social" title={value?.player.displayName ?? 'Profil'} />
    <ScrollableScreenPanel className="profile-frame" fixed={<><div className="profile-navigation"><AppButton onClick={onDirectory}>Joueurs</AppButton>{value?.own && <AppButton onClick={onPrivacy}>Confidentialité</AppButton>}</div><nav className="secondary-navigation" aria-label="Rubriques du profil">{tabs.map(t => <AppButton key={t} className={tab === t ? 'active' : ''} aria-pressed={tab === t} onClick={() => { controller.clearFeedback(); if (t === 'Missions' && tab !== 'Missions') setMissionsTarget(''); setTab(t) }}>{t}</AppButton>)}</nav>{tab === 'Box' && value?.box.access === 'ALLOWED' && <CollectionFilters placeholder="Rechercher un personnage…" query={query} rarity={rarity} element={element} sortKey={sortKey} direction={direction} onQueryChange={setQuery} onRarityChange={setRarity} onElementChange={setElement} onSortKeyChange={setSortKey} onDirectionChange={() => setDirection(direction === 'asc' ? 'desc' : 'asc')} />}</>}>
      {error ? <p role="alert">{error}</p> : !value ? <p role="status">Chargement du profil…</p> : <>
        {tab === 'Aperçu' && <div className="profile-overview"><div className="profile-identity"><span className={`mini-avatar ${value.player.elementKey ?? ''}`} aria-hidden="true">{value.player.displayName.slice(0, 1).toUpperCase()}</span><div className="profile-identity-copy"><div className="profile-name-line"><h2>{value.player.displayName}</h2><span className="profile-element" role="img" aria-label={value.player.elementKey ? `Élément ${elementLabels[value.player.elementKey]}` : 'Élément non choisi'}>{value.player.elementKey && <GameAssetIcon src={getElementAssetPath(value.player.elementKey)} fallback="✦" />}</span></div><p className="profile-presence">{value.presence.access === 'ALLOWED' ? <><span className={`presence-dot presence-${value.presence.data.toLowerCase()}`} aria-hidden="true" />{presenceLabels[value.presence.data]}</> : 'Présence privée'}</p><p>Niveau {value.player.level}</p>{socialActions}<div className="social-feedback" role="status">{controller.feedbackScope === feedbackScope ? controller.feedback : ''}</div></div></div><div className="profile-activity-section"><LastActivity value={value.lastActivity} /></div></div>}
        {tab === 'Team active' && team}
        {tab === 'Box' && <Section value={value.box}>{characters => {
          const filtered = characters.map(c => ({ ...c, classKey: null })).filter(c => normalizeCharacterSearch(c.name).includes(normalizeCharacterSearch(query)) && (rarity === 'all' || c.rarity === rarity) && (!element || c.elementKey === element)).sort((a, b) => (direction === 'asc' ? 1 : -1) * compareCharacters(a, b, sortKey))
          return <><div className="character-grid">{filtered.map(c => <CharacterCard key={c.id} character={c} footer={<p className="profile-character-meta">C{c.constellation} · {c.copies} copies</p>} />)}</div>{!filtered.length && <p>{characters.length ? 'Aucun personnage ne correspond aux filtres.' : 'Aucun personnage possédé.'}</p>}</>
        }}</Section>}
        {tab === 'Collection' && <Section value={value.collection}>{items => <><div className="inventory-grid">{items.map(item => <InventoryObjectCard key={item.id} item={item} />)}</div>{!items.length && <p>Collection encore vide.</p>}</>}</Section>}
        {tab === 'Statistiques' && <Section value={value.statistics}>{stats => <dl className="profile-statistics">{([['totalXp', 'XP'], ['totalPulls', 'Invocations'], ['totalFiveStars', '5★ obtenus'], ['totalFourStars', '4★ obtenus'], ['combatWins', 'Victoires Combat'], ['expeditionsCompleted', 'Expéditions terminées']] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{stats[key] === null ? 'Non disponible' : formatResourceAmount(stats[key])}</dd></div>)}</dl>}</Section>}
        {tab === 'Missions' && (currentMissionsError
          ? <div className="missions-state" role="alert"><strong>Missions indisponibles</strong><p>{currentMissionsError}</p><button type="button" className="small-primary-button" onClick={() => { setMissionsTarget(''); setMissionsRequest(current => current + 1) }}>Réessayer</button></div>
          : !currentMissions ? <p role="status">Chargement des Missions…</p>
          : <Section value={currentMissions}>{projection => <MissionProjectionView key={playerId} value={projection} />}</Section>)}
      </>}
    </ScrollableScreenPanel>
  </div>
}
