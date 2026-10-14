import { useDestinationTab } from '../navigation/destination-context'
import { useTutorialPresentation } from '../tutorial/tutorial-presentation'
import { useEffect, useRef, useState } from 'react'
import type { AppearanceDto } from '../api/types'
import AppearanceChooser from './AppearanceChooser'
import '../social/appearance-layout.css'
import AppButton from '../components/AppButton'
import PlayerAvatar from '../components/PlayerAvatar'
import type { SocialActions } from '../social/types'
import { apiErrorMessage } from '../utils/formatters'
import { normalizeCharacterSearch } from '../characters/character-catalog'

export default function AppearancePanel({ actions, displayName, elementKey, onChanged }: { actions: SocialActions; displayName: string; elementKey: string | null; onChanged: () => Promise<void> }) {
  const panelRef = useRef<HTMLElement>(null)
  const [value, setValue] = useState<AppearanceDto | null>(null)
  const [normalTab, setTab] = useDestinationTab('appearance','AVATAR')
  const presentation = useTutorialPresentation()
  const tab = presentation.active ? presentation.step?.view === 'Personnalisation:titles' ? 'TITLE' : 'AVATAR' : normalTab
  const [chooserTab, setChooserTab] = useState<string | null>(null)
  const chooserRevision = useRef(0)
  const closeChooser = () => { chooserRevision.current += 1; setChooserTab(null) }
  const chooserVisible = tab !== 'BADGE' && (chooserTab === tab || presentation.active && Boolean(presentation.step?.view?.startsWith('Personnalisation:')))
  const pendingRef = useRef(false)
  const [query, setQuery] = useState('')
  const [sort,setSort]=useState<'name'|'date'>('date')
  const [direction,setDirection]=useState<'asc'|'desc'>('desc')
  const [visit,setVisit]=useState<{tab:typeof tab;ids:readonly string[]}>({tab,ids:[]})
  const consultation=useRef(new Set<string>())
  const mounted=useRef(false)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; void actions.appearance().then(next => { if (active) setValue(next) }).catch(reason => { if (active) setError(apiErrorMessage(reason)) }); return () => { active = false } }, [actions])
  useEffect(()=>{
    if(!value||presentation.active||tab !== 'BADGE' && !chooserVisible)return;
    const ids=value.catalog.filter(item=>item.type===tab&&item.owned&&item.isNew&&!consultation.current.has(item.id)&&normalizeCharacterSearch(item.displayName).includes(normalizeCharacterSearch(query.trim()))).map(item=>item.id);
    setVisit(previous=>({tab,ids:previous.tab===tab?[...new Set([...previous.ids,...ids])]:ids}));
    const fresh=ids.filter(id=>!consultation.current.has(id));
    if(!fresh.length||tab==='BADGE'||!actions.consultAppearance)return;
    fresh.forEach(id=>consultation.current.add(id));

    void actions.consultAppearance(tab,fresh).then(()=>{if(mounted.current)setValue(current=>current?{...current,catalog:current.catalog.map(item=>fresh.includes(item.id)?{...item,isNew:false}:item)}:current)}).catch(reason=>{fresh.forEach(id=>consultation.current.delete(id));if(mounted.current)setError(apiErrorMessage(reason))});

  },[value,tab,actions,presentation.active,query,chooserVisible]);
  const equip = async (type: 'AVATAR' | 'TITLE' | 'BADGE', id: string | null) => {
    if (pendingRef.current || presentation.active) return
    pendingRef.current = true
    const opening = chooserRevision.current
    setPending(true); setError('')
    try {
      const confirmed = await actions.equipAppearance(type, id)
      if (!mounted.current) return
      setValue(confirmed)
      await onChanged().catch(() => undefined)
      if (mounted.current && type !== 'BADGE' && opening === chooserRevision.current) closeChooser()
    } catch (reason) { if (mounted.current) setError(apiErrorMessage(reason)) }
    finally { pendingRef.current = false; if (mounted.current) setPending(false) }
  }
  const entries = value?.catalog.filter(item => item.type === tab) ?? []
  const newIds=new Set(visit.tab===tab?visit.ids:entries.filter(item=>item.owned&&item.isNew).map(item=>item.id))
  const visible = entries.filter(item => tab === 'BADGE' || normalizeCharacterSearch(item.displayName).includes(normalizeCharacterSearch(query.trim())))
  const compare=(a:typeof entries[number],b:typeof entries[number])=>{
    const novelty=Number(newIds.has(b.id))-Number(newIds.has(a.id));if(novelty)return novelty;
    if(sort==='date'){
      // Unknown dates remain last in either direction, including locked entries.
      if(!!a.unlockedAt!==!!b.unlockedAt)return a.unlockedAt?-1:1;
      const date=(a.unlockedAt??'').localeCompare(b.unlockedAt??'');if(date)return direction==='asc'?date:-date;
      if(a.levelRequirement!=null&&b.levelRequirement!=null)return b.levelRequirement-a.levelRequirement;
    }
    const name=a.displayName.localeCompare(b.displayName,'fr-FR',{sensitivity:'base'});return (sort==='name'&&direction==='desc'?-name:name)||a.id.localeCompare(b.id);
  }
  const characterEntries = visible.filter(item => item.sourceCharacterId && item.owned).sort(compare)
  const levelEntries = visible.filter(item => item.type === 'TITLE' && item.levelRequirement != null).sort(compare)
  const otherEntries = visible.filter(item => !item.sourceCharacterId && !(item.type === 'TITLE' && item.levelRequirement != null)).sort(compare)
  const renderCard = (item: AppearanceDto['catalog'][number]) => {
    const equipped = (item.type === 'AVATAR' ? value?.equippedAvatarCosmeticId : item.type === 'TITLE' ? value?.equippedTitleCosmeticId : value?.equippedBadgeCosmeticId) === item.id
    return <article className={`appearance-card${item.type === 'TITLE' && item.levelRequirement != null ? ` appearance-level-title title-tier-${item.levelRequirement}${!item.owned ? ' is-locked' : ''}${equipped ? ' is-equipped' : ''}` : ''}${item.sourceCharacterId ? ' appearance-character-card' : ''}`} key={item.id}>{newIds.has(item.id)&&<mark className="appearance-new">Nouveau</mark>}{item.type === 'AVATAR' && (item.visibility === 'MYSTERY' && !item.owned ? <span className="appearance-mystery" aria-hidden="true">?</span> : <PlayerAvatar displayName={item.displayName} elementKey={item.sourceCharacterId ? elementKey : null} avatarAssetPath={item.assetPath} />)}<div><strong className={item.type === 'BADGE' ? 'appearance-badge-symbol' : undefined}>{item.displayName}</strong>{!item.owned && item.condition && <small>{item.condition}</small>}</div><span>{equipped ? 'Équipé' : !item.isActive ? 'Indisponible' : item.owned ? 'Possédé' : 'Verrouillé'}</span>{item.owned && item.isActive && !equipped && <AppButton disabled={pending} onClick={() => void equip(item.type, item.id)}>Équiper</AppButton>}</article>
  }
  const catalogue = value && <>      {tab === 'AVATAR' && <div className="appearance-card"><PlayerAvatar displayName={displayName} elementKey={elementKey} className="mini-avatar" /><span>Avatar élémentaire permanent</span><strong>{value.equippedAvatarCosmeticId === null ? 'Équipé' : 'Disponible'}</strong>{value.equippedAvatarCosmeticId !== null && <AppButton disabled={pending} onClick={() => void equip('AVATAR', null)}>Équiper</AppButton>}</div>}
      {tab === 'TITLE' && <div className="appearance-card"><span>Aucun titre</span><strong>{value.equippedTitleCosmeticId === null ? 'Équipé' : 'Disponible'}</strong>{value.equippedTitleCosmeticId !== null && <AppButton disabled={pending} onClick={() => void equip('TITLE', null)}>Déséquiper</AppButton>}</div>}
      {tab === 'BADGE' && <div className="appearance-card"><span>Aucun badge</span><strong>{!value.equippedBadgeCosmeticId ? 'Équipé' : 'Disponible'}</strong>{value.equippedBadgeCosmeticId && <AppButton disabled={pending} onClick={() => void equip('BADGE', null)}>Déséquiper</AppButton>}</div>}<div className="appearance-controls" hidden={tab === 'BADGE'}><label className="appearance-search">Rechercher <input value={query} onChange={event => setQuery(event.target.value)} /></label><label>Trier par <select aria-label="Tri des cosmétiques" value={sort} onChange={event=>setSort(event.target.value as typeof sort)}><option value="name">Nom</option><option value="date">Date d’obtention</option></select></label><select aria-label="Ordre des cosmétiques" value={direction} onChange={event=>setDirection(event.target.value as typeof direction)}><option value="asc">{sort==='name'?'A → Z':'Plus anciens'}</option><option value="desc">{sort==='name'?'Z → A':'Plus récents'}</option></select></div>
      {characterEntries.length > 0 && <section className="appearance-character-section" aria-label="Avatars de vos personnages"><h3>Avatars de vos personnages</h3><div className="appearance-catalog appearance-character-grid">{characterEntries.map(renderCard)}</div></section>}
      {levelEntries.length > 0 && <section className="appearance-level-section" aria-label="Titres de niveaux"><h3>Titres de niveaux</h3><div className="appearance-catalog">{levelEntries.map(renderCard)}</div></section>}
      {otherEntries.length > 0 && <div className="appearance-catalog">{otherEntries.map(renderCard)}</div>}
      {!entries.length && <p>{tab === 'AVATAR' ? 'Aucun autre avatar disponible.' : 'Aucun titre débloqué.'}</p>}
      {!!entries.length && !visible.length && <p>Aucun cosmétique trouvé.</p>}
  </>
  return <section ref={panelRef} data-tutorial-anchor="appearance-content" data-tutorial-state={!value && !error ? "loading" : undefined} data-business-pending={pending} data-appearance-tab={tab} className="appearance-panel" aria-label="Personnalisation du profil">
    <nav className="activity-inner-tabs appearance-tabs" role="tablist" aria-label="Cosmétiques"><button type="button" role="tab" aria-selected={tab === 'AVATAR'} className={tab === 'AVATAR' ? 'active' : ''} onClick={() => { closeChooser(); setTab('AVATAR') }}>Avatars</button><button type="button" role="tab" aria-selected={tab === 'TITLE'} className={tab === 'TITLE' ? 'active' : ''} onClick={() => { closeChooser(); setTab('TITLE') }}>Titres</button><button type="button" role="tab" aria-selected={tab === 'BADGE'} className={tab === 'BADGE' ? 'active' : ''} onClick={() => { closeChooser(); setTab('BADGE') }}>Badges</button></nav>
    {error && !chooserVisible && <p role="alert">{error}</p>}
    {!value ? <p role="status">Chargement de la personnalisation…</p> : <>
      <div className="appearance-preview"><PlayerAvatar displayName={displayName} elementKey={elementKey} avatarAssetPath={value.avatar.assetPath} className="appearance-preview-avatar" /><div><strong>{value.badgeSymbol && <span aria-hidden="true">{value.badgeSymbol} </span>}{displayName}</strong>{value.title && <span className="profile-equipped-title">{value.title}</span>}<small>{tab === 'BADGE' ? value.badgeSymbol ? 'Badge équipé' : 'Aucun badge' : tab === 'AVATAR' ? value.avatar.kind === 'ELEMENT' ? 'Avatar élémentaire' : value.avatar.kind === 'CUSTOM' ? 'Avatar équipé' : 'Initiale' : value.title ? 'Titre équipé' : 'Aucun titre'}</small></div>{tab !== 'BADGE' && <AppButton variant="primary" className="appearance-choose" onClick={() => { chooserRevision.current += 1; setQuery(''); setSort('date'); setDirection('desc'); setError(''); setChooserTab(tab) }}>Choisir</AppButton>}</div>
      {tab === 'BADGE' ? catalogue : chooserVisible && <AppearanceChooser background={panelRef.current?.closest<HTMLElement>('.scrollable-screen-panel-body')} title={tab === 'AVATAR' ? 'Choisir un avatar' : 'Choisir un titre'} onClose={closeChooser}>{error && <p role="alert">{error}</p>}{catalogue}</AppearanceChooser>}
    </>}
  </section>
}
