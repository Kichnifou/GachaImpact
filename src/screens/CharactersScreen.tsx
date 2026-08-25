import CharacterCard from '../components/CharacterCard'
import CollectionFilters from '../components/CollectionFilters'
import ScreenHeader from '../components/ScreenHeader'
import { characters } from '../data/mockData'

function CharactersScreen() {
  const ownedCount = characters.filter((character) => character.owned).length

  return (
    <div className="screen-content collection-screen catalog-screen">
      <ScreenHeader
        eyebrow="Archives astrales"
        title="Personnages"
        description="Découvrez le catalogue de tous les personnages obtenables dans GachaImpact."
        meta={`${ownedCount} / ${characters.length} obtenus`}
      />
      <CollectionFilters placeholder="Rechercher un personnage…" />
      <div className="catalog-legend panel">
        <span><i className="legend-dot owned" /> Personnage possédé</span>
        <span><i className="legend-dot locked" /> Personnage non obtenu</span>
      </div>
      <section className="character-grid" aria-label="Catalogue des personnages">
        {characters.map((character) => <CharacterCard character={character} catalog key={character.id} />)}
      </section>
    </div>
  )
}

export default CharactersScreen
