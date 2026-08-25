import type { Character } from '../types'
import { getElementAssetPath } from '../utils/gameAssets'
import CharacterAssetImage from './CharacterAssetImage'
import GameAssetIcon from './GameAssetIcon'

type CharacterCardProps = {
  character: Character
  catalog?: boolean
  compact?: boolean
  selected?: boolean
  onClick?: () => void
}

function CharacterCard({ character, catalog = false, compact = false, selected = false, onClick }: CharacterCardProps) {
  const className = [
    'character-card',
    character.tone,
    !character.owned && catalog ? 'locked' : '',
    compact ? 'compact' : '',
    selected ? 'selected' : '',
  ].filter(Boolean).join(' ')

  const content = (
    <>
      <div className="character-card-topline">
        <GameAssetIcon
          className="character-element"
          src={getElementAssetPath(character.element, 'badge')}
          fallback={character.elementIcon}
          title={character.element}
        />
        {character.owned ? <span className="constellation">C{character.constellation}</span> : <span className="lock-mark">⌑</span>}
      </div>
      <div className="character-portrait" aria-hidden="true">
        <CharacterAssetImage
          characterName={character.name}
          className="character-asset-image"
          fallback={<><span>{character.name.slice(0, 1)}</span><i /></>}
        />
      </div>
      <div className="character-card-copy">
        <div className="character-rarity">{'★'.repeat(character.rarity)}</div>
        <h3>{character.name}</h3>
        <p>{catalog && !character.owned ? 'Non obtenu' : `Niv. ${character.level} · ${character.role}`}</p>
      </div>
      {selected && <span className="selected-mark">✓</span>}
    </>
  )

  if (onClick) {
    return <button type="button" className={className} onClick={onClick}>{content}</button>
  }

  return <article className={className}>{content}</article>
}

export default CharacterCard
