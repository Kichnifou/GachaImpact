import { useMemo, useState } from 'react'
import { type ElementKey, type GachaCharacterDto } from '../api/types'
import CharacterCard from '../components/CharacterCard'
import CollectionFilters, { type CharacterRarityFilter, type CharacterSortDirection, type CharacterSortKey } from '../components/CollectionFilters'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { compareCharacters, normalizeCharacterSearch } from '../characters/character-catalog'
import AppButton from '../components/AppButton'
import { useBannerVotes, type BannerVoteActions } from '../characters/use-banner-votes'

function CharactersScreen({ characters, ...voteActions }: { characters: readonly GachaCharacterDto[] } & BannerVoteActions) {
  const votes = useBannerVotes(voteActions)
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState<CharacterRarityFilter>('all')
  const [element, setElement] = useState<ElementKey | null>(null)
  const [sortKey, setSortKey] = useState<CharacterSortKey>('name')
  const [direction, setDirection] = useState<CharacterSortDirection>('asc')
  const filtered = useMemo(() => {
    const needle = normalizeCharacterSearch(query)
    const sign = direction === 'asc' ? 1 : -1
    return characters
      .filter((character) => (!needle || normalizeCharacterSearch(character.name).includes(needle)) && (rarity === 'all' || character.rarity === rarity) && (!element || character.elementKey === element))
      .slice().sort((left, right) => sign * compareCharacters(left, right, sortKey))
  }, [characters, direction, element, query, rarity, sortKey])
  const filtering = normalizeCharacterSearch(query).length > 0 || rarity !== 'all' || element !== null
  const reset = () => { setQuery(''); setRarity('all'); setElement(null); setSortKey('name'); setDirection('asc') }

  return <div className="screen-content collection-screen catalog-screen long-screen-layout">
    <ScrollableScreenPanel className="collection-screen-panel" bodyClassName="collection-results-body" fixed={<>
      <div className="collection-summary"><span>{filtering ? `${filtered.length} / ${characters.length} personnages` : `${characters.length} personnages actifs`}</span></div>
      {votes.value && <div className="catalog-vote-summary"><strong>Bannière suivante</strong><span>Un vote gratuit et définitif par semaine.</span><span>Fin du vote : {new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(new Date(votes.value.endsAt))} (Paris)</span>{votes.value.ownVote ? <span role="status">Votre vote est enregistré.</span> : !votes.value.canVote && <span>Vote fermé · rotation en attente.</span>}</div>}
      {votes.error && <p role="alert">{votes.error}</p>}
      <CollectionFilters placeholder="Rechercher un personnage…" query={query} rarity={rarity} element={element} sortKey={sortKey} direction={direction} onQueryChange={setQuery} onRarityChange={setRarity} onElementChange={setElement} onSortKeyChange={setSortKey} onDirectionChange={() => setDirection((value) => value === 'asc' ? 'desc' : 'asc')} />
    </>}>
    {filtered.length ? <section className="character-grid" aria-label="Catalogue des personnages">{filtered.map((character) => {
      const candidate = votes.value?.candidates.find(entry => entry.characterId === character.id)
      return <CharacterCard character={character} key={character.id} footer={candidate && <div className="catalog-character-vote"><span>{candidate.voteCount} vote{candidate.voteCount === 1 ? '' : 's'}</span>{votes.value?.ownVote?.characterId === character.id ? <strong>Votre vote ✓</strong> : votes.value?.canVote && <AppButton variant="primary" disabled={votes.pending} onClick={() => void votes.vote(character.id)}>Voter</AppButton>}</div>} />
    })}</section>
      : <section className="catalog-empty" role="status"><p>Aucun personnage ne correspond à ces filtres.</p><button type="button" onClick={reset}>Réinitialiser</button></section>}
    </ScrollableScreenPanel>
  </div>
}

export default CharactersScreen
