import { useEffect, useState } from 'react'
import type { AppearanceDto } from '../api/types'
import AppButton from '../components/AppButton'
import PlayerAvatar from '../components/PlayerAvatar'
import type { SocialActions } from '../social/types'
import { apiErrorMessage } from '../utils/formatters'

export default function AppearancePanel({ actions, displayName, elementKey, onChanged }: { actions: SocialActions; displayName: string; elementKey: string | null; onChanged: () => Promise<void> }) {
  const [value, setValue] = useState<AppearanceDto | null>(null)
  const [tab, setTab] = useState<'AVATAR' | 'TITLE'>('AVATAR')
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
  return <section className="appearance-panel" aria-label="Personnalisation du profil">
    <nav className="activity-inner-tabs" role="tablist" aria-label="Cosmétiques"><button type="button" role="tab" aria-selected={tab === 'AVATAR'} className={tab === 'AVATAR' ? 'active' : ''} onClick={() => { setTab('AVATAR'); setQuery('') }}>Avatars</button><button type="button" role="tab" aria-selected={tab === 'TITLE'} className={tab === 'TITLE' ? 'active' : ''} onClick={() => { setTab('TITLE'); setQuery('') }}>Titres</button></nav>
    {error && <p role="alert">{error}</p>}
    {!value ? <p role="status">Chargement de la personnalisation…</p> : <>
      <div className="appearance-preview"><PlayerAvatar displayName={displayName} elementKey={elementKey} avatarAssetPath={value.avatar.assetPath} className="appearance-preview-avatar" /><div><strong>{displayName}</strong>{value.title && <span className="profile-equipped-title">{value.title}</span>}<small>{tab === 'AVATAR' ? value.avatar.kind === 'ELEMENT' ? 'Avatar élémentaire' : value.avatar.kind === 'CUSTOM' ? 'Avatar équipé' : 'Initiale' : value.title ?? 'Aucun titre'}</small></div></div>
      {tab === 'AVATAR' && <div className="appearance-card"><PlayerAvatar displayName={displayName} elementKey={elementKey} className="mini-avatar" /><span>Avatar élémentaire permanent</span><strong>{value.equippedAvatarCosmeticId === null ? 'Équipé' : 'Disponible'}</strong>{value.equippedAvatarCosmeticId !== null && <AppButton disabled={pending} onClick={() => void equip('AVATAR', null)}>Équiper</AppButton>}</div>}
      {tab === 'TITLE' && <div className="appearance-card"><span>Aucun titre</span><strong>{value.equippedTitleCosmeticId === null ? 'Équipé' : 'Disponible'}</strong>{value.equippedTitleCosmeticId !== null && <AppButton disabled={pending} onClick={() => void equip('TITLE', null)}>Déséquiper</AppButton>}</div>}
      {entries.length >= 8 && <label className="appearance-search">Rechercher <input value={query} onChange={event => setQuery(event.target.value)} /></label>}
      {visible.length > 0 && <div className="appearance-catalog">{visible.map(item => {
        const equipped = (item.type === 'AVATAR' ? value.equippedAvatarCosmeticId : value.equippedTitleCosmeticId) === item.id
        return <article className="appearance-card" key={item.id}>{item.type === 'AVATAR' && (item.visibility === 'MYSTERY' && !item.owned ? <span className="appearance-mystery" aria-hidden="true">?</span> : <PlayerAvatar displayName={item.displayName} elementKey={null} avatarAssetPath={item.assetPath} />)}<div><strong>{item.displayName}</strong>{!item.owned && item.condition && <small>{item.condition}</small>}</div><span>{equipped ? 'Équipé' : !item.isActive ? 'Indisponible' : item.owned ? 'Possédé' : 'Verrouillé'}</span>{item.owned && item.isActive && !equipped && <AppButton disabled={pending} onClick={() => void equip(item.type, item.id)}>Équiper</AppButton>}</article>
      })}</div>}
      {!entries.length && <p>{tab === 'AVATAR' ? 'Aucun autre avatar disponible.' : 'Aucun titre débloqué.'}</p>}
      {!!entries.length && !visible.length && <p>Aucun cosmétique trouvé.</p>}
    </>}
  </section>
}
