import type { BoxCharacterDto } from '../api/types'
import CharacterPortraitFrame from './CharacterPortraitFrame'

function BoxCharacterCard({ character, onOpen, onToggleFavorite, favoritePending = false }: {
  character: BoxCharacterDto
  onOpen: () => void
  onToggleFavorite: () => void
  favoritePending?: boolean
}) {
  return <article className={`character-card box-character-card ${character.elementKey}`}>
    <button type="button" className="box-card-open" onClick={onOpen} aria-label={`Ouvrir la fiche de ${character.name}`}>
      <CharacterPortraitFrame
        characterName={character.name}
        element={character.elementKey}
        assetPaths={[character.iconPath, character.fullbodyPath, character.wishPath, character.splashPath]}
        fallback={<><span>{character.name.slice(0, 1)}</span><i /></>}
        frameClassName="character-portrait"
        imageClassName="character-asset-image"
        badgeClassName="character-element"
        badgeContainerClassName="character-card-topline"
      />
      <div className="character-card-copy">
        <h3>{character.name}</h3>
        <div className="character-rarity">{'★'.repeat(character.rarity)}</div>
        <div className="character-card-meta"><span>{character.elementKey}</span><strong>C{character.constellation}</strong></div>
      </div>
    </button>
    <button
      type="button"
      className={`box-favorite-button${character.favorite ? ' active' : ''}`}
      aria-label={`${character.favorite ? 'Retirer' : 'Ajouter'} ${character.name} ${character.favorite ? 'des' : 'aux'} favoris`}
      aria-pressed={character.favorite}
      disabled={favoritePending}
      onClick={onToggleFavorite}
    >★</button>
  </article>
}

export default BoxCharacterCard
