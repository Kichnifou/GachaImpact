import type { BannerVoteCache } from '../characters/banner-vote-cache'
import { useMemo, useState } from 'react'
import { elementKeys, type ElementKey, type GachaCharacterDto } from '../api/types'
import CharacterCard from '../components/CharacterCard'
import CollectionFilters, { type CharacterRarityFilter, type CharacterSortDirection, type CharacterSortKey } from '../components/CollectionFilters'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { compareCharacters, compareReleaseDates, normalizeCharacterSearch } from '../characters/character-catalog'
import AppButton from '../components/AppButton'
import { useBannerVotes, type BannerVoteActions } from '../characters/use-banner-votes'
import type { CharacterPreparationDto } from '../api/types'
import CharacterPortraitFrame from '../components/CharacterPortraitFrame'
import '../characters/catalog-preparation.css'

function CharactersScreen({ characters, preparations = [], voteCache, refreshToken = 0, ...voteActions }: { characters: readonly GachaCharacterDto[]; preparations?: readonly CharacterPreparationDto[]; voteCache?: BannerVoteCache; refreshToken?: number } & BannerVoteActions) {
  const votes = useBannerVotes(voteActions, voteCache, refreshToken)
  const [query, setQuery] = useState('')
  const [rarity, setRarity] = useState<CharacterRarityFilter>('all')
  const [elements, setElements] = useState<readonly ElementKey[]>([])
  const matchesElement = (element: string | null) => elements.length === 0 || elements.some(selected => selected === element)
  const [sortKey, setSortKey] = useState<CharacterSortKey>('name')
  const [direction, setDirection] = useState<CharacterSortDirection>('asc')
  const counts = useMemo(() => new Map(votes.value?.candidates.map(c => [c.characterId, c.voteCount])), [votes.value])
  const filtered = useMemo(() => {
    const needle = normalizeCharacterSearch(query)
    const sign = direction === 'asc' ? 1 : -1
    return characters
      .filter((character) => (!needle || normalizeCharacterSearch(character.name).includes(needle)) && (rarity === 'all' || character.rarity === rarity) && matchesElement(character.elementKey))
      .slice().sort((left, right) => {
        if (sortKey === 'releaseDate') return compareReleaseDates(left,right,direction)
        if (sortKey !== 'votes') return sign * compareCharacters(left, right, sortKey)
        const a = counts.get(left.id), b = counts.get(right.id)
        if (a === undefined || b === undefined) return a === b ? compareCharacters(left, right, 'name') : a === undefined ? 1 : -1
        return sign * (a - b) || compareCharacters(left, right, 'name')
      })
  }, [characters, counts, direction, elements, query, rarity, sortKey])
  const filtering = normalizeCharacterSearch(query).length > 0 || rarity !== 'all' || elements.length > 0
  const preparing=preparations.filter(row=>(!query||normalizeCharacterSearch(row.name).includes(normalizeCharacterSearch(query)))&&(rarity==='all'||row.rarity===rarity)&&matchesElement(row.elementKey)).slice().sort((a,b)=>{
    const stable=()=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'})||a.candidateId.localeCompare(b.candidateId)
    const left=sortKey==='rarity'?a.rarity:sortKey==='element'?a.elementKey:sortKey==='releaseDate'?a.releaseDate:a.name
    const right=sortKey==='rarity'?b.rarity:sortKey==='element'?b.elementKey:sortKey==='releaseDate'?b.releaseDate:b.name
    if(left===null||right===null)return left===right?stable():left===null?1:-1
    const compared=sortKey==='rarity'?Number(left)-Number(right):sortKey==='element'?elementKeys.indexOf(String(left) as ElementKey)-elementKeys.indexOf(String(right) as ElementKey):String(left).localeCompare(String(right),'fr',{sensitivity:'base'})
    return (direction==='asc'?1:-1)*compared||stable()
  })
  const reset = () => { setQuery(''); setRarity('all'); setElements([]); setSortKey('name'); setDirection('asc') }

  return <div data-business-pending={votes.pending} className="screen-content collection-screen catalog-screen long-screen-layout">
    <ScrollableScreenPanel className="collection-screen-panel" bodyClassName="collection-results-body scroll-content-frame" footer={<div className="collection-summary"><span>{filtering ? `${filtered.length} / ${characters.length} personnages` : `${characters.length} personnages actifs`}{preparing.length?` · ${preparing.length} en préparation`:''}</span></div>} fixed={<>
      <CollectionFilters compactToggles tutorialAnchor="catalog-filters" allowVotes allowReleaseDate placeholder="Rechercher un personnage…" query={query} rarity={rarity} element={null} elementSelection={{ elements, onChange: setElements }} sortKey={sortKey} direction={direction} onQueryChange={setQuery} onRarityChange={setRarity} onElementChange={value => setElements(value ? [value] : [])} onSortKeyChange={(key) => { setSortKey(key); if (key === 'votes' || key === 'releaseDate') setDirection('desc') }} onDirectionChange={() => setDirection((value) => value === 'asc' ? 'desc' : 'asc')} />
    </>}>
    {votes.error && <div className="catalog-vote-feedback" role="alert">{votes.error}</div>}
    {preparing.length>0&&<section className="catalog-preparation-section" aria-label="Personnages en préparation"><h2>En préparation</h2><p>Ces fiches se complètent. Elles ne participent pas encore aux Invocations.</p><div className="character-grid">{preparing.map(row=><article className="character-card catalog-preparation-card" key={row.candidateId}>
      <CharacterPortraitFrame characterName={row.name} element={row.elementKey??''} assetPaths={[row.iconPath]} order={[]} frameClassName="character-portrait" imageClassName="character-asset-image" />
      <div className="character-card-copy"><h3>{row.name}</h3><strong>En préparation</strong><p>{row.rarity?`${row.rarity}★`:'Rareté à confirmer'} · {row.elementKey??'Élément à confirmer'}</p>{row.provisional&&<p>Informations provisoires</p>}</div>
    </article>)}</div></section>}
    {filtered.length ? <section data-tutorial-anchor="catalog-votes" className="character-grid" aria-label="Catalogue des personnages">{filtered.map((character) => {
      const candidate = votes.value?.candidates.find(entry => entry.characterId === character.id)
      return <CharacterCard character={character} key={character.id} footer={<div className="catalog-vote-slot">{character.informationProvisional&&<span>Informations provisoires</span>}{candidate && <div className="catalog-character-vote"><span>{candidate.voteCount} vote{candidate.voteCount <= 1 ? '' : 's'}</span>{votes.value?.ownVote?.characterId === character.id ? <strong>Voté ✓</strong> : votes.value?.canVote && <AppButton variant="primary" aria-label={`Voter pour ${character.name} — choix définitif pour cette semaine`} disabled={votes.pending} onClick={() => void votes.vote(character.id)}>Voter</AppButton>}</div>}</div>} />
    })}</section>
      : !preparing.length&&<section className="catalog-empty" role="status"><p>Aucun personnage ne correspond à ces filtres.</p><button type="button" onClick={reset}>Réinitialiser</button></section>}
    </ScrollableScreenPanel>
  </div>
}

export default CharactersScreen
