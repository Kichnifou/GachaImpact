import type { GachaCharacterDto } from '../api/types'
import CharacterCard from '../components/CharacterCard'
import CollectionFilters from '../components/CollectionFilters'

function CharactersScreen({ characters }: { characters: readonly GachaCharacterDto[] }) {
  return <div className="screen-content collection-screen catalog-screen">
    <div className="collection-summary"><span>{characters.length} personnages actifs</span></div>
    <CollectionFilters placeholder="Rechercher un personnage…" />
    <section className="character-grid" aria-label="Catalogue des personnages">{characters.map((character) => <CharacterCard character={character} key={character.id} />)}</section>
  </div>
}
export default CharactersScreen
