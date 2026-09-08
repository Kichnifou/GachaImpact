import { useEffect, useMemo, useState } from 'react'
import type { PlayerTeamDto, PlayerTeamsDto, TeamCharacterDto } from '../api/types'
import CharacterCard from '../components/CharacterCard'
import CharacterPortraitFrame from '../components/CharacterPortraitFrame'
import CharacterShowcaseCard from '../components/CharacterShowcaseCard'
import GameAssetIcon from '../components/GameAssetIcon'
import { filterTeamCharacters, teamElementFilters, type TeamElementFilter } from '../team/team-presentation'
import { apiErrorMessage } from '../utils/formatters'
import { getElementAssetPath } from '../utils/gameAssets'

type TeamScreenProps = {
  teams: PlayerTeamsDto
  onLoad: () => Promise<PlayerTeamsDto>
  onActivate: (teamId: string) => Promise<PlayerTeamsDto>
  onSetSlot: (teamId: string, position: number, characterId: string) => Promise<PlayerTeamsDto>
  onRemoveSlot: (teamId: string, position: number) => Promise<PlayerTeamsDto>
  onClear: (teamId: string) => Promise<PlayerTeamsDto>
}

function TeamScreen({ teams, onLoad, onActivate, onSetSlot, onRemoveSlot, onClear }: TeamScreenProps) {
  const activeTeam = teams.teams.find(({ active }) => active) ?? teams.teams[0] ?? null
  const [selectedTeamId, setSelectedTeamId] = useState(activeTeam?.id ?? null)
  const [selectorSlot, setSelectorSlot] = useState<number | null>(null)
  const [selectorChoice, setSelectorChoice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [elementFilter, setElementFilter] = useState<TeamElementFilter>('all')
  const [detailCharacter, setDetailCharacter] = useState<TeamCharacterDto | null>(null)
  const [showReference, setShowReference] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTeam = teams.teams.find(({ id }) => id === selectedTeamId) ?? activeTeam
  const presentCharacterIds = new Set(selectedTeam?.slots.flatMap(({ character }) => character ? [character.id] : []) ?? [])
  const filteredCharacters = useMemo(
    () => filterTeamCharacters(teams.availableCharacters, search, elementFilter),
    [elementFilter, search, teams.availableCharacters],
  )

  useEffect(() => {
    let mounted = true
    void onLoad().then((next) => {
      if (!mounted) return
      setSelectedTeamId((current) => next.teams.some(({ id }) => id === current)
        ? current
        : next.teams.find(({ active }) => active)?.id ?? next.teams[0]?.id ?? null)
      setError(null)
    }).catch((reason) => { if (mounted) setError(apiErrorMessage(reason)) })
    return () => { mounted = false }
  }, [onLoad])

  const mutate = async (action: () => Promise<PlayerTeamsDto>, after?: () => void) => {
    if (pending) return
    setPending(true)
    setError(null)
    try { await action(); after?.() }
    catch (reason) { setError(apiErrorMessage(reason)) }
    finally { setPending(false) }
  }

  const openSelector = (position: number) => {
    setSelectorSlot(position)
    setSelectorChoice(null)
    setSearch('')
    setElementFilter('all')
  }

  if (!selectedTeam) return <TeamStatus title="Aucune équipe disponible" detail="Vos emplacements d’équipe n’ont pas pu être chargés." />

  return (
    <div className="screen-content team-screen">
      <header className={`team-screen-heading${selectedTeam.active ? ' active' : ''}`}>
        <div>
          <span className="eyebrow">Team {selectedTeam.position}{selectedTeam.active ? ' · Active' : ''}</span>
          <h1>{selectedTeam.name || `Équipe ${selectedTeam.position}`}</h1>
        </div>
        <div className="team-heading-actions">
          {!selectedTeam.active && <button type="button" className="team-activate-button" disabled={pending} onClick={() => void mutate(() => onActivate(selectedTeam.id))}>Activer cette Team</button>}
          <button type="button" className="team-clear-button" disabled={pending || selectedTeam.slots.every(({ character }) => !character)} onClick={() => void mutate(() => onClear(selectedTeam.id))}>Vider</button>
        </div>
      </header>

      <nav className="team-switcher panel" aria-label="Choisir une Team">
        {teams.teams.slice(0, 10).map((team) => <button type="button" className={`${team.id === selectedTeam.id ? ' selected' : ''}${team.active ? ' active' : ''}`} onClick={() => setSelectedTeamId(team.id)} aria-current={team.active ? 'true' : undefined} key={team.id}><span>Team {team.position}</span><small>{team.slots.filter(({ character }) => character).length}/4{team.active ? ' · Active' : ''}</small></button>)}
      </nav>

      {error && <p className="team-inline-error" role="alert">{error}</p>}

      <section className="large-team-grid" aria-label={`Composition de la Team ${selectedTeam.position}`}>
        {selectedTeam.slots.map(({ position, character }) => character ? (
          <CharacterShowcaseCard
            variant="team"
            name={character.name}
            rarity={character.rarity}
            element={character.elementKey}
            tone={character.elementKey}
            assetPaths={[character.iconPath, character.fullbodyPath, character.wishPath, character.splashPath]}
            fallback={<><span>{character.name.slice(0, 1)}</span><i /></>}
            slot={`0${position}`}
            constellation={character.constellation}
            key={position}
          >
            <div className="team-card-actions">
              <button type="button" onClick={() => setDetailCharacter(character)}>Fiche</button>
              <button type="button" onClick={() => openSelector(position)}>Changer</button>
              <button type="button" className="danger-action" disabled={pending} onClick={() => void mutate(() => onRemoveSlot(selectedTeam.id, position))}>Retirer</button>
            </div>
          </CharacterShowcaseCard>
        ) : (
          <article className="large-team-card empty-team-card" key={position}>
            <span className="team-slot-number">0{position}</span>
            <div className="empty-team-portrait" aria-hidden="true">＋</div>
            <div className="large-team-copy"><span className="eyebrow">Emplacement libre</span><h2>Ajouter un personnage</h2></div>
            <div className="empty-team-action"><button type="button" disabled={pending} onClick={() => openSelector(position)}>Ajouter</button></div>
          </article>
        ))}
      </section>

      <section className="panel team-bonuses">
        <div className="section-heading"><span>Passifs de cette Team</span><small>{selectedTeam.active ? 'Actifs pour le gameplay' : 'Aperçu'}</small></div>
        {selectedTeam.passives.length > 0 ? <div className="bonus-grid">
          {selectedTeam.passives.map((passive) => <article key={passive.elementKey}><GameAssetIcon className={`${passive.elementKey} bonus-element-icon`} src={getElementAssetPath(passive.elementKey)} fallback="✦" /><div><strong>{passive.displayName} {roman(passive.stacks)}</strong><p>{passive.description}</p></div></article>)}
        </div> : <p className="team-no-passive">Aucun passif actif</p>}
        <button type="button" className="team-reference-toggle" onClick={() => setShowReference((value) => !value)} aria-expanded={showReference}>{showReference ? 'Masquer le référentiel' : 'Voir les sept passifs'}</button>
        {showReference && <div className="team-passive-reference">{teams.passiveReference.map((passive) => <article key={passive.elementKey}><GameAssetIcon className="bonus-element-icon" src={getElementAssetPath(passive.elementKey)} fallback="✦" /><div><strong>{passive.displayName}</strong><p><b>I</b> {passive.levelOne}</p><p><b>II</b> {passive.levelTwo}</p></div></article>)}</div>}
      </section>

      {selectorSlot !== null && <CharacterSelector team={selectedTeam} characters={filteredCharacters} presentIds={presentCharacterIds} search={search} elementFilter={elementFilter} selectedId={selectorChoice} pending={pending} onSearch={setSearch} onElement={setElementFilter} onSelect={setSelectorChoice} onClose={() => setSelectorSlot(null)} onConfirm={() => {
        const characterId = selectorChoice
        if (!characterId) return
        void mutate(() => onSetSlot(selectedTeam.id, selectorSlot, characterId), () => { setSelectorSlot(null); setSelectorChoice(null) })
      }} />}

      {detailCharacter && <TeamCharacterDetail character={detailCharacter} onClose={() => setDetailCharacter(null)} />}
    </div>
  )
}

export function CharacterSelector({ team, characters, presentIds, search, elementFilter, selectedId, pending, onSearch, onElement, onSelect, onClose, onConfirm }: {
  team: PlayerTeamDto
  characters: readonly TeamCharacterDto[]
  presentIds: ReadonlySet<string>
  search: string
  elementFilter: TeamElementFilter
  selectedId: string | null
  pending: boolean
  onSearch: (value: string) => void
  onElement: (value: TeamElementFilter) => void
  onSelect: (id: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const selected = characters.find(({ id }) => id === selectedId)
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}>
    <section className="floating-panel team-selector" role="dialog" aria-modal="true" aria-labelledby="team-selector-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="floating-panel-heading"><div><span className="eyebrow">Team {team.position}</span><h2 id="team-selector-title">Choisir un personnage</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button></div>
      <div className="team-selector-filters">
        <label className="search-field"><span aria-hidden="true">⌕</span><span className="sr-only">Rechercher</span><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Rechercher un personnage…" autoFocus /></label>
        <label><span>Élément</span><select value={elementFilter} onChange={(event) => onElement(event.target.value as TeamElementFilter)}>{teamElementFilters.map((value) => <option value={value} key={value}>{value === 'all' ? 'Tous' : elementLabel(value)}</option>)}</select></label>
      </div>
      {characters.length > 0 ? <div className="selector-character-grid">{characters.map((character) => <CharacterCard character={character} compact selected={selectedId === character.id} disabled={presentIds.has(character.id)} onClick={() => onSelect(character.id)} key={character.id} />)}</div> : <p className="team-selector-empty">Aucun personnage possédé ne correspond à cette recherche.</p>}
      <div className="selector-footer"><span>Sélection : <strong>{selected?.name ?? 'Aucune'}</strong></span><button type="button" className="small-primary-button" disabled={!selected || pending} onClick={onConfirm}>{pending ? 'Enregistrement…' : 'Confirmer'}</button></div>
    </section>
  </div>
}

function TeamCharacterDetail({ character, onClose }: { character: TeamCharacterDto; onClose: () => void }) {
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className={`floating-panel team-character-detail ${character.elementKey}`} role="dialog" aria-modal="true" aria-label={`Fiche de ${character.name}`} onMouseDown={(event) => event.stopPropagation()}><div className="floating-panel-heading"><span className="eyebrow">Personnage de la Team</span><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer la fiche"><span className="icon-glyph">×</span></button></div><CharacterPortraitFrame characterName={character.name} element={character.elementKey} assetPaths={[character.iconPath, character.fullbodyPath, character.wishPath, character.splashPath]} fallback={<span>{character.name.slice(0, 1)}</span>} frameClassName="team-detail-portrait" imageClassName="team-detail-image" badgeClassName="team-detail-element" /><div className="team-detail-copy"><h2>{character.name}</h2><span className="character-rarity">{'★'.repeat(character.rarity)}</span><strong>C{character.constellation}</strong></div></section></div>
}

function TeamStatus({ title, detail }: { title: string; detail: string }) {
  return <section className="panel team-status" role="status"><span aria-hidden="true">◇</span><h2>{title}</h2><p>{detail}</p></section>
}

function roman(stacks: 1 | 2) { return stacks === 1 ? 'I' : 'II' }
function elementLabel(element: Exclude<TeamElementFilter, 'all'>) { return ({ pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Électro', anemo: 'Anémo', geo: 'Géo', dendro: 'Dendro' } as const)[element] }

export default TeamScreen
