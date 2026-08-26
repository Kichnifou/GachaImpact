import CharacterCard from '../components/CharacterCard'
import CollectionFilters from '../components/CollectionFilters'
import { characters } from '../data/mockData'

function CharactersScreen() {
  const ownedCount = characters.filter((character) => character.owned).length

  return (
    <div className="screen-content collection-screen catalog-screen">
      <div className="collection-summary"><span>{ownedCount} / {characters.length} obtenus</span></div>
      <CollectionFilters placeholder="Rechercher un personnage…" />
      <section className="character-grid" aria-label="Catalogue des personnages">
        {characters.map((character) => <CharacterCard character={character} catalog key={character.id} />)}
      </section>
    </div>
  )
}

export default CharactersScreen
