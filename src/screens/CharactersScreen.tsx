import type { BannerVoteCache } from '../characters/banner-vote-cache'
import { useMemo, useState } from 'react'
import { type ElementKey, type GachaCharacterDto } from '../api/types'
import CharacterCard from '../components/CharacterCard'
import CollectionFilters, { type CharacterRarityFilter, type CharacterSortDirection, type CharacterSortKey } from '../components/CollectionFilters'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { compareCharacters, normalizeCharacterSearch } from '../characters/character-catalog'
import AppButton from '../components/AppButton'
import { useBannerVotes, type BannerVoteActions } from '../characters/use-banner-votes'

function CharactersScreen({ characters, voteCache, ...voteActions }: { characters: readonly GachaCharacterDto[]; voteCache?: BannerVoteCache } & BannerVoteActions) {
  const votes = useBannerVotes(voteActions, voteCache)
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState<CharacterRarityFilter>('all')
  const [element, setElement] = useState<ElementKey | null>(null)
  const [sortKey, setSortKey] = useState<CharacterSortKey>('name')
  const [direction, setDirection] = useState<CharacterSortDirection>('asc')
  const counts = useMemo(() => new Map(votes.value?.candidates.map(c => [c.characterId, c.voteCount])), [votes.value])
  const filtered = useMemo(() => {
    const needle = normalizeCharacterSearch(query)
    const sign = direction === 'asc' ? 1 : -1
    return characters
      .filter((character) => (!needle || normalizeCharacterSearch(character.name).includes(needle)) && (rarity === 'all' || character.rarity === rarity) && (!element || character.elementKey === element))
      .slice().sort((left, right) => {
        if (sortKey !== 'votes') return sign * compareCharacters(left, right, sortKey)
        const a = counts.get(left.id), b = counts.get(right.id)
        if (a === undefined || b === undefined) return a === b ? compareCharacters(left, right, 'name') : a === undefined ? 1 : -1
        return sign * (a - b) || compareCharacters(left, right, 'name')
      })
  }, [characters, counts, direction, element, query, rarity, sortKey])
  const filtering = normalizeCharacterSearch(query).length > 0 || rarity !== 'all' || element !== null
  const reset = () => { setQuery(''); setRarity('all'); setElement(null); setSortKey('name'); setDirection('asc') }

  return <div className="screen-content collection-screen catalog-screen long-screen-layout">
    <ScrollableScreenPanel className="collection-screen-panel" bodyClassName="collection-results-body" fixed={<>
      <div className="collection-summary"><span>{filtering ? `${filtered.length} / ${characters.length} personnages` : `${characters.length} personnages actifs`}</span></div>
      <CollectionFilters allowVotes placeholder="Rechercher un personnage…" query={query} rarity={rarity} element={element} sortKey={sortKey} direction={direction} onQueryChange={setQuery} onRarityChange={setRarity} onElementChange={setElement} onSortKeyChange={(key) => { setSortKey(key); if (key === 'votes') setDirection('desc') }} onDirectionChange={() => setDirection((value) => value === 'asc' ? 'desc' : 'asc')} />
    </>}>
    <div className="catalog-vote-feedback" role="alert">{votes.error}</div>
    {filtered.length ? <section className="character-grid" aria-label="Catalogue des personnages">{filtered.map((character) => {
      const candidate = votes.value?.candidates.find(entry => entry.characterId === character.id)
      return <CharacterCard character={character} key={character.id} footer={<div className="catalog-vote-slot">{candidate && <div className="catalog-character-vote"><span>{candidate.voteCount} vote{candidate.voteCount <= 1 ? '' : 's'}</span>{votes.value?.ownVote?.characterId === character.id ? <strong>Voté ✓</strong> : votes.value?.canVote && <AppButton variant="primary" aria-label={`Voter pour ${character.name} — choix définitif pour cette semaine`} disabled={votes.pending} onClick={() => void votes.vote(character.id)}>Voter</AppButton>}</div>}</div>} />
    })}</section>
      : <section className="catalog-empty" role="status"><p>Aucun personnage ne correspond à ces filtres.</p><button type="button" onClick={reset}>Réinitialiser</button></section>}
    </ScrollableScreenPanel>
  </div>
}

export default CharactersScreen
