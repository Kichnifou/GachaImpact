import { useEffect, useRef, useState } from 'react'
import type { BoxCharacterDto } from '../api/types'
import { getElementAssetPath } from '../utils/gameAssets'
import CharacterPortraitFrame from './CharacterPortraitFrame'
import GameAssetIcon from './GameAssetIcon'

function BoxCharacterDetailModal({ character, stellaQuantity, favoritePending, stellaPending, stellaFeedback, onToggleFavorite, onUseStella, onClose }: {
  character: BoxCharacterDto
  stellaQuantity: string
  favoritePending: boolean
  stellaPending: boolean
  stellaFeedback: string | null
  onToggleFavorite: () => void
  onUseStella: () => void
  onClose: () => void
}) {
  const [confirmingStella, setConfirmingStella] = useState(false)
  const stellaSubmitted = useRef(false)
  const hasStella = /^\d+$/.test(stellaQuantity) && BigInt(stellaQuantity) > 0n

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return <div className="modal-layer" role="presentation" onMouseDown={onClose}>
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
              <h2 className="box-detail-character-name">{character.name}</h2>
              <GameAssetIcon className="box-detail-element-icon" src={getElementAssetPath(character.elementKey)} fallback="✦" />
            </div>
            <div className="character-rarity">{'★'.repeat(character.rarity)}</div>
            <strong className="box-detail-constellation">C{character.constellation}</strong>
          </div>
          <dl>
            <div><dt>Copies obtenues</dt><dd>{character.copies}</dd></div>
            <div><dt>Première obtention</dt><dd>{formatObtainedAt(character.firstObtainedAt)}</dd></div>
            <div><dt>Favori</dt><dd>{character.favorite ? 'Oui' : 'Non'}</dd></div>
          </dl>
          {character.rarity === 5 && <section className="box-stella-zone" aria-label="Masterless Stella Fortuna">
            <div><strong>Masterless Stella Fortuna × {stellaQuantity}</strong><small>Renforce ce personnage d’une copie.</small></div>
            <button type="button" disabled={!hasStella || stellaPending} onClick={() => { stellaSubmitted.current = false; setConfirmingStella(true) }}>{stellaPending ? 'Utilisation…' : 'Utiliser une Stella'}</button>
            {stellaFeedback && <p className="box-stella-feedback" role="status">{stellaFeedback}</p>}
          </section>}
          <button type="button" className={`box-detail-favorite${character.favorite ? ' active' : ''}`} disabled={favoritePending} onClick={onToggleFavorite}>
            <span aria-hidden="true">★</span>{character.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          </button>
        </div>
      </div>
      {confirmingStella && <div className="box-stella-confirm-layer" role="presentation" onMouseDown={() => setConfirmingStella(false)}>
        <section className="box-stella-confirm panel" role="alertdialog" aria-modal="true" aria-label="Confirmer l’utilisation d’une Stella" onMouseDown={(event) => event.stopPropagation()}>
          <span className="eyebrow">Confirmation</span>
          <h3>Utiliser 1 Masterless Stella Fortuna sur {character.name} ?</h3>
          <p>{stellaTransition(character)}</p>
          <div className="box-stella-confirm-actions">
            <button type="button" onClick={() => setConfirmingStella(false)}>Annuler</button>
            <button type="button" className="primary" disabled={stellaPending} onClick={() => { if (stellaSubmitted.current) return; stellaSubmitted.current = true; setConfirmingStella(false); onUseStella() }}>Confirmer</button>
          </div>
        </section>
      </div>}
    </section>
  </div>
}

function stellaTransition(character: BoxCharacterDto) {
  if (character.constellation === 6) return `C6 reste C6 · Copies : ${character.copies} → ${character.copies + 1} · Une statistique Concours éligible recevra +1.`
  return `C${character.constellation} → C${character.constellation + 1} · Copies : ${character.copies} → ${character.copies + 1}`
}

function formatObtainedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date indisponible' : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date)
}

export default BoxCharacterDetailModal
