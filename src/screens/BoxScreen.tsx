import CharacterCard from '../components/CharacterCard'
import CollectionFilters from '../components/CollectionFilters'
import ScreenHeader from '../components/ScreenHeader'
import { characters } from '../data/mockData'

function BoxScreen() {
  const ownedCharacters = characters.filter((character) => character.owned)

  return (
    <div className="screen-content collection-screen box-screen">
      <ScreenHeader
        eyebrow="Votre collection"
        title="Box"
        description="Retrouvez tous les personnages actuellement possédés par votre voyageur."
        meta={`${ownedCharacters.length} personnages obtenus`}
      />
      <CollectionFilters placeholder="Rechercher dans votre Box…" />
      <section className="character-grid" aria-label="Personnages possédés">
        {ownedCharacters.map((character) => <CharacterCard character={character} key={character.id} />)}
      </section>
    </div>
  )
}

export default BoxScreen
