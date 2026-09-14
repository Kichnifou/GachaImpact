import type { BoxCharacterDto, DailyCombatDto, ElementKey, PlayerBoxDto, StellaUseDto } from '../api/types'
import { useBoxCollection } from '../box/use-box-collection'
import { elementLabels } from '../utils/formatters'
import { getElementAssetPath } from '../utils/gameAssets'
import BoxCharacterDetailModal from './BoxCharacterDetailModal'
import CharacterAssetImage from './CharacterAssetImage'
import GameAssetIcon from './GameAssetIcon'

export type CombatBoxBindings = Readonly<{
  initialBox: PlayerBoxDto | null
  onLoadBox: () => Promise<PlayerBoxDto>
  onSetFavorite: (characterId: string, favorite: boolean) => Promise<BoxCharacterDto>
  onUseStella: (characterId: string) => Promise<StellaUseDto>
  stellaRetryCharacterId: string | null
  onCharacterProgressed?: () => Promise<unknown> | unknown
}>

export type FormationCharacter = Pick<BoxCharacterDto, 'id' | 'name' | 'iconPath' | 'fullbodyPath' | 'wishPath' | 'splashPath' | 'elementKey' | 'rarity' | 'constellation'>

export function PlayerCombatCard({ character, position, ko = false, pending, canOpenDetail, onOpenDetail, onChange, onRemove }: { character: FormationCharacter; position: number; ko?: boolean; pending: boolean; canOpenDetail: boolean; onOpenDetail: () => void; onChange: () => void; onRemove: () => void }) {
  return <article className={`combat-character-card combat-player-card ${character.elementKey}${ko ? ' ko' : ''}`} data-position={position}>
    <CombatPortrait character={character} />
    <div className="combat-card-info"><div className="combat-card-name"><ElementIcon element={character.elementKey} /><strong>{character.name}</strong></div><span className="combat-card-rarity">{'★'.repeat(character.rarity)}</span><span className="combat-card-constellation">C{character.constellation}</span></div>
    {ko && <span className="combat-ko-badge">💀 KO</span>}
    <div className="combat-slot-actions"><button type="button" disabled={!canOpenDetail} onClick={onOpenDetail}>Fiche</button><button type="button" disabled={pending} onClick={onChange}>Changer</button><button type="button" disabled={pending} onClick={onRemove}>Retirer</button></div>
  </article>
}

export function CombatPortrait({ character }: { character: Pick<FormationCharacter, 'name' | 'iconPath' | 'fullbodyPath' | 'wishPath' | 'splashPath'> }) {
  return <div className="combat-card-art"><span className="combat-card-fallback">{character.name.slice(0, 1)}</span><CharacterAssetImage characterName={character.name} assetPaths={[character.fullbodyPath, character.wishPath, character.splashPath, character.iconPath]} className="combat-card-image" fallback={null} alt="" /></div>
}

export function ElementIcon({ element }: { element: ElementKey }) {
  return <span className="combat-element-accessible" role="img" aria-label={`Élément ${elementLabels[element]}`} title={`Élément ${elementLabels[element]}`}><GameAssetIcon className="combat-element-icon" src={getElementAssetPath(element)} fallback="✦" /></span>
}

export function CombatBoxCharacterDetail({ characterId, combat, bindings, onClose }: { characterId: string; combat?: DailyCombatDto; bindings: CombatBoxBindings; onClose: () => void }) {
  const detail = useBoxCollection({ initialBox: bindings.initialBox, onLoadBox: bindings.onLoadBox, onSetFavorite: bindings.onSetFavorite, onUseStella: bindings.onUseStella, stellaRetryCharacterId: bindings.stellaRetryCharacterId, onCharacterProgressed: bindings.onCharacterProgressed })
  const character = detail.box?.characters.find(({ id }) => id === characterId) ?? null
  const combatCharacter = combat?.availableCharacters.find(({ id }) => id === characterId)
  const combatState = combatCharacter && combat ? { ko: combat.koCharacterIds.includes(characterId), stats: combatCharacter.combatStats } : undefined
  if (!detail.box && !detail.error) return <CombatDetailStatus title="Ouverture de la fiche…" detail="Chargement de votre possession." onClose={onClose} />
  if (!detail.box || !character) return <CombatDetailStatus title="Fiche indisponible" detail={detail.error ?? 'Ce personnage ne figure plus dans votre Box.'} onClose={onClose} />
  return <BoxCharacterDetailModal character={character} combatState={combatState} stellaQuantity={detail.box.stella.quantity} stellaRetryAvailable={detail.stellaRetryId === character.id} favoritePending={detail.favoritePendingId === character.id} stellaPending={detail.stellaPendingId === character.id} stellaFeedback={detail.stellaFeedback} actionError={detail.error} onToggleFavorite={() => void detail.toggleFavorite(character)} onUseStella={() => void detail.useStella(character)} onClose={onClose} />
}

function CombatDetailStatus({ title, detail, onClose }: { title: string; detail: string; onClose: () => void }) {
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel combat-detail-status" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button><strong>{title}</strong><p>{detail}</p></section></div>
}
