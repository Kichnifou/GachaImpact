import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { getGameApiClient } from '../../api/game-api'
import type { AdminCharacter, AdminCharacterFields, AdminPage, AdminPossession } from '../../api/admin-types'
import { elementKeys, type ElementKey } from '../../api/types'
import { apiErrorMessage } from '../../utils/formatters'
import { AdminFeedback, AdminPager, ConfirmAction, useAdminTask } from './AdminUi'
import { CatalogDialog } from './CatalogDialog'
import CatalogPipelinePanel from './CatalogPipelinePanel'

type CharacterIntent = Readonly<{ kind: 'catalog'; characterId: string; characterName: string; isActive: boolean }>
  | Readonly<{ kind: 'possession'; playerId: string; playerName: string; characterId: string; characterName: string; action: 'remove' }>

export default function CharacterAdminPanel({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [section, setSection] = useState<'catalog' | 'possessions' | 'pipeline'>(() => window.location.hash.startsWith('#moderation/candidates/') ? 'pipeline' : 'catalog')
  const [editorOpen, setEditorOpen] = useState(false)
  const deepRequest = useRef(0)
  const [missingAssets, setMissingAssets] = useState(false)
  const [reload, setReload] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('')
  const [elementKey, setElementKey] = useState('')
  const [active, setActive] = useState('')
  const [sort, setSort] = useState('name')
  const [direction, setDirection] = useState('asc')
  const [list, setList] = useState<AdminPage<AdminCharacter> | null>(null)
  const [possessions, setPossessions] = useState<AdminPage<AdminPossession> | null>(null)
  const [selected, setSelected] = useState<AdminCharacter | null>(null)
  const [name, setName] = useState('')
  const [externalKey, setExternalKey] = useState('')
  const [editRarity, setEditRarity] = useState<4 | 5>(5)
  const [editElement, setEditElement] = useState<ElementKey>('pyro')
  const [editActive, setEditActive] = useState(true)
  const [weaponType, setWeaponType] = useState('')
  const [region, setRegion] = useState('')
  const [classKey, setClassKey] = useState('')
  const [displayOrder, setDisplayOrder] = useState('')
  const [candidateSearch, setCandidateSearch] = useState('')
  const [candidates, setCandidates] = useState<AdminCharacter[]>([])
  const [candidateId, setCandidateId] = useState('')
  const [constellations, setConstellations] = useState<Record<string, number>>({})
  const [confirm, setConfirm] = useState<CharacterIntent | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true), [refreshNotice, setRefreshNotice] = useState('')
  const refreshGate = useRef(false)
  const task = useAdminTask(() => { setConstellations({}); setReload(value => value + 1) })
  const refresh = useCallback(() => { if (refreshGate.current) return; refreshGate.current=true; setReload(value => value + 1) }, [])

  useEffect(() => { let live = true; setLoadError('')
    const api = getGameApiClient()
    if (section === 'pipeline') return
    setLoading(true); setRefreshNotice('')
    const promise = section === 'catalog'
      ? api.getAdminCharacters({ page, search, rarity: rarity || undefined, elementKey: elementKey || undefined,
        active: active || undefined, missingAssets: missingAssets || undefined, sort, direction }).then(value => { if (live) setList(value) })
      : api.getAdminPossessions(playerId, page, search, rarity || undefined, elementKey || undefined).then(value => { if (live) setPossessions(value) })
    void promise.then(()=>{if(live&&reload)setRefreshNotice('Résultats enregistrés actualisés.')}).catch(error => { if (live) setLoadError(apiErrorMessage(error)) }).finally(()=>{if(live){setLoading(false);refreshGate.current=false}})
    return () => { live = false }
  }, [section, page, search, rarity, elementKey, active, missingAssets, sort, direction, playerId, reload])

  useEffect(() => { if (section !== 'possessions') return; let live = true
    void getGameApiClient().getAdminCharacters({ page: 1, search: candidateSearch, active: true })
      .then(value => { if (live) setCandidates([...value.entries]) })
      .catch(error => { if (live) setLoadError(apiErrorMessage(error)) })
    return () => { live = false }
  }, [section, candidateSearch, reload])

  const edit = (row: AdminCharacter) => { setEditorOpen(true); setSelected(row); setName(row.name); setExternalKey(row.externalKey)
    setEditRarity(row.rarity); setEditElement(row.elementKey); setEditActive(row.isActive)
    setWeaponType(row.weaponType ?? ''); setRegion(row.region ?? ''); setClassKey(row.classKey ?? ''); setDisplayOrder(row.displayOrder?.toString() ?? '') }
  const resetForm = () => { setSelected(null); setName(''); setExternalKey(''); setEditRarity(5); setEditElement('pyro'); setEditActive(true)
    setWeaponType(''); setRegion(''); setClassKey(''); setDisplayOrder('') }
  const save = (event: FormEvent) => { event.preventDefault()
    const fields: AdminCharacterFields = { name: name.trim(), rarity: editRarity, elementKey: editElement, isActive: editActive,
      weaponType: weaponType.trim() || null, region: region.trim() || null, classKey: classKey.trim() || null,
      displayOrder: displayOrder === '' ? null : Number(displayOrder) }
    const signature = JSON.stringify({ selected: selected?.id, externalKey, ...fields })
    void task.execute(signature, async key => {
      if (selected) await getGameApiClient().updateAdminCharacter(selected.id, { ...fields, idempotencyKey: key })
      else await getGameApiClient().createAdminCharacter({ ...fields, externalKey: externalKey.trim(), idempotencyKey: key })
      resetForm(); setEditorOpen(false)
    })
  }
  const setPresence = async (intent: Extract<CharacterIntent, { kind: 'catalog' }>) => {
    const success = await task.execute(JSON.stringify(intent), key => getGameApiClient().updateAdminCharacter(intent.characterId, { isActive: intent.isActive, idempotencyKey: key }))
    if (success) setConfirm(null)
  }
  const changePossession = (characterId: string, action: 'add' | 'constellation', constellation?: number) => {
    void task.execute(JSON.stringify({ playerId, characterId, action, constellation }), key => getGameApiClient().changeAdminPossession(playerId, characterId, { action, constellation, idempotencyKey: key }))
  }
  const removePossession = async (intent: Extract<CharacterIntent, { kind: 'possession' }>) => {
    const success = await task.execute(JSON.stringify(intent), key => getGameApiClient().changeAdminPossession(intent.playerId, intent.characterId, { action: intent.action, idempotencyKey: key }))
    if (success) setConfirm(null)
  }

  useEffect(() => {
    const openHash = () => {
      const revision = ++deepRequest.current
      const match = /^#moderation\/characters\/([a-f0-9-]{36})$/i.exec(window.location.hash)
      if (match) { setSection('catalog'); void getGameApiClient().getAdminCharacter(match[1]!).then(row => { if (revision === deepRequest.current) edit(row) }).catch(error => { if (revision === deepRequest.current) setLoadError(apiErrorMessage(error)) }) }
      if (window.location.hash.startsWith('#moderation/candidates/')) setSection('pipeline')
    }
    openHash(); window.addEventListener('hashchange', openHash)
    return () => { deepRequest.current++; window.removeEventListener('hashchange', openHash) }
  }, [])

  return <div className="admin-domain" aria-label="Administration des personnages">
    <div className="admin-subtabs"><button type="button" aria-pressed={section === 'catalog'} onClick={() => { setSection('catalog'); setPage(1) }}>Catalogue</button>
      <button type="button" aria-pressed={section === 'pipeline'} onClick={() => setSection('pipeline')}>Imports et candidats</button>
      <button type="button" aria-pressed={section === 'possessions'} onClick={() => { setSection('possessions'); setPage(1) }}>Possessions de {playerName}</button></div>
    <AdminFeedback error={task.error || loadError} notice={task.notice || refreshNotice} />
    {section === 'pipeline' ? <CatalogPipelinePanel initialId={/^#moderation\/candidates\/([a-f0-9-]{36})$/i.exec(window.location.hash)?.[1]} /> : section === 'catalog' ? <>
      <button type="button" onClick={() => { resetForm(); setEditorOpen(true) }}>Ajouter un personnage</button>
      {editorOpen && <CatalogDialog title={selected ? `Modifier ${selected.name}` : 'Ajouter un personnage'} pending={task.pending} onClose={() => setEditorOpen(false)}>
      <section className="admin-editor">
        <AdminFeedback error={task.error} notice={task.notice} />
        <form onSubmit={save}><label>Clé externe<input value={externalKey} disabled={Boolean(selected) || task.pending} onChange={event => setExternalKey(event.target.value)} required /></label>
          <label>Nom<input value={name} onChange={event => setName(event.target.value)} required maxLength={100} /></label>
          <label>Rareté<select value={editRarity} onChange={event => setEditRarity(Number(event.target.value) as 4 | 5)}><option value={4}>4★</option><option value={5}>5★</option></select></label>
          <label>Élément<select value={editElement} onChange={event => setEditElement(event.target.value as ElementKey)}>{elementKeys.map(key => <option key={key}>{key}</option>)}</select></label>
          <label>Arme<input value={weaponType} maxLength={100} onChange={event => setWeaponType(event.target.value)} /></label>
          <label>Région<input value={region} maxLength={100} onChange={event => setRegion(event.target.value)} /></label>
          <label>Classe<input value={classKey} maxLength={100} onChange={event => setClassKey(event.target.value)} /></label>
          <label>Ordre d’affichage<input type="number" min={0} max={100000} value={displayOrder} onChange={event => setDisplayOrder(event.target.value)} /></label>
          {selected && <label><input type="checkbox" checked={editActive} onChange={event => setEditActive(event.target.checked)} /> Actif</label>}
          <div className="catalog-editor-actions"><button type="button" disabled={task.pending} onClick={() => setEditorOpen(false)}>Annuler</button><button type="submit" disabled={task.pending}>Enregistrer</button></div></form>
        <small>{selected ? 'Les données et les images existantes sont conservées. Compléter les images manquantes dans Imports et candidats.' : 'La nouvelle fiche est enregistrée comme candidat. La publication attend les preuves officielles et les images validées, selon les mêmes contrôles que l’import automatique.'}</small></section>
      </CatalogDialog>}
      <section className="panel admin-list"><div className="catalog-toolbar"><h2>Catalogue</h2><div className="admin-filters">
        <input aria-label="Rechercher un personnage" placeholder="Nom ou clé" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} />
        <select aria-label="Rareté" value={rarity} onChange={event => { setRarity(event.target.value); setPage(1) }}><option value="">Toutes raretés</option><option value="4">4★</option><option value="5">5★</option></select>
        <select aria-label="Élément" value={elementKey} onChange={event => { setElementKey(event.target.value); setPage(1) }}><option value="">Tous éléments</option>{elementKeys.map(key => <option key={key}>{key}</option>)}</select>
        <select aria-label="Statut" value={active} onChange={event => { setActive(event.target.value); setPage(1) }}><option value="">Tous</option><option value="true">Actifs</option><option value="false">Inactifs</option></select>
        <label className="character-assets-filter"><input type="checkbox" checked={missingAssets} onChange={event => { setMissingAssets(event.target.checked); setPage(1) }} /> Assets manquants</label>
        <select aria-label="Trier" value={sort} onChange={event => setSort(event.target.value)}><option value="name">Nom</option><option value="rarity">Rareté</option><option value="createdAt">Création</option></select>
        <button type="button" onClick={() => setDirection(value => value === 'asc' ? 'desc' : 'asc')}>{direction === 'asc' ? '↑' : '↓'}</button>
        <button type="button" className="catalog-refresh" disabled={loading} aria-busy={loading} onClick={refresh}>{loading?'Actualisation…':'Actualiser'}</button>
      </div></div>{loading&&<p role="status">Chargement du catalogue…</p>}<div className="admin-scroll-list">{list?.entries.map(row => <article className="admin-list-row" key={row.id}><div><strong>{row.name} · {row.rarity}★</strong>
        <small>{row.externalKey} · {row.elementKey} · {row.isActive ? 'Actif' : 'Inactif'}</small></div>
        <button type="button" onClick={() => edit(row)}>Modifier</button><button type="button" className={row.isActive ? 'danger' : ''} onClick={() => { const intent = { kind: 'catalog' as const, characterId: row.id, characterName: row.name, isActive: !row.isActive }; if (row.isActive) setConfirm(intent); else void setPresence(intent) }}>{row.isActive ? 'Désactiver' : 'Réactiver'}</button></article>)}
        {!list?.entries.length && <p>Aucun personnage.</p>}</div>{list && <AdminPager page={list.page} totalPages={list.totalPages} onPage={setPage} pending={task.pending} />}</section>
    </> : <>
      <section className="panel admin-editor"><h2>Ajouter une possession</h2><input aria-label="Rechercher dans le catalogue actif" placeholder="Chercher un personnage actif" value={candidateSearch} onChange={event => setCandidateSearch(event.target.value)} />
        <select aria-label="Personnage à ajouter" value={candidateId} onChange={event => setCandidateId(event.target.value)}><option value="">Choisir</option>{candidates.map(row => <option key={row.id} value={row.id}>{row.name} · {row.rarity}★</option>)}</select>
        <button type="button" disabled={!candidateId || task.pending} onClick={() => changePossession(candidateId, 'add')}>Ajouter à {playerName}</button></section>
      <section className="panel admin-list"><h2>Possessions</h2><div className="admin-filters"><input aria-label="Rechercher une possession" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Rechercher" />
        <select aria-label="Rareté des possessions" value={rarity} onChange={event => { setRarity(event.target.value); setPage(1) }}><option value="">Toutes raretés</option><option value="4">4★</option><option value="5">5★</option></select>
        <select aria-label="Élément des possessions" value={elementKey} onChange={event => { setElementKey(event.target.value); setPage(1) }}><option value="">Tous éléments</option>{elementKeys.map(key => <option key={key}>{key}</option>)}</select></div>
        <div className="admin-scroll-list">{possessions?.entries.map(row => <article className="admin-list-row" key={row.characterId}><div><strong>{row.character.name} · {row.character.rarity}★</strong>
          <small>{row.character.elementKey} · C{row.constellation} · {row.favorite ? 'Favori · ' : ''}obtenu le {new Date(row.firstObtainedAt).toLocaleDateString('fr-FR')}</small></div>
          <label>Constellation<select value={constellations[row.characterId] ?? row.constellation} onChange={event => setConstellations(value => ({ ...value, [row.characterId]: Number(event.target.value) }))}>{[0, 1, 2, 3, 4, 5, 6].map(value => <option value={value} key={value}>C{value}</option>)}</select></label>
          <button type="button" disabled={task.pending || (constellations[row.characterId] ?? row.constellation) === row.constellation} onClick={() => changePossession(row.characterId, 'constellation', constellations[row.characterId])}>Corriger</button>
          <button type="button" className="danger" disabled={task.pending} onClick={() => setConfirm({ kind: 'possession', playerId, playerName, characterId: row.characterId, characterName: row.character.name, action: 'remove' })}>Retirer</button></article>)}
          {!possessions?.entries.length && <p>Aucune possession.</p>}</div>{possessions && <AdminPager page={possessions.page} totalPages={possessions.totalPages} onPage={setPage} pending={task.pending} />}</section>
    </>}
    {confirm && <ConfirmAction title={confirm.kind === 'catalog' ? `Désactiver ${confirm.characterName} ?` : `Retirer ${confirm.characterName} de ${confirm.playerName} ?`}
      onCancel={() => setConfirm(null)} pending={task.pending} onConfirm={() => {
        if (confirm.kind === 'catalog') void setPresence(confirm)
        else void removePossession(confirm)
      }}>{confirm.kind === 'catalog' ? 'Les possessions et historiques sont conservés. Le personnage sort des futurs pools et votes.' : 'Les équipes et états dépendants doivent être nettoyés avant le retrait. Les historiques de tirages et cosmétiques débloqués sont conservés.'}</ConfirmAction>}
    {section==='possessions'&&<button type="button" className="admin-refresh" disabled={loading} aria-busy={loading} onClick={refresh}>{loading?'Actualisation…':'Actualiser'}</button>}
  </div>
}
