import { useMemo, useState } from 'react'
import type { BoxCharacterDto, DailyCombatCharacterDto, DailyCombatDto, DailyCombatFightDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import BoxCharacterCard from '../components/BoxCharacterCard'
import BoxCharacterDetailModal from '../components/BoxCharacterDetailModal'
import CharacterAssetImage from '../components/CharacterAssetImage'
import CharacterShowcaseCard from '../components/CharacterShowcaseCard'
import GameAssetIcon from '../components/GameAssetIcon'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import { getElementAssetPath } from '../utils/gameAssets'

export type DailyCombatScreenProps = Readonly<{
  value: DailyCombatDto
  onSetSlot: (position: number, characterId: string) => Promise<DailyCombatDto>
  onRemoveSlot: (position: number) => Promise<DailyCombatDto>
  onCopyActive: () => Promise<DailyCombatDto>
  onAuto: () => Promise<DailyCombatDto>
  onClear: () => Promise<DailyCombatDto>
  onFight: (idempotencyKey: string) => Promise<DailyCombatFightDto>
}>

export default function DailyCombatScreen({ value, onSetSlot, onRemoveSlot, onCopyActive, onAuto, onClear, onFight }: DailyCombatScreenProps) {
  const [tab, setTab] = useState<'training' | 'boss'>('training')
  const [pickerPosition, setPickerPosition] = useState<number | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fightIntent, setFightIntent] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<DailyCombatFightDto['result'] | null>(null)
  const selectedIds = useMemo(() => new Set(value.loadout.slots.flatMap(({ character }) => character ? [character.id] : [])), [value.loadout.slots])
  const detail = value.availableCharacters.find(({ id }) => id === detailId) ?? value.loadout.slots.find(({ character }) => character?.id === detailId)?.character ?? null

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
  return <div className="screen-content activity-shell combat-shell long-screen-layout">
    <ScreenHeader eyebrow="Activités" title="Combat" description="Affrontez l’équipe ennemie du jour avec quatre personnages disponibles." />
    <ScrollableScreenPanel className="combat-frame" bodyClassName="combat-scroll-body" fixed={tabs}>
      {tab === 'boss' ? <section className="panel combat-boss-unavailable"><strong>Bientôt disponible</strong><p>Le Boss n’est pas encore implémenté.</p></section> : <>
        <section className="combat-enemies" aria-labelledby="combat-enemies-title"><header><div><span className="eyebrow">Rencontre globale · {value.businessDate}</span><h2 id="combat-enemies-title">Ennemis du jour</h2></div></header><div>{value.encounter.enemies.map(({ position, character }) => <article className={`combat-enemy-card ${character.elementKey}`} key={position}><CharacterAssetImage characterName={character.name} assetPaths={[character.iconPath, character.fullbodyPath, character.wishPath, character.splashPath]} className="combat-enemy-image" fallback={character.name.slice(0, 1)} alt={character.name} /><GameAssetIcon className="combat-element-icon" src={getElementAssetPath(character.elementKey)} fallback="✦" /><span>{String(position).padStart(2, '0')}</span><strong>{character.name}</strong><small>{'★'.repeat(character.rarity)}</small></article>)}</div></section>

        <section className="combat-loadout-section"><header className="combat-section-heading"><div><span className="eyebrow">Composition persistante</span><h2>Votre formation</h2></div><div className="combat-loadout-actions"><button type="button" disabled={Boolean(pending)} onClick={() => void mutate('copy', onCopyActive)}>Sélectionner l’équipe active</button><button type="button" disabled={Boolean(pending) || value.availableCharacterCount < 4} onClick={() => void mutate('auto', onAuto)}>Équipe automatique</button><button type="button" disabled={Boolean(pending) || selectedIds.size === 0} onClick={() => void mutate('clear', onClear)}>Vider</button></div></header>
          <div className="combat-loadout-grid">{value.loadout.slots.map(({ position, character, ko }) => <article className={`combat-slot${ko ? ' ko' : ''}`} key={position}>{character ? <CharacterShowcaseCard variant="team" name={character.name} rarity={character.rarity} element={character.elementKey} tone={character.elementKey} assetPaths={[character.iconPath, character.fullbodyPath, character.wishPath, character.splashPath]} fallback={character.name.slice(0, 1)} slot={String(position).padStart(2, '0')} constellation={character.constellation}><div className="combat-slot-actions"><button type="button" onClick={() => setDetailId(character.id)}>Fiche</button><button type="button" disabled={Boolean(pending)} onClick={() => setPickerPosition(position)}>Changer</button><button type="button" disabled={Boolean(pending)} onClick={() => void mutate(`remove-${position}`, () => onRemoveSlot(position))}>Retirer</button></div>{ko && <span className="combat-ko-badge">💀 KO · Disponible demain</span>}</CharacterShowcaseCard> : <button type="button" className="combat-empty-slot" disabled={Boolean(pending)} onClick={() => setPickerPosition(position)}><span>{String(position).padStart(2, '0')}</span><strong>Ajouter</strong><small>Choisir un personnage</small></button>}</article>)}</div>
        </section>

        <section className="panel combat-preview"><div><span className="eyebrow">Chance de victoire</span><strong>{value.preview ? `${halfPoint(value.preview.finalHalfPoints)} %` : 'Composition incomplète'}</strong><small>{value.loadout.nextAttemptMode === 'AUTO' ? 'Prochaine tentative : Auto' : 'Prochaine tentative : Manuelle'}</small></div>{value.preview && <details><summary>Détails du calcul</summary><dl><div><dt>Base</dt><dd>{halfPoint(value.preview.baseHalfPoints)} %</dd></div><div><dt>Rareté</dt><dd>+{halfPoint(value.preview.rarityBonusHalfPoints)}</dd></div><div><dt>Constellations</dt><dd>+{halfPoint(value.preview.constellationBonusHalfPoints)}</dd></div><div><dt>Avantages ({value.preview.favorableMatchups})</dt><dd>+{halfPoint(value.preview.favorableBonusHalfPoints)}</dd></div><div><dt>Désavantages ({value.preview.unfavorableMatchups})</dt><dd>−{halfPoint(value.preview.unfavorableMalusHalfPoints)}</dd></div><div><dt>Brut</dt><dd>{halfPoint(value.preview.rawHalfPoints)} %</dd></div><div><dt>Final{value.preview.clamp ? ' · clamp' : ''}</dt><dd>{halfPoint(value.preview.finalHalfPoints)} %</dd></div></dl></details>}</section>

        <section className={`panel combat-resolution ${value.status.toLowerCase()}`}><div><strong>{resultTitle(value, lastResult)}</strong><p>{resultDetail(value, lastResult)}</p>{(lastResult?.won || value.status === 'COMPLETED') && <small>Obtenu : +{formatResourceAmount(value.reward.primogems)} Primogemmes · +{formatResourceAmount(value.reward.moras)} Moras</small>}{error && <p className="combat-error" role="alert">{error}</p>}</div><button type="button" className="small-primary-button" disabled={!value.canFight || Boolean(pending)} onClick={() => void fight()}>{pending === 'fight' ? 'Combat…' : fightIntent ? 'Réessayer' : 'Combattre'}</button></section>
      </>}
    </ScrollableScreenPanel>
    {pickerPosition !== null && <CombatPicker value={value} selectedIds={selectedIds} position={pickerPosition} pending={Boolean(pending)} onClose={() => setPickerPosition(null)} onSelect={(characterId) => void mutate(`slot-${pickerPosition}`, async () => { await onSetSlot(pickerPosition, characterId); setPickerPosition(null) })} />}
    {detail && <BoxCharacterDetailModal character={asBoxCharacter(detail)} combatState={{ ko: value.koCharacterIds.includes(detail.id), stats: detail.combatStats }} showStella={false} stellaQuantity="0" stellaRetryAvailable={false} favoritePending={false} stellaPending={false} stellaFeedback={null} onUseStella={() => undefined} onClose={() => setDetailId(null)} />}
  </div>
}

function CombatPicker({ value, selectedIds, position, pending, onClose, onSelect }: { value: DailyCombatDto; selectedIds: ReadonlySet<string>; position: number; pending: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  const currentId = value.loadout.slots.find((slot) => slot.position === position)?.character?.id
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel combat-picker" role="dialog" aria-modal="true" aria-labelledby="combat-picker-title" onMouseDown={(event) => event.stopPropagation()}><header className="floating-panel-heading"><div><span className="eyebrow">Emplacement {position}</span><h2 id="combat-picker-title">Choisir un personnage</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button></header><div className="combat-picker-grid">{value.availableCharacters.map((character) => { const ko = value.koCharacterIds.includes(character.id); const used = selectedIds.has(character.id) && character.id !== currentId; return <BoxCharacterCard character={asBoxCharacter(character)} disabled={pending || ko || used} statusLabel={ko ? '💀 KO · Disponible demain' : used ? 'Déjà sélectionné' : undefined} showFavorite={false} onOpen={() => onSelect(character.id)} onToggleFavorite={() => undefined} key={character.id} /> })}</div></section></div>
}

function asBoxCharacter(character: DailyCombatCharacterDto): BoxCharacterDto { return { ...character, c6CompetitionStats: null } }
function halfPoint(value: number) { const whole = Math.trunc(value / 2); return value % 2 === 0 ? String(whole) : `${whole},5` }
function resultTitle(value: DailyCombatDto, result: DailyCombatFightDto['result'] | null) { if (result?.won || value.status === 'COMPLETED') return 'Victoire !'; if (result && !result.won || value.lastAttempt && !value.lastAttempt.won) return 'Défaite'; if (value.status === 'BLOCKED') return 'Bloqué aujourd’hui'; return 'Prêt pour le Combat quotidien' }
function resultDetail(value: DailyCombatDto, result: DailyCombatFightDto['result'] | null) { if (result?.won || value.status === 'COMPLETED') return 'Victoire obtenue aujourd’hui.'; if (result && !result.won || value.lastAttempt && !value.lastAttempt.won) return 'Les personnages utilisés sont KO jusqu’à demain.'; if (value.status === 'BLOCKED') return 'Moins de 4 personnages non-KO sont disponibles.'; return 'Sélectionnez quatre personnages actifs et non-KO.' }
