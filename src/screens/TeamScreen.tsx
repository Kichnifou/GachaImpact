import { useEffect, useMemo, useRef, useState } from 'react'
import type { BoxCharacterDto, PlayerBoxDto, PlayerTeamDto, PlayerTeamsDto, StellaUseDto, TeamCharacterDto } from '../api/types'
import { useBoxCollection } from '../box/use-box-collection'
import BoxCharacterDetailModal from '../components/BoxCharacterDetailModal'
import CharacterCard from '../components/CharacterCard'
import CharacterShowcaseCard from '../components/CharacterShowcaseCard'
import GameAssetIcon from '../components/GameAssetIcon'
import { canOpenNextTeamPage, filterTeamCharacters, insertTeamOrder, swapTeamOrder, swapTeamSlots, teamElementFilters, teamPageForPosition, teamPassiveStatusLabel, teamsPerPage, type TeamElementFilter } from '../team/team-presentation'
import { apiErrorMessage } from '../utils/formatters'
import { getElementAssetPath } from '../utils/gameAssets'

type TeamScreenProps = {
  teams: PlayerTeamsDto
  initialBox: PlayerBoxDto | null
  stellaRetryCharacterId: string | null
  onLoad: () => Promise<PlayerTeamsDto>
  onActivate: (teamId: string) => Promise<PlayerTeamsDto>
  onRename: (teamId: string, name: string | null) => Promise<PlayerTeamsDto>
  onCreateNext: (expectedPosition: number) => Promise<PlayerTeamsDto>
  onDelete: (teamId: string) => Promise<PlayerTeamsDto>
  onReorderTeams: (teamIds: readonly string[]) => Promise<PlayerTeamsDto>
  onSetSlot: (teamId: string, position: number, characterId: string) => Promise<PlayerTeamsDto>
  onReorderSlots: (teamId: string, characterIds: readonly (string | null)[]) => Promise<PlayerTeamsDto>
  onRemoveSlot: (teamId: string, position: number) => Promise<PlayerTeamsDto>
  onClear: (teamId: string) => Promise<PlayerTeamsDto>
  onLoadBox: () => Promise<PlayerBoxDto>
  onSetBoxFavorite: (characterId: string, favorite: boolean) => Promise<BoxCharacterDto>
  onUseStella: (characterId: string) => Promise<StellaUseDto>
}

type SlotOrderPreview = {
  teamId: string
  characterIds: readonly (string | null)[]
}

function TeamScreen(props: TeamScreenProps) {
  const { teams, onLoad } = props
  const activeTeam = teams.teams.find(({ active }) => active) ?? teams.teams[0] ?? null
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(activeTeam?.id ?? null)
  const [page, setPage] = useState(() => teamPageForPosition(activeTeam?.position ?? 1))
  const [selectorSlot, setSelectorSlot] = useState<number | null>(null)
  const [selectorChoice, setSelectorChoice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [elementFilter, setElementFilter] = useState<TeamElementFilter>('all')
  const [detailCharacterId, setDetailCharacterId] = useState<string | null>(null)
  const [showReference, setShowReference] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameDraft, setRenameDraft] = useState('')
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null)
  const [draggedTeamId, setDraggedTeamId] = useState<string | null>(null)
  const [teamSwapTargetId, setTeamSwapTargetId] = useState<string | null>(null)
  const [teamInsertionIndex, setTeamInsertionIndex] = useState<number | null>(null)
  const [slotDropTarget, setSlotDropTarget] = useState<number | null>(null)
  const [teamOrderPreview, setTeamOrderPreview] = useState<readonly string[] | null>(null)
  const [slotOrderPreview, setSlotOrderPreview] = useState<SlotOrderPreview | null>(null)
  const [autoPageDirection, setAutoPageDirection] = useState<-1 | 1 | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoPageTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mutationPending = useRef(false)
  const selectedTeamIdRef = useRef(selectedTeamId)

  const displayedTeams = useMemo(() => teamOrderPreview
    ? teamOrderPreview.flatMap((id, index) => {
      const team = teams.teams.find((candidate) => candidate.id === id)
      return team ? [{ ...team, position: index + 1 }] : []
    })
    : teams.teams, [teamOrderPreview, teams.teams])
  const selectedTeam = displayedTeams.find(({ id }) => id === selectedTeamId) ?? activeTeam
  const displayedSlots = useMemo(() => {
    if (!selectedTeam || slotOrderPreview?.teamId !== selectedTeam.id) return selectedTeam?.slots ?? []
    return slotOrderPreview.characterIds.map((characterId, index) => ({
      position: (index + 1) as 1 | 2 | 3 | 4,
      character: selectedTeam.slots.find(({ character }) => character?.id === characterId)?.character ?? null,
    }))
  }, [selectedTeam, slotOrderPreview])
  const presentCharacterIds = new Set(selectedTeam?.slots.flatMap(({ character }) => character ? [character.id] : []) ?? [])
  const filteredCharacters = useMemo(() => filterTeamCharacters(teams.availableCharacters, search, elementFilter), [elementFilter, search, teams.availableCharacters])

  useEffect(() => { selectedTeamIdRef.current = selectedTeamId }, [selectedTeamId])

  useEffect(() => {
    let mounted = true
    void onLoad().then((next) => {
      if (!mounted) return
      const selected = next.teams.find(({ id }) => id === selectedTeamIdRef.current) ?? next.teams.find(({ active }) => active) ?? next.teams[0]
      setSelectedTeamId(selected?.id ?? null)
      if (selected) setPage(teamPageForPosition(selected.position))
      setError(null)
    }).catch((reason) => { if (mounted) setError(apiErrorMessage(reason)) })
    return () => { mounted = false }
  }, [onLoad])

  useEffect(() => () => {
    if (autoPageTimer.current) clearTimeout(autoPageTimer.current)
  }, [])

  const mutate = async (action: () => Promise<PlayerTeamsDto>, after?: (next: PlayerTeamsDto) => void, afterSettled?: () => void, afterLocked?: () => void) => {
    if (mutationPending.current) return false
    mutationPending.current = true
    setPending(true)
    setError(null)
    afterLocked?.()
    try { const next = await action(); after?.(next) }
    catch (reason) { setError(apiErrorMessage(reason)) }
    finally { mutationPending.current = false; setPending(false); afterSettled?.() }
    return true
  }

  const openSelector = (position: number) => { setSelectorSlot(position); setSelectorChoice(null); setSearch(''); setElementFilter('all') }
  const selectTeam = (team: PlayerTeamDto) => { setSelectedTeamId(team.id); setRenaming(false) }
  const createNext = (expectedPosition: number) => void mutate(() => props.onCreateNext(expectedPosition), (next) => { const created = next.teams.find(({ position }) => position === expectedPosition); if (created) { setSelectedTeamId(created.id); setPage(teamPageForPosition(created.position)) } })
  const deleteSelected = () => {
    if (!selectedTeam || selectedTeam.position <= 10 || selectedTeam.active) return
    if (selectedTeam.slots.some(({ character }) => character) && !window.confirm(`Supprimer la Team ${selectedTeam.position} et sa composition ?`)) return
    void mutate(() => props.onDelete(selectedTeam.id), (next) => { const fallback = next.teams[Math.min(selectedTeam.position - 1, next.teams.length - 1)] ?? next.teams.at(-1); setSelectedTeamId(fallback?.id ?? null); setPage(teamPageForPosition(fallback?.position ?? 1)) })
  }
  const clearDragFeedback = () => {
    setDraggedSlot(null)
    setDraggedTeamId(null)
    setTeamSwapTargetId(null)
    setTeamInsertionIndex(null)
    setSlotDropTarget(null)
    clearAutoPageTimer()
  }
  const reorderSlots = (from: number, to: number) => {
    if (mutationPending.current || !selectedTeam || from === to) return
    const teamId = selectedTeam.id
    const ids = selectedTeam.slots.map(({ character }) => character?.id ?? null)
    const nextIds = swapTeamSlots(ids, from - 1, to - 1)
    void mutate(
      () => props.onReorderSlots(teamId, nextIds),
      undefined,
      () => setSlotOrderPreview((current) => current?.teamId === teamId ? null : current),
      () => setSlotOrderPreview({ teamId, characterIds: nextIds }),
    )
  }
  const reorderTeams = (nextIds: readonly string[]) => {
    if (mutationPending.current || !draggedTeamId) return
    const movingTeamId = draggedTeamId
    const unchanged = nextIds.every((id, index) => id === teams.teams[index]?.id)
    const followDraggedTeam = movingTeamId === selectedTeamId
    if (unchanged) { clearDragFeedback(); return }
    void mutate(() => props.onReorderTeams(nextIds), (next) => {
      if (!followDraggedTeam) return
      const selected = next.teams.find(({ id }) => id === selectedTeamId)
      if (selected) setPage(teamPageForPosition(selected.position))
    }, () => setTeamOrderPreview(null), () => {
      setTeamOrderPreview(nextIds)
      clearDragFeedback()
    })
  }
  const scheduleAutoPage = (direction: -1 | 1) => {
    if (mutationPending.current || !draggedTeamId || autoPageTimer.current || (direction < 0 && page === 0) || (direction > 0 && !canOpenNextTeamPage(teams.teams.length, page))) return
    setAutoPageDirection(direction)
    autoPageTimer.current = setTimeout(() => { setPage((current) => current + direction); clearAutoPageTimer() }, 550)
  }
  const clearAutoPageTimer = () => { if (autoPageTimer.current) clearTimeout(autoPageTimer.current); autoPageTimer.current = null; setAutoPageDirection(null) }

  if (!selectedTeam) return <TeamStatus title="Aucune équipe disponible" detail="Vos emplacements d’équipe n’ont pas pu être chargés." />
  const pageStart = page * teamsPerPage + 1
  const pagePositions = Array.from({ length: teamsPerPage }, (_, index) => pageStart + index)
  const nextPosition = displayedTeams.length + 1

  return <div className="screen-content team-screen">
    <nav className="team-switcher panel" aria-label={`Teams ${pageStart} à ${pageStart + 9}`}>
      {page > 0 ? <button type="button" className={`team-page-chevron${autoPageDirection === -1 ? ' drag-awaiting' : ''}`} aria-label="Teams précédentes" onClick={() => setPage((current) => current - 1)} onDragOver={(event) => { if (!mutationPending.current) event.preventDefault() }} onDragEnter={() => scheduleAutoPage(-1)} onDragLeave={() => { if (!mutationPending.current) clearAutoPageTimer() }}>‹</button> : <span className="team-page-chevron-spacer" aria-hidden="true" />}
      <div className="team-page-track team-page-track-spaced">{pagePositions.map((position, index) => {
        const team = displayedTeams.find((candidate) => candidate.position === position)
        const insertionIndex = page * teamsPerPage + index
        const teamIds = displayedTeams.map(({ id }) => id)
        return <div className="team-switch-item" key={position}>
          <span className={`team-between-drop${teamInsertionIndex === insertionIndex ? ' drag-insert-target' : ''}`} aria-hidden="true" onDragOver={(event) => { if (!mutationPending.current) event.preventDefault() }} onDragEnter={() => { if (!mutationPending.current) setTeamInsertionIndex(insertionIndex) }} onDragLeave={() => { if (!mutationPending.current) setTeamInsertionIndex(null) }} onDrop={() => reorderTeams(insertTeamOrder(teamIds, draggedTeamId ?? '', insertionIndex))} />
          {team ? <button
            type="button"
            draggable={!pending}
            className={`${team.id === selectedTeam.id ? ' selected' : ''}${team.active ? ' active' : ''}${teamSwapTargetId === team.id ? ' drag-swap-target' : ''}`}
            onClick={() => selectTeam(team)}
            onDragStart={(event) => { if (mutationPending.current) { event.preventDefault(); return } event.dataTransfer.effectAllowed = 'move'; setDraggedTeamId(team.id) }}
            onDragEnd={() => { if (!mutationPending.current) clearDragFeedback() }}
            onDragOver={(event) => { if (!mutationPending.current) event.preventDefault() }}
            onDragEnter={() => { if (!mutationPending.current && draggedTeamId && draggedTeamId !== team.id) setTeamSwapTargetId(team.id) }}
            onDragLeave={() => { if (!mutationPending.current) setTeamSwapTargetId(null) }}
            onDrop={() => reorderTeams(swapTeamOrder(teamIds, draggedTeamId ?? '', team.id))}
            aria-current={team.active ? 'true' : undefined}
          ><span>Team {team.position}</span><small>{team.slots.filter(({ character }) => character).length}/4{team.active ? ' · Active' : ''}</small>{teamSwapTargetId === team.id && <em>Échanger</em>}</button> : position === nextPosition ? <button type="button" className="team-create-slot" disabled={pending} onClick={() => createNext(position)}><span>Team {position}</span><small>＋ Créer</small></button> : <span className="team-locked-slot" aria-label={`Team ${position} verrouillée`}><span>Team {position}</span><small>Verrouillée</small></span>}
          {index === pagePositions.length - 1 && <span className={`team-between-drop after${teamInsertionIndex === insertionIndex + 1 ? ' drag-insert-target' : ''}`} aria-hidden="true" onDragOver={(event) => { if (!mutationPending.current) event.preventDefault() }} onDragEnter={() => { if (!mutationPending.current) setTeamInsertionIndex(insertionIndex + 1) }} onDragLeave={() => { if (!mutationPending.current) setTeamInsertionIndex(null) }} onDrop={() => reorderTeams(insertTeamOrder(teamIds, draggedTeamId ?? '', insertionIndex + 1))} />}
        </div>
      })}</div>
      {canOpenNextTeamPage(teams.teams.length, page) ? <button type="button" className={`team-page-chevron${autoPageDirection === 1 ? ' drag-awaiting' : ''}`} aria-label="Teams suivantes" onClick={() => setPage((current) => current + 1)} onDragOver={(event) => { if (!mutationPending.current) event.preventDefault() }} onDragEnter={() => scheduleAutoPage(1)} onDragLeave={() => { if (!mutationPending.current) clearAutoPageTimer() }}>›</button> : <span className="team-page-chevron-spacer" aria-hidden="true" />}
    </nav>

    <header className={`team-screen-heading${selectedTeam.active ? ' active' : ''}`}>
      <div className="team-heading-copy"><span className="eyebrow">Team {selectedTeam.position}{selectedTeam.active ? ' · Active' : ''}</span>{renaming ? <div className="team-rename-row"><input value={renameDraft} maxLength={20} autoFocus aria-label="Nom de la Team" onChange={(event) => setRenameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void mutate(() => props.onRename(selectedTeam.id, renameDraft), () => setRenaming(false)); if (event.key === 'Escape') setRenaming(false) }} /><button type="button" className="icon-button" aria-label="Valider le nom" disabled={pending} onClick={() => void mutate(() => props.onRename(selectedTeam.id, renameDraft), () => setRenaming(false))}><span className="icon-glyph">✓</span></button><button type="button" className="icon-button" aria-label="Annuler le renommage" onClick={() => setRenaming(false)}><span className="icon-glyph">×</span></button></div> : <div className="team-title-row"><h1>{selectedTeam.name || `Équipe ${selectedTeam.position}`}</h1><button type="button" className="team-edit-name icon-button" aria-label="Renommer cette Team" onClick={() => { setRenameDraft(selectedTeam.name ?? ''); setRenaming(true) }}><span className="icon-glyph">✎</span></button></div>}</div>
      <div className="team-heading-actions"><button type="button" className="team-order-fallback" disabled={pending || selectedTeam.position === 1} aria-label="Déplacer cette Team vers la gauche" onClick={() => void mutate(() => props.onReorderTeams(insertTeamOrder(teams.teams.map(({ id }) => id), selectedTeam.id, selectedTeam.position - 2)))}>←</button><button type="button" className="team-order-fallback" disabled={pending || selectedTeam.position === teams.teams.length} aria-label="Déplacer cette Team vers la droite" onClick={() => void mutate(() => props.onReorderTeams(insertTeamOrder(teams.teams.map(({ id }) => id), selectedTeam.id, selectedTeam.position + 1)))}>→</button>{!selectedTeam.active && <button type="button" className="team-activate-button" disabled={pending} onClick={() => void mutate(() => props.onActivate(selectedTeam.id))}>Activer cette Team</button>}{selectedTeam.position > 10 && <button type="button" className="team-delete-button" disabled={pending || selectedTeam.active} onClick={deleteSelected}>Supprimer</button>}<button type="button" className="team-clear-button" disabled={pending || selectedTeam.slots.every(({ character }) => !character)} onClick={() => void mutate(() => props.onClear(selectedTeam.id))}>Vider</button></div>
    </header>

    {error && <p className="team-inline-error" role="alert">{error}</p>}
    <section className={`large-team-grid team-count-${displayedSlots.filter(({ character }) => character).length}`} aria-label={`Composition de la Team ${selectedTeam.position}`}>{displayedSlots.map(({ position, character }) => <div
      className={`team-slot-drag-wrapper${character ? '' : ' empty-team-slot'}${slotDropTarget === position ? ' drag-slot-target' : ''}`}
      draggable={Boolean(character) && !pending}
      onDragStart={(event) => { if (!character || mutationPending.current) { event.preventDefault(); return } event.stopPropagation(); event.dataTransfer.effectAllowed = 'move'; setDraggedSlot(position) }}
      onDragEnd={() => { if (!mutationPending.current) clearDragFeedback() }}
      onDragOver={(event) => { if (!mutationPending.current) event.preventDefault() }}
      onDragEnter={() => { if (!mutationPending.current && draggedSlot && draggedSlot !== position) setSlotDropTarget(position) }}
      onDragLeave={() => { if (!mutationPending.current) setSlotDropTarget(null) }}
      onDrop={(event) => { if (mutationPending.current) return; event.preventDefault(); event.stopPropagation(); if (draggedSlot) reorderSlots(draggedSlot, position); clearDragFeedback() }}
      key={position}
    >{character ? <CharacterShowcaseCard variant="team" name={character.name} rarity={character.rarity} element={character.elementKey} tone={character.elementKey} assetPaths={[character.iconPath, character.fullbodyPath, character.wishPath, character.splashPath]} fallback={<><span>{character.name.slice(0, 1)}</span><i /></>} slot={`0${position}`} constellation={character.constellation}><div className="team-card-actions"><div className="team-card-primary-actions"><button type="button" onClick={() => setDetailCharacterId(character.id)}>Fiche</button><button type="button" onClick={() => openSelector(position)}>Changer</button><button type="button" className="danger-action" disabled={pending} onClick={() => void mutate(() => props.onRemoveSlot(selectedTeam.id, position))}>Retirer</button></div><div className="team-card-move-actions"><button type="button" aria-label={`Déplacer ${character.name} vers la gauche`} disabled={pending || position === 1} onClick={() => reorderSlots(position, position - 1)}>←</button><button type="button" aria-label={`Déplacer ${character.name} vers la droite`} disabled={pending || position === 4} onClick={() => reorderSlots(position, position + 1)}>→</button></div></div></CharacterShowcaseCard> : <button type="button" className="large-team-card empty-team-card" disabled={pending} aria-label={`Ajouter un personnage à l’emplacement ${position}`} onClick={() => openSelector(position)}><span className="team-slot-number">0{position}</span><span className="empty-team-portrait" aria-hidden="true">＋</span><span className="empty-team-hover-action">Ajouter</span></button>}{slotDropTarget === position && <span className="slot-swap-indicator" aria-hidden="true">Échanger</span>}</div>)}</section>

    <section className="panel team-bonuses"><div className="section-heading"><span>Passifs de cette Team</span><small>{teamPassiveStatusLabel(selectedTeam.active)}</small></div>{selectedTeam.passives.length > 0 ? <div className={`bonus-grid passive-count-${selectedTeam.passives.length}`}>{selectedTeam.passives.map((passive) => <article key={passive.elementKey}><GameAssetIcon className={`${passive.elementKey} bonus-element-icon`} src={getElementAssetPath(passive.elementKey)} fallback="✦" /><div><strong>{passive.displayName} {roman(passive.stacks)}</strong><p>{passive.description}</p></div></article>)}</div> : <p className="team-no-passive">Aucun passif actif</p>}<button type="button" className="team-reference-toggle" onClick={() => setShowReference(true)}>Voir les passifs</button></section>
    {showReference && <TeamPassiveReferenceModal passives={teams.passiveReference} onClose={() => setShowReference(false)} />}
    {selectorSlot !== null && <CharacterSelector team={selectedTeam} characters={filteredCharacters} presentIds={presentCharacterIds} search={search} elementFilter={elementFilter} selectedId={selectorChoice} pending={pending} onSearch={setSearch} onElement={setElementFilter} onSelect={setSelectorChoice} onClose={() => setSelectorSlot(null)} onConfirm={() => { const characterId = selectorChoice; if (characterId) void mutate(() => props.onSetSlot(selectedTeam.id, selectorSlot, characterId), () => { setSelectorSlot(null); setSelectorChoice(null) }) }} />}
    {detailCharacterId && <TeamBoxCharacterDetail characterId={detailCharacterId} {...props} onClose={() => setDetailCharacterId(null)} />}
  </div>
}

export function TeamPassiveReferenceModal({ passives, onClose }: { passives: PlayerTeamsDto['passiveReference']; onClose: () => void }) { useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [onClose]); return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel team-passive-modal" role="dialog" aria-modal="true" aria-labelledby="team-passive-title" onMouseDown={(event) => event.stopPropagation()}><header className="floating-panel-heading"><div><span className="eyebrow">Référentiel</span><h2 id="team-passive-title">Les sept passifs</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer les passifs"><span className="icon-glyph">×</span></button></header><div className="team-passive-reference">{passives.map((passive) => <article key={passive.elementKey}><GameAssetIcon className="bonus-element-icon" src={getElementAssetPath(passive.elementKey)} fallback="✦" /><div><strong>{passive.displayName}</strong><p><b>I</b> {passive.levelOne}</p><p><b>II</b> {passive.levelTwo}</p></div></article>)}</div></section></div> }

function TeamBoxCharacterDetail({ characterId, initialBox, stellaRetryCharacterId, onLoadBox, onSetBoxFavorite, onUseStella, onLoad, onClose }: Pick<TeamScreenProps, 'initialBox' | 'stellaRetryCharacterId' | 'onLoadBox' | 'onSetBoxFavorite' | 'onUseStella' | 'onLoad'> & { characterId: string; onClose: () => void }) { const detail = useBoxCollection({ initialBox, onLoadBox, onSetFavorite: onSetBoxFavorite, onUseStella, stellaRetryCharacterId, onCharacterProgressed: onLoad }); const character = detail.box?.characters.find(({ id }) => id === characterId) ?? null; if (!detail.box && !detail.error) return <TeamDetailStatus title="Ouverture de la fiche…" detail="Chargement de votre possession." onClose={onClose} />; if (!detail.box || !character) return <TeamDetailStatus title="Fiche indisponible" detail={detail.error ?? 'Ce personnage ne figure plus dans votre Box.'} onClose={onClose} />; return <BoxCharacterDetailModal character={character} stellaQuantity={detail.box.stella.quantity} stellaRetryAvailable={detail.stellaRetryId === character.id} favoritePending={detail.favoritePendingId === character.id} stellaPending={detail.stellaPendingId === character.id} stellaFeedback={detail.stellaFeedback} actionError={detail.error} onToggleFavorite={() => void detail.toggleFavorite(character)} onUseStella={() => void detail.useStella(character)} onClose={onClose} /> }
function TeamDetailStatus({ title, detail, onClose }: { title: string; detail: string; onClose: () => void }) { return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel team-detail-status panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer la fiche"><span className="icon-glyph">×</span></button><h2>{title}</h2><p>{detail}</p></section></div> }

export function CharacterSelector({ team, characters, presentIds, search, elementFilter, selectedId, pending, onSearch, onElement, onSelect, onClose, onConfirm }: { team: PlayerTeamDto; characters: readonly TeamCharacterDto[]; presentIds: ReadonlySet<string>; search: string; elementFilter: TeamElementFilter; selectedId: string | null; pending: boolean; onSearch: (value: string) => void; onElement: (value: TeamElementFilter) => void; onSelect: (id: string) => void; onClose: () => void; onConfirm: () => void }) { const selected = characters.find(({ id }) => id === selectedId); return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel team-selector" role="dialog" aria-modal="true" aria-labelledby="team-selector-title" onMouseDown={(event) => event.stopPropagation()}><div className="floating-panel-heading"><div><span className="eyebrow">Team {team.position}</span><h2 id="team-selector-title">Choisir un personnage</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button></div><div className="team-selector-filters"><label className="search-field"><span aria-hidden="true">⌕</span><span className="sr-only">Rechercher</span><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Rechercher un personnage…" autoFocus /></label><label><span>Élément</span><select value={elementFilter} onChange={(event) => onElement(event.target.value as TeamElementFilter)}>{teamElementFilters.map((value) => <option value={value} key={value}>{value === 'all' ? 'Tous' : elementLabel(value)}</option>)}</select></label></div>{characters.length > 0 ? <div className="selector-character-grid">{characters.map((character) => <CharacterCard character={character} compact selected={selectedId === character.id} disabled={presentIds.has(character.id)} onClick={() => onSelect(character.id)} key={character.id} />)}</div> : <p className="team-selector-empty">Aucun personnage possédé ne correspond à cette recherche.</p>}<div className="selector-footer"><span>Sélection : <strong>{selected?.name ?? 'Aucune'}</strong></span><button type="button" className="small-primary-button" disabled={!selected || pending} onClick={onConfirm}>{pending ? 'Enregistrement…' : 'Confirmer'}</button></div></section></div> }

function TeamStatus({ title, detail }: { title: string; detail: string }) { return <section className="panel team-status" role="status"><span aria-hidden="true">◇</span><h2>{title}</h2><p>{detail}</p></section> }
function roman(stacks: 1 | 2) { return stacks === 1 ? 'I' : 'II' }
function elementLabel(element: Exclude<TeamElementFilter, 'all'>) { return ({ pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Électro', anemo: 'Anémo', geo: 'Géo', dendro: 'Dendro' } as const)[element] }

export default TeamScreen
