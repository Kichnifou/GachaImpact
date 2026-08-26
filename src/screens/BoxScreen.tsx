import CharacterCard from '../components/CharacterCard'
import CollectionFilters from '../components/CollectionFilters'
import { characters } from '../data/mockData'

function BoxScreen() {
  const ownedCharacters = characters.filter((character) => character.owned)

  return (
    <div className="screen-content collection-screen box-screen">
      <div className="collection-summary"><span>{ownedCharacters.length} personnages obtenus</span></div>
      <CollectionFilters placeholder="Rechercher dans votre Box…" />
      <section className="character-grid" aria-label="Personnages possédés">
        {ownedCharacters.map((character) => <CharacterCard character={character} key={character.id} />)}
      </section>
    </div>
  )
}

export default BoxScreen
