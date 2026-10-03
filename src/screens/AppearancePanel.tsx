import { useTutorialPresentation } from '../tutorial/tutorial-presentation'
import { useEffect, useState } from 'react'
import type { AppearanceDto } from '../api/types'
import AppButton from '../components/AppButton'
import PlayerAvatar from '../components/PlayerAvatar'
import type { SocialActions } from '../social/types'
import { apiErrorMessage } from '../utils/formatters'

export default function AppearancePanel({ actions, displayName, elementKey, onChanged }: { actions: SocialActions; displayName: string; elementKey: string | null; onChanged: () => Promise<void> }) {
  const [value, setValue] = useState<AppearanceDto | null>(null)
  const [normalTab, setTab] = useState<'AVATAR' | 'TITLE'>('AVATAR')
  const presentation = useTutorialPresentation()
  const tab = presentation.active ? presentation.step?.view === 'Personnalisation:titles' ? 'TITLE' : 'AVATAR' : normalTab
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; void actions.appearance().then(next => { if (active) setValue(next) }).catch(reason => { if (active) setError(apiErrorMessage(reason)) }); return () => { active = false } }, [actions])
  const equip = async (type: 'AVATAR' | 'TITLE', id: string | null) => {
    setPending(true); setError('')
    try {
      const confirmed = await actions.equipAppearance(type, id)
      setValue(confirmed)
      await onChanged().catch(() => undefined)
    } catch (reason) { setError(apiErrorMessage(reason)) }
    finally { setPending(false) }
  }
  const entries = value?.catalog.filter(item => item.type === tab) ?? []
  const visible = entries.filter(item => item.displayName.toLocaleLowerCase('fr-FR').includes(query.trim().toLocaleLowerCase('fr-FR')))
  const characterEntries = visible.filter(item => item.sourceCharacterId && item.owned).sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr-FR') || a.id.localeCompare(b.id))
  const levelEntries = visible.filter(item => item.type === 'TITLE' && item.levelRequirement != null).sort((a, b) => b.levelRequirement! - a.levelRequirement!)
  const otherEntries = visible.filter(item => !item.sourceCharacterId && !(item.type === 'TITLE' && item.levelRequirement != null))
  const renderCard = (item: AppearanceDto['catalog'][number]) => {
    const equipped = (item.type === 'AVATAR' ? value?.equippedAvatarCosmeticId : value?.equippedTitleCosmeticId) === item.id
    return <article className={`appearance-card${item.type === 'TITLE' && item.levelRequirement != null ? ` appearance-level-title title-tier-${item.levelRequirement}${!item.owned ? ' is-locked' : ''}${equipped ? ' is-equipped' : ''}` : ''}${item.sourceCharacterId ? ' appearance-character-card' : ''}`} key={item.id}>{item.type === 'AVATAR' && (item.visibility === 'MYSTERY' && !item.owned ? <span className="appearance-mystery" aria-hidden="true">?</span> : <PlayerAvatar displayName={item.displayName} elementKey={item.sourceCharacterId ? elementKey : null} avatarAssetPath={item.assetPath} />)}<div><strong>{item.displayName}</strong>{!item.owned && item.condition && <small>{item.condition}</small>}</div><span>{equipped ? 'Équipé' : !item.isActive ? 'Indisponible' : item.owned ? 'Possédé' : 'Verrouillé'}</span>{item.owned && item.isActive && !equipped && <AppButton disabled={pending} onClick={() => void equip(item.type, item.id)}>Équiper</AppButton>}</article>
  }
  return <section data-tutorial-anchor="appearance-content" data-tutorial-state={!value && !error ? "loading" : undefined} data-business-pending={pending} className="appearance-panel" aria-label="Personnalisation du profil">
    <nav className="activity-inner-tabs appearance-tabs" role="tablist" aria-label="Cosmétiques"><button type="button" role="tab" aria-selected={tab === 'AVATAR'} className={tab === 'AVATAR' ? 'active' : ''} onClick={() => { setTab('AVATAR'); setQuery('') }}>Avatars</button><button type="button" role="tab" aria-selected={tab === 'TITLE'} className={tab === 'TITLE' ? 'active' : ''} onClick={() => { setTab('TITLE'); setQuery('') }}>Titres</button></nav>
    {error && <p role="alert">{error}</p>}
    {!value ? <p role="status">Chargement de la personnalisation…</p> : <>
      <div className="appearance-preview"><PlayerAvatar displayName={displayName} elementKey={elementKey} avatarAssetPath={value.avatar.assetPath} className="appearance-preview-avatar" /><div><strong>{displayName}</strong>{value.title && <span className="profile-equipped-title">{value.title}</span>}<small>{tab === 'AVATAR' ? value.avatar.kind === 'ELEMENT' ? 'Avatar élémentaire' : value.avatar.kind === 'CUSTOM' ? 'Avatar équipé' : 'Initiale' : value.title ? 'Titre équipé' : 'Aucun titre'}</small></div></div>
      {tab === 'AVATAR' && <div className="appearance-card"><PlayerAvatar displayName={displayName} elementKey={elementKey} className="mini-avatar" /><span>Avatar élémentaire permanent</span><strong>{value.equippedAvatarCosmeticId === null ? 'Équipé' : 'Disponible'}</strong>{value.equippedAvatarCosmeticId !== null && <AppButton disabled={pending} onClick={() => void equip('AVATAR', null)}>Équiper</AppButton>}</div>}
      {tab === 'TITLE' && <div className="appearance-card"><span>Aucun titre</span><strong>{value.equippedTitleCosmeticId === null ? 'Équipé' : 'Disponible'}</strong>{value.equippedTitleCosmeticId !== null && <AppButton disabled={pending} onClick={() => void equip('TITLE', null)}>Déséquiper</AppButton>}</div>}
      {entries.length >= 8 && <label className="appearance-search">Rechercher <input value={query} onChange={event => setQuery(event.target.value)} /></label>}
      {characterEntries.length > 0 && <section className="appearance-character-section" aria-label="Avatars de vos personnages"><h3>Avatars de vos personnages</h3><div className="appearance-catalog appearance-character-grid">{characterEntries.map(renderCard)}</div></section>}
      {levelEntries.length > 0 && <section className="appearance-level-section" aria-label="Titres de niveaux"><h3>Titres de niveaux</h3><div className="appearance-catalog">{levelEntries.map(renderCard)}</div></section>}
      {otherEntries.length > 0 && <div className="appearance-catalog">{otherEntries.map(renderCard)}</div>}
      {!entries.length && <p>{tab === 'AVATAR' ? 'Aucun autre avatar disponible.' : 'Aucun titre débloqué.'}</p>}
      {!!entries.length && !visible.length && <p>Aucun cosmétique trouvé.</p>}
    </>}
  </section>
}
