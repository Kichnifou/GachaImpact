import type { GachaCharacterDto } from '../api/types'
import type { Character } from '../types'
import { getElementAssetPath } from '../utils/gameAssets'
import CharacterAssetImage from './CharacterAssetImage'
import GameAssetIcon from './GameAssetIcon'

type CharacterCardProps = { character: GachaCharacterDto | Character; compact?: boolean; selected?: boolean; onClick?: () => void }

function CharacterCard({ character, compact = false, selected = false, onClick }: CharacterCardProps) {
  const catalogCharacter = 'externalKey' in character ? character : null
  const legacyCharacter = catalogCharacter ? null : character as Character
  const elementKey = catalogCharacter?.elementKey ?? legacyCharacter!.tone
  const content = <>
    <div className="character-card-topline"><GameAssetIcon className="character-element" src={getElementAssetPath(elementKey, 'badge')} fallback="✦" title={elementKey} /></div>
    <div className="character-portrait" aria-hidden="true"><CharacterAssetImage characterName={character.name} className="character-asset-image" assetPaths={catalogCharacter ? [catalogCharacter.iconPath, catalogCharacter.fullbodyPath, catalogCharacter.splashPath, catalogCharacter.wishPath] : undefined} fallback={<><span>{character.name.slice(0, 1)}</span><i /></>} /></div>
    <div className="character-card-copy"><h3>{character.name}</h3><div className="character-rarity">{'★'.repeat(character.rarity)}</div><p>{catalogCharacter ? ([catalogCharacter.weaponType, catalogCharacter.region].filter(Boolean).join(' · ') || elementKey) : `Niv. ${legacyCharacter!.level} · ${legacyCharacter!.role}`}</p></div>
    {selected && <span className="selected-mark">✓</span>}
  </>
  const className = `character-card ${elementKey}${compact ? ' compact' : ''}${selected ? ' selected' : ''}`
  return onClick ? <button type="button" className={className} onClick={onClick}>{content}</button> : <article className={className}>{content}</article>
}
export default CharacterCard
