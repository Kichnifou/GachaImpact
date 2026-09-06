import type { GachaCharacterDto } from '../api/types'
import type { Character } from '../types'
import CharacterPortraitFrame from './CharacterPortraitFrame'

type CharacterCardProps = { character: GachaCharacterDto | Character; compact?: boolean; selected?: boolean; onClick?: () => void }

function CharacterCard({ character, compact = false, selected = false, onClick }: CharacterCardProps) {
  const catalogCharacter = 'externalKey' in character ? character : null
  const legacyCharacter = catalogCharacter ? null : character as Character
  const elementKey = catalogCharacter?.elementKey ?? legacyCharacter!.tone
  const content = <>
    <CharacterPortraitFrame
      characterName={character.name}
      element={elementKey}
      assetPaths={catalogCharacter ? [catalogCharacter.iconPath, catalogCharacter.fullbodyPath, catalogCharacter.wishPath, catalogCharacter.splashPath] : undefined}
      fallback={<><span>{character.name.slice(0, 1)}</span><i /></>}
      frameClassName="character-portrait"
      imageClassName="character-asset-image"
      badgeClassName="character-element"
      badgeContainerClassName="character-card-topline"
    />
    <div className="character-card-copy">
      <h3>{character.name}</h3>
      <div className="character-rarity">{'★'.repeat(character.rarity)}</div>
      {catalogCharacter
        ? <p>{[catalogCharacter.weaponType, catalogCharacter.region].filter(Boolean).join(' · ') || elementKey}</p>
        : legacyCharacter && <div className="character-card-meta"><span>Niv. {legacyCharacter.level}</span><span>C{legacyCharacter.constellation}</span></div>}
    </div>
    {selected && <span className="selected-mark">✓</span>}
  </>
  const className = `character-card ${elementKey}${compact ? ' compact' : ''}${selected ? ' selected' : ''}`
  return onClick ? <button type="button" className={className} onClick={onClick}>{content}</button> : <article className={className}>{content}</article>
}
export default CharacterCard
