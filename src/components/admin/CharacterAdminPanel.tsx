import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getGameApiClient } from '../../api/game-api'
import type { AdminCharacter, AdminCharacterFields, AdminPage, AdminPossession } from '../../api/admin-types'
import { elementKeys, type ElementKey } from '../../api/types'
import { apiErrorMessage } from '../../utils/formatters'
import { AdminFeedback, AdminPager, ConfirmAction, useAdminTask } from './AdminUi'

type CharacterIntent = Readonly<{ kind: 'catalog'; characterId: string; characterName: string; isActive: boolean }>
  | Readonly<{ kind: 'possession'; playerId: string; playerName: string; characterId: string; characterName: string; action: 'remove' }>

export default function CharacterAdminPanel({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [section, setSection] = useState<'catalog' | 'possessions'>('catalog')
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
  const task = useAdminTask(() => { setConstellations({}); setReload(value => value + 1) })
  const refresh = useCallback(() => setReload(value => value + 1), [])

  useEffect(() => { let live = true; setLoadError('')
    const api = getGameApiClient()
    const promise = section === 'catalog'
      ? api.getAdminCharacters({ page, search, rarity: rarity || undefined, elementKey: elementKey || undefined,
        active: active || undefined, sort, direction }).then(value => { if (live) setList(value) })
      : api.getAdminPossessions(playerId, page, search, rarity || undefined, elementKey || undefined).then(value => { if (live) setPossessions(value) })
    void promise.catch(error => { if (live) setLoadError(apiErrorMessage(error)) })
    return () => { live = false }
  }, [section, page, search, rarity, elementKey, active, sort, direction, playerId, reload])

  useEffect(() => { if (section !== 'possessions') return; let live = true
    void getGameApiClient().getAdminCharacters({ page: 1, search: candidateSearch, active: true })
      .then(value => { if (live) setCandidates([...value.entries]) })
      .catch(error => { if (live) setLoadError(apiErrorMessage(error)) })
    return () => { live = false }
  }, [section, candidateSearch, reload])

  const edit = (row: AdminCharacter) => { setSelected(row); setName(row.name); setExternalKey(row.externalKey)
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
      resetForm()
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

  return <div className="admin-domain" aria-label="Administration des personnages">
    <div className="admin-subtabs"><button type="button" aria-pressed={section === 'catalog'} onClick={() => { setSection('catalog'); setPage(1) }}>Catalogue</button>
      <button type="button" aria-pressed={section === 'possessions'} onClick={() => { setSection('possessions'); setPage(1) }}>Possessions de {playerName}</button></div>
    <AdminFeedback error={task.error || loadError} notice={task.notice} />
    {section === 'catalog' ? <>
      <section className="panel admin-editor"><h2>{selected ? `Modifier ${selected.name}` : 'Ajouter un personnage'}</h2>
        <form onSubmit={save}><label>Clé externe<input value={externalKey} disabled={Boolean(selected) || task.pending} onChange={event => setExternalKey(event.target.value)} required /></label>
          <label>Nom<input value={name} onChange={event => setName(event.target.value)} required maxLength={100} /></label>
          <label>Rareté<select value={editRarity} onChange={event => setEditRarity(Number(event.target.value) as 4 | 5)}><option value={4}>4★</option><option value={5}>5★</option></select></label>
          <label>Élément<select value={editElement} onChange={event => setEditElement(event.target.value as ElementKey)}>{elementKeys.map(key => <option key={key}>{key}</option>)}</select></label>
          <label>Arme<input value={weaponType} maxLength={100} onChange={event => setWeaponType(event.target.value)} /></label>
          <label>Région<input value={region} maxLength={100} onChange={event => setRegion(event.target.value)} /></label>
          <label>Classe<input value={classKey} maxLength={100} onChange={event => setClassKey(event.target.value)} /></label>
          <label>Ordre d’affichage<input type="number" min={0} max={100000} value={displayOrder} onChange={event => setDisplayOrder(event.target.value)} /></label>
          <label><input type="checkbox" checked={editActive} onChange={event => setEditActive(event.target.checked)} /> Actif</label>
          <button type="submit" disabled={task.pending}>Enregistrer</button>{selected && <button type="button" onClick={resetForm}>Annuler</button>}</form>
        <small>Les images existantes sont conservées. L’import autonome d’assets est prévu dans un autre lot.</small></section>
      <section className="panel admin-list"><h2>Catalogue</h2><div className="admin-filters">
        <input aria-label="Rechercher un personnage" placeholder="Nom ou clé" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} />
        <select aria-label="Rareté" value={rarity} onChange={event => { setRarity(event.target.value); setPage(1) }}><option value="">Toutes raretés</option><option value="4">4★</option><option value="5">5★</option></select>
        <select aria-label="Élément" value={elementKey} onChange={event => { setElementKey(event.target.value); setPage(1) }}><option value="">Tous éléments</option>{elementKeys.map(key => <option key={key}>{key}</option>)}</select>
        <select aria-label="Statut" value={active} onChange={event => { setActive(event.target.value); setPage(1) }}><option value="">Tous</option><option value="true">Actifs</option><option value="false">Inactifs</option></select>
        <select aria-label="Trier" value={sort} onChange={event => setSort(event.target.value)}><option value="name">Nom</option><option value="rarity">Rareté</option><option value="createdAt">Création</option></select>
        <button type="button" onClick={() => setDirection(value => value === 'asc' ? 'desc' : 'asc')}>{direction === 'asc' ? '↑' : '↓'}</button>
      </div><div className="admin-scroll-list">{list?.entries.map(row => <article className="admin-list-row" key={row.id}><div><strong>{row.name} · {row.rarity}★</strong>
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
    <button type="button" className="admin-refresh" onClick={refresh}>Actualiser</button>
  </div>
}
