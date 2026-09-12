import { useEffect, useRef, useState } from 'react'
import type { BoxCharacterDto, ExpeditionDto } from '../api/types'
import type { StellaResultPresentation } from '../box/stella-result-presentation'
import { c6StatLabel } from '../gacha/pull-result-presentation'
import { getElementAssetPath } from '../utils/gameAssets'
import { expeditionInitialNow, formatRemaining } from '../expedition/expedition-presentation'
import CharacterPortraitFrame from './CharacterPortraitFrame'
import GameAssetIcon from './GameAssetIcon'

const c6Stats = ['strength', 'intelligence', 'beauty', 'charisma', 'popularity'] as const
const idleExpedition: ExpeditionDto = { businessDate: '', operationalStatus: 'IDLE', departureUsedToday: false, canStartToday: false, activeCharacter: null, departedAt: null, readyAt: null, remainingSeconds: 0, startedOnCurrentBusinessDate: false, totalCompleted: '0' }

function BoxCharacterDetailModal({ character, combatState, expedition = idleExpedition, expeditionPending = false, expeditionFeedback = null, showStella = true, stellaQuantity, stellaRetryAvailable, favoritePending, stellaPending, stellaFeedback, actionError, onToggleFavorite, onUseStella, onStartExpedition = () => undefined, onClaimExpedition = () => undefined, onClose }: {
  character: BoxCharacterDto
  combatState?: Readonly<{ ko: boolean; stats: Readonly<{ fights: string; wins: string; losses: string; winRatePercent: number }> }>
  expedition?: ExpeditionDto
  expeditionPending?: boolean
  expeditionFeedback?: string | null
  showStella?: boolean
  stellaQuantity: string
  stellaRetryAvailable: boolean
  favoritePending: boolean
  stellaPending: boolean
  stellaFeedback: StellaResultPresentation | null
  actionError?: string | null
  onToggleFavorite?: () => void
  onUseStella: () => void
  onStartExpedition?: () => void
  onClaimExpedition?: () => void
  onClose: () => void
}) {
  const [confirmingStella, setConfirmingStella] = useState(false)
  const [showCombatDetails, setShowCombatDetails] = useState(false)
  const [now, setNow] = useState(() => expeditionInitialNow(expedition))
  const stellaSubmitted = useRef(false)
  const hasStella = /^\d+$/.test(stellaQuantity) && BigInt(stellaQuantity) > 0n
  const c6CompetitionStats = character.c6CompetitionStats

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (showCombatDetails) setShowCombatDetails(false); else onClose() } }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, showCombatDetails])
  useEffect(() => { if (expedition.operationalStatus !== 'RUNNING') return; const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer) }, [expedition.operationalStatus])
  const isExpeditionCharacter = expedition.activeCharacter?.id === character.id

  return <><div className="modal-layer" role="presentation" onMouseDown={onClose}>
    <section className={`floating-panel box-detail-modal ${character.elementKey}`} role="dialog" aria-modal="true" aria-label={`Fiche du personnage possédé ${character.name}`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="floating-panel-heading">
        <span className="eyebrow">Personnage possédé</span>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer la fiche"><span className="icon-glyph">×</span></button>
      </header>
      <div className="box-detail-content">
        <div className="box-detail-artwork">
          <CharacterPortraitFrame
            characterName={character.name}
            element={character.elementKey}
            assetPaths={[character.iconPath, character.fullbodyPath, character.wishPath, character.splashPath]}
            fallback={<><span>{character.name.slice(0, 1)}</span><i /></>}
            frameClassName="box-detail-portrait"
            imageClassName="box-detail-image"
          />
        </div>
        <div className="box-detail-copy">
          <div className="box-detail-heading">
            <div className="box-detail-name-row">
              <div className="box-detail-name-and-favorite">
                <h2 className="box-detail-character-name">{character.name}</h2>
                <button type="button" className={`box-detail-favorite-star${character.favorite ? ' active' : ''}`} aria-label={character.favorite ? `Retirer ${character.name} des favoris` : `Ajouter ${character.name} aux favoris`} aria-pressed={character.favorite} disabled={favoritePending || !onToggleFavorite} onClick={onToggleFavorite}>
                  <span aria-hidden="true">{character.favorite ? '★' : '☆'}</span>
                </button>
              </div>
              <GameAssetIcon className="box-detail-element-icon" src={getElementAssetPath(character.elementKey)} fallback="✦" />
            </div>
            <div className="character-rarity">{'★'.repeat(character.rarity)}</div>
            <div className="box-detail-constellation-row">
              <strong className="box-detail-constellation">C{character.constellation}</strong>
              {stellaFeedback?.visual?.type === 'constellation' && stellaFeedback.visual.characterId === character.id && <span className="box-stella-plus-one" key={stellaFeedback.visual.operationId} aria-label="Constellation augmentée de 1">+1</span>}
            </div>
            {combatState && <button type="button" className="box-combat-link" onClick={() => setShowCombatDetails(true)}>Statistiques →</button>}
          </div>
          <dl>
            <div><dt>Copies obtenues</dt><dd>{character.copies}</dd></div>
            <div><dt>Arme</dt><dd>{character.weaponType ?? '—'}</dd></div>
            <div><dt>Région</dt><dd>{character.region ?? '—'}</dd></div>
            <div><dt>Première obtention</dt><dd>{formatObtainedAt(character.firstObtainedAt)}</dd></div>
          </dl>
          <section className={`box-expedition-zone ${isExpeditionCharacter ? expedition.operationalStatus.toLowerCase() : 'idle'}`} aria-label="Expédition">
            <div><strong>Expédition</strong>{isExpeditionCharacter && expedition.operationalStatus === 'RUNNING' ? <small>🧭 En expédition · {formatRemaining(expedition.readyAt, now)}</small> : isExpeditionCharacter && expedition.operationalStatus === 'READY' ? <small>✅ À récupérer · {character.name} est revenu.</small> : <small>{expedition.canStartToday ? 'Disponible aujourd’hui · durée 20 h' : expedition.departureUsedToday ? 'Expédition effectuée aujourd’hui.' : 'Une autre expédition est active.'}</small>}<p role="status">{expeditionFeedback ?? '\u00a0'}</p></div>
            {isExpeditionCharacter && expedition.operationalStatus === 'READY' ? <button type="button" disabled={expeditionPending} onClick={onClaimExpedition}>{expeditionPending ? 'Récupération…' : 'Récupérer l’expédition'}</button> : !isExpeditionCharacter && expedition.canStartToday ? <button type="button" disabled={expeditionPending} onClick={onStartExpedition}>{expeditionPending ? 'Départ…' : 'Envoyer en expédition'}</button> : null}
          </section>
          {showStella && character.rarity === 5 && <section className="box-stella-zone" aria-label="Masterless Stella Fortuna">
            <div className="box-stella-copy"><strong>Masterless Stella Fortuna × {stellaQuantity}</strong><small>Renforce ce personnage</small><p className="box-stella-feedback" role="status" aria-live="polite">{stellaFeedback?.message ?? (stellaRetryAvailable ? 'Résultat à vérifier · la nouvelle tentative reprendra la même opération.' : '\u00a0')}</p></div>
            <button type="button" disabled={(!hasStella && !stellaRetryAvailable) || stellaPending} onClick={() => { stellaSubmitted.current = false; setConfirmingStella(true) }}>{stellaPending ? 'Utilisation…' : stellaRetryAvailable ? 'Reprendre l’utilisation' : 'Utiliser une Stella'}</button>
          </section>}
          {actionError && <p className="box-detail-action-error" role="alert">{actionError}</p>}
        </div>
      </div>
      {character.rarity === 5 && character.constellation === 6 && c6CompetitionStats && <section className="box-c6-competition-stats" aria-label="Statistiques concours">
        <span className="eyebrow">Statistiques concours</span>
        <dl>{c6Stats.map((stat) => {
          const label = c6StatLabel(stat)
          const value = c6CompetitionStats[stat]
          const showIncrease = stellaFeedback?.visual?.type === 'stat' && stellaFeedback.visual.characterId === character.id && stellaFeedback.visual.stat === stat
          return <div key={label}><dt>{label}</dt><dd>{value} / {c6CompetitionStats.max}</dd>{showIncrease && <span className="box-stella-plus-one stat" key={stellaFeedback.visual.operationId} aria-label={`${label} augmentée de 1`}>+1</span>}</div>
        })}</dl>
      </section>}
      {confirmingStella && <div className="box-stella-confirm-layer" role="presentation" onMouseDown={() => setConfirmingStella(false)}>
        <section className="box-stella-confirm panel" role="alertdialog" aria-modal="true" aria-label="Confirmer l’utilisation d’une Stella" onMouseDown={(event) => event.stopPropagation()}>
          <span className="eyebrow">Confirmation</span>
          <h3>{stellaRetryAvailable ? `Vérifier l’utilisation de Stella sur ${character.name} ?` : `Utiliser 1 Masterless Stella Fortuna sur ${character.name} ?`}</h3>
          <p>{stellaRetryAvailable ? 'Cette nouvelle tentative reprend exactement la même opération et vérifie son résultat.' : stellaTransition(character)}</p>
          <div className="box-stella-confirm-actions">
            <button type="button" onClick={() => setConfirmingStella(false)}>Annuler</button>
            <button type="button" className="primary" disabled={stellaPending} onClick={() => { if (stellaSubmitted.current) return; stellaSubmitted.current = true; setConfirmingStella(false); onUseStella() }}>{stellaRetryAvailable ? 'Réessayer' : 'Confirmer'}</button>
          </div>
        </section>
      </div>}
    </section>
  </div>{showCombatDetails && combatState && <div className="modal-layer box-combat-modal-layer" role="presentation" onMouseDown={() => setShowCombatDetails(false)}><section className="floating-panel box-combat-modal" role="dialog" aria-modal="true" aria-labelledby="box-combat-modal-title" onMouseDown={(event) => event.stopPropagation()}><header className="floating-panel-heading"><div><span className="eyebrow">Combat quotidien</span><h2 id="box-combat-modal-title">Statistiques de {character.name}</h2></div><button type="button" className="icon-button" onClick={() => setShowCombatDetails(false)} aria-label="Fermer les statistiques Combat"><span className="icon-glyph">×</span></button></header><p className={`box-combat-status${combatState.ko ? ' ko' : ''}`}>Statut : {combatState.ko ? '💀 KO' : 'OK'}</p><dl><div><dt>Combats</dt><dd>{combatState.stats.fights}</dd></div><div><dt>Victoires</dt><dd>{combatState.stats.wins}</dd></div><div><dt>Défaites</dt><dd>{combatState.stats.losses}</dd></div><div><dt>Taux de victoire</dt><dd>{combatState.stats.winRatePercent.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</dd></div></dl></section></div>}</>
}

function stellaTransition(character: BoxCharacterDto) {
  if (character.constellation === 6) return 'Déjà C6 · Une statistique pour les concours sera augmentée'
  return `C${character.constellation} → C${character.constellation + 1}`
}

function formatObtainedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date indisponible' : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date)
}

export default BoxCharacterDetailModal
