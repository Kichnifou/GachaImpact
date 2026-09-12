import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { BoxCharacterDto, DailyCombatCharacterDto, DailyCombatDto, DailyCombatFightDto, ElementKey, PlayerBoxDto, StellaUseDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { useBoxCollection } from '../box/use-box-collection'
import BoxCharacterCard from '../components/BoxCharacterCard'
import BoxCharacterDetailModal from '../components/BoxCharacterDetailModal'
import CharacterAssetImage from '../components/CharacterAssetImage'
import GameAssetIcon from '../components/GameAssetIcon'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage, elementLabels, formatResourceAmount } from '../utils/formatters'
import { getElementAssetPath } from '../utils/gameAssets'

export type DailyCombatBoxBindings = Readonly<{
  initialBox: PlayerBoxDto | null
  onLoadBox: () => Promise<PlayerBoxDto>
  onSetFavorite: (characterId: string, favorite: boolean) => Promise<BoxCharacterDto>
  onUseStella: (characterId: string) => Promise<StellaUseDto>
  stellaRetryCharacterId: string | null
  onCharacterProgressed?: () => Promise<unknown> | unknown
}>

export type DailyCombatScreenProps = Readonly<{
  value: DailyCombatDto
  box?: DailyCombatBoxBindings
  onSetSlot: (position: number, characterId: string) => Promise<DailyCombatDto>
  onRemoveSlot: (position: number) => Promise<DailyCombatDto>
  onCopyActive: () => Promise<DailyCombatDto>
  onAuto: () => Promise<DailyCombatDto>
  onClear: () => Promise<DailyCombatDto>
  onFight: (idempotencyKey: string) => Promise<DailyCombatFightDto>
}>

export default function DailyCombatScreen({ value, box, onSetSlot, onRemoveSlot, onCopyActive, onAuto, onClear, onFight }: DailyCombatScreenProps) {
  const [tab, setTab] = useState<'training' | 'boss'>('training')
  const [pickerPosition, setPickerPosition] = useState<number | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [calculationOpen, setCalculationOpen] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fightIntent, setFightIntent] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<DailyCombatFightDto['result'] | null>(null)
  const selectedIds = useMemo(() => new Set(value.loadout.slots.flatMap(({ character }) => character ? [character.id] : [])), [value.loadout.slots])

  const mutate = async (key: string, action: () => Promise<unknown>) => {
    if (pending) return
    setPending(key); setError(null)
    try { await action() }
    catch (reason) { setError(apiErrorMessage(reason)) }
    finally { setPending(null) }
  }
  const fight = async () => {
    if (pending) return
    const key = fightIntent ?? crypto.randomUUID()
    setFightIntent(key); setPending('fight'); setError(null)
    try { const result = await onFight(key); setLastResult(result.result); setFightIntent(null) }
    catch (reason) { if (!isAmbiguousMutationError(reason)) setFightIntent(null); setError(apiErrorMessage(reason)) }
    finally { setPending(null) }
  }

  const tabs = <nav className="activity-inner-tabs combat-tabs" aria-label="Sections Combat"><button type="button" className={tab === 'training' ? 'active' : ''} onClick={() => setTab('training')}>Entraînement</button><button type="button" className={tab === 'boss' ? 'active' : ''} onClick={() => setTab('boss')}>Boss</button></nav>
  const feedback = combatFeedback(value, lastResult, error)
  return <div className="screen-content activity-shell combat-shell long-screen-layout">
    <ScreenHeader eyebrow="Activités" title="Combat" description="Affrontez l’équipe ennemie du jour avec quatre personnages disponibles." />
    <ScrollableScreenPanel className="combat-frame" bodyClassName="combat-scroll-body" fixed={tabs}>
      {tab === 'boss' ? <section className="panel combat-boss-unavailable"><strong>Bientôt disponible</strong><p>Le Boss n’est pas encore implémenté.</p></section> : <>
        <section className="combat-enemies" aria-labelledby="combat-enemies-title"><header className="combat-section-heading combat-enemy-heading"><h2 id="combat-enemies-title">Ennemis</h2></header><div className="combat-card-grid">{value.encounter.enemies.map((enemy) => <EnemyCombatCard enemy={enemy} key={enemy.position} />)}</div></section>

        <section className="panel combat-command-bar" aria-labelledby="combat-command-title">
          <div className="combat-command-title"><strong id="combat-command-title">Rencontre du jour</strong></div>
          <button type="button" className="small-primary-button combat-fight-button" disabled={!value.canFight || Boolean(pending)} onClick={() => void fight()}>{pending === 'fight' ? 'Combat…' : fightIntent ? 'Réessayer' : 'Combattre'}</button>
          <div className="combat-command-chance"><span className="sr-only">Chance de victoire</span><strong aria-label={value.preview ? `Chance de victoire : ${halfPoint(value.preview.finalHalfPoints)} pour cent` : 'Chance de victoire indisponible'}>{value.preview ? `${halfPoint(value.preview.finalHalfPoints)} %` : '— %'}</strong><button type="button" disabled={!value.preview} onClick={() => setCalculationOpen(true)}>Détails du calcul →</button><small>{value.loadout.nextAttemptMode === 'AUTO' ? 'Mode : Auto' : 'Mode : Manuel'}</small></div>
          <div className={`combat-feedback-slot${error ? ' error' : lastResult?.won || value.status === 'COMPLETED' ? ' victory' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite"><span>{feedback ?? '\u00a0'}</span></div>
        </section>

        <section className="combat-loadout-section"><header className="combat-section-heading"><h2>Votre formation</h2><div className="combat-loadout-actions"><button type="button" disabled={Boolean(pending)} onClick={() => void mutate('copy', onCopyActive)}>Sélectionner l’équipe active</button><button type="button" disabled={Boolean(pending) || value.availableCharacterCount < 4} onClick={() => void mutate('auto', onAuto)}>Équipe automatique</button><button type="button" disabled={Boolean(pending) || selectedIds.size === 0} onClick={() => void mutate('clear', onClear)}>Vider</button></div></header>
          <div className="combat-card-grid combat-loadout-grid">{value.loadout.slots.map(({ position, character, ko }) => character
            ? <PlayerCombatCard character={character} position={position} ko={ko} pending={Boolean(pending)} canOpenDetail={Boolean(box)} onOpenDetail={() => setDetailId(character.id)} onChange={() => setPickerPosition(position)} onRemove={() => void mutate(`remove-${position}`, () => onRemoveSlot(position))} key={position} />
            : <button type="button" className="combat-character-card combat-empty-slot" disabled={Boolean(pending)} onClick={() => setPickerPosition(position)} key={position}><span>{String(position).padStart(2, '0')}</span><strong>Ajouter</strong><small>Choisir un personnage</small></button>)}</div>
        </section>
      </>}
    </ScrollableScreenPanel>
    {pickerPosition !== null && <CombatPicker value={value} selectedIds={selectedIds} position={pickerPosition} pending={Boolean(pending)} onClose={() => setPickerPosition(null)} onSelect={(characterId) => void mutate(`slot-${pickerPosition}`, async () => { await onSetSlot(pickerPosition, characterId); setPickerPosition(null) })} />}
    {calculationOpen && value.preview && <CombatCalculationModal preview={value.preview} onClose={() => setCalculationOpen(false)} />}
    {detailId && box && <CombatBoxCharacterDetail characterId={detailId} combat={value} bindings={box} onClose={() => setDetailId(null)} />}
  </div>
}

type Enemy = DailyCombatDto['encounter']['enemies'][number]

function EnemyCombatCard({ enemy }: { enemy: Enemy }) {
  return <article className={`combat-character-card combat-enemy-card ${enemy.character.elementKey}`} data-position={enemy.position}>
    <CombatPortrait character={enemy.character} />
    <div className="combat-card-info"><div className="combat-card-name"><ElementIcon element={enemy.character.elementKey} /><strong>{enemy.character.name}</strong></div><span className="combat-card-rarity">{'★'.repeat(enemy.character.rarity)}</span><div className="combat-matchups"><MatchupIcons label="Faible" elements={enemy.weakAgainstElements} /><MatchupIcons label="Résistant" elements={enemy.resistantAgainstElements} /></div></div>
  </article>
}

function PlayerCombatCard({ character, position, ko, pending, canOpenDetail, onOpenDetail, onChange, onRemove }: { character: DailyCombatCharacterDto; position: number; ko: boolean; pending: boolean; canOpenDetail: boolean; onOpenDetail: () => void; onChange: () => void; onRemove: () => void }) {
  return <article className={`combat-character-card combat-player-card ${character.elementKey}${ko ? ' ko' : ''}`} data-position={position}>
    <CombatPortrait character={character} />
    <div className="combat-card-info"><div className="combat-card-name"><ElementIcon element={character.elementKey} /><strong>{character.name}</strong></div><span className="combat-card-rarity">{'★'.repeat(character.rarity)}</span><span className="combat-card-constellation">C{character.constellation}</span></div>
    {ko && <span className="combat-ko-badge">💀 KO · Demain</span>}
    <div className="combat-slot-actions"><button type="button" disabled={!canOpenDetail} onClick={onOpenDetail}>Fiche</button><button type="button" disabled={pending} onClick={onChange}>Changer</button><button type="button" disabled={pending} onClick={onRemove}>Retirer</button></div>
  </article>
}

function CombatPortrait({ character }: { character: Pick<DailyCombatCharacterDto, 'name' | 'iconPath' | 'fullbodyPath' | 'wishPath' | 'splashPath'> }) {
  return <div className="combat-card-art"><span className="combat-card-fallback">{character.name.slice(0, 1)}</span><CharacterAssetImage characterName={character.name} assetPaths={[character.fullbodyPath, character.wishPath, character.splashPath, character.iconPath]} className="combat-card-image" fallback={null} alt="" /></div>
}

function ElementIcon({ element }: { element: ElementKey }) {
  return <span className="combat-element-accessible" role="img" aria-label={`Élément ${elementLabels[element]}`} title={`Élément ${elementLabels[element]}`}><GameAssetIcon className="combat-element-icon" src={getElementAssetPath(element)} fallback="✦" /></span>
}

function MatchupIcons({ label, elements }: { label: string; elements: readonly ElementKey[] }) {
  return <div><span>{label} :</span><div>{elements.map((element) => <ElementIcon element={element} key={element} />)}</div></div>
}

function CombatCalculationModal({ preview, onClose }: { preview: NonNullable<DailyCombatDto['preview']>; onClose: () => void }) {
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [onClose])
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel combat-calculation-modal" role="dialog" aria-modal="true" aria-labelledby="combat-calculation-title" onMouseDown={(event) => event.stopPropagation()}><header className="floating-panel-heading"><div><span className="eyebrow">Chance de victoire</span><h2 id="combat-calculation-title">Détails du calcul</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer les détails"><span className="icon-glyph">×</span></button></header><div className="combat-calculation-body">
    <section className="combat-calculation-base" aria-label="Chance de base"><span>Base</span><strong>{halfPoint(preview.baseHalfPoints)} %</strong></section>
    <section className="combat-calculation-group bonus" aria-label="Bonus"><h3>Bonus</h3><dl><CalculationStat label="Rareté" value={`+${halfPoint(preview.rarityBonusHalfPoints)} %`} /><CalculationStat label="Constellations" value={`+${halfPoint(preview.constellationBonusHalfPoints)} %`} /><CalculationStat label={`Avantages (${preview.favorableMatchups})`} value={`+${halfPoint(preview.favorableBonusHalfPoints)} %`} /></dl></section>
    <section className="combat-calculation-group malus" aria-label="Malus"><h3>Malus</h3><dl><CalculationStat label={`Désavantages (${preview.unfavorableMatchups})`} value={`−${halfPoint(preview.unfavorableMalusHalfPoints)} %`} /></dl></section>
    <section className="combat-calculation-result" aria-label={`Chance finale : ${halfPoint(preview.finalHalfPoints)} pour cent`}><span>Résultat</span><strong>{halfPoint(preview.finalHalfPoints)} %</strong><small>Chance finale</small></section>
    {preview.clamp && <p className="combat-calculation-clamp">Limite appliquée : {halfPoint(preview.finalHalfPoints)} %</p>}
  </div></section></div>
}

function CalculationStat({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }

function CombatPicker({ value, selectedIds, position, pending, onClose, onSelect }: { value: DailyCombatDto; selectedIds: ReadonlySet<string>; position: number; pending: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  const currentId = value.loadout.slots.find((slot) => slot.position === position)?.character?.id
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel combat-picker" role="dialog" aria-modal="true" aria-labelledby="combat-picker-title" onMouseDown={(event) => event.stopPropagation()}><header className="floating-panel-heading"><div><span className="eyebrow">Emplacement {position}</span><h2 id="combat-picker-title">Choisir un personnage</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button></header><div className="combat-picker-grid">{value.availableCharacters.map((character) => { const ko = value.koCharacterIds.includes(character.id); const used = selectedIds.has(character.id) && character.id !== currentId; return <BoxCharacterCard character={asBoxCharacter(character)} disabled={pending || ko || used} statusLabel={ko ? '💀 KO · Disponible demain' : used ? 'Déjà sélectionné' : undefined} showFavorite={false} onOpen={() => onSelect(character.id)} onToggleFavorite={() => undefined} key={character.id} /> })}</div></section></div>
}

function CombatBoxCharacterDetail({ characterId, combat, bindings, onClose }: { characterId: string; combat: DailyCombatDto; bindings: DailyCombatBoxBindings; onClose: () => void }) {
  const detail = useBoxCollection({ initialBox: bindings.initialBox, onLoadBox: bindings.onLoadBox, onSetFavorite: bindings.onSetFavorite, onUseStella: bindings.onUseStella, stellaRetryCharacterId: bindings.stellaRetryCharacterId, onCharacterProgressed: bindings.onCharacterProgressed })
  const character = detail.box?.characters.find(({ id }) => id === characterId) ?? null
  const combatCharacter = combat.availableCharacters.find(({ id }) => id === characterId)
  const combatState = combatCharacter ? { ko: combat.koCharacterIds.includes(characterId), stats: combatCharacter.combatStats } : undefined
  if (!detail.box && !detail.error) return <CombatDetailStatus title="Ouverture de la fiche…" detail="Chargement de votre possession." onClose={onClose} />
  if (!detail.box || !character) return <CombatDetailStatus title="Fiche indisponible" detail={detail.error ?? 'Ce personnage ne figure plus dans votre Box.'} onClose={onClose} />
  return <BoxCharacterDetailModal character={character} combatState={combatState} stellaQuantity={detail.box.stella.quantity} stellaRetryAvailable={detail.stellaRetryId === character.id} favoritePending={detail.favoritePendingId === character.id} stellaPending={detail.stellaPendingId === character.id} stellaFeedback={detail.stellaFeedback} actionError={detail.error} onToggleFavorite={() => void detail.toggleFavorite(character)} onUseStella={() => void detail.useStella(character)} onClose={onClose} />
}

function CombatDetailStatus({ title, detail, onClose }: { title: string; detail: string; onClose: () => void }) {
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel combat-detail-status" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button><strong>{title}</strong><p>{detail}</p></section></div>
}

function asBoxCharacter(character: DailyCombatCharacterDto): BoxCharacterDto { return { ...character, c6CompetitionStats: null } }
function halfPoint(value: number) { const whole = Math.trunc(value / 2); return value % 2 === 0 ? String(whole) : `${whole},5` }
function combatFeedback(value: DailyCombatDto, result: DailyCombatFightDto['result'] | null, error: string | null): ReactNode {
  if (error) return error
  if (result?.won || value.status === 'COMPLETED') return <>✅ Victoire · Obtenu : +{formatResourceAmount(value.reward.primogems)} Primogemmes · +{formatResourceAmount(value.reward.moras)} Moras</>
  if (result && !result.won || value.lastAttempt && !value.lastAttempt.won) return 'Défaite · 4 personnages KO jusqu’à demain.'
  if (value.status === 'BLOCKED') return 'Bloqué · Moins de 4 personnages disponibles.'
  if (!value.canFight) return 'Sélectionnez 4 personnages disponibles.'
  return 'Formation prête.'
}
