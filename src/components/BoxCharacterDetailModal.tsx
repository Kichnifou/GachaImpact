import { useEffect } from 'react'
import type { BoxCharacterDto } from '../api/types'
import CharacterPortraitFrame from './CharacterPortraitFrame'

function BoxCharacterDetailModal({ character, favoritePending, onToggleFavorite, onClose }: {
  character: BoxCharacterDto
  favoritePending: boolean
  onToggleFavorite: () => void
  onClose: () => void
}) {
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
            <h2 className="box-detail-character-name">{character.name}</h2>
            <div className="character-rarity">{'★'.repeat(character.rarity)}</div>
            <strong className="box-detail-constellation">C{character.constellation}</strong>
          </div>
          <dl>
            <div><dt>Copies obtenues</dt><dd>{character.copies}</dd></div>
            <div><dt>Première obtention</dt><dd>{formatObtainedAt(character.firstObtainedAt)}</dd></div>
            <div><dt>Favori</dt><dd>{character.favorite ? 'Oui' : 'Non'}</dd></div>
          </dl>
          <button type="button" className={`box-detail-favorite${character.favorite ? ' active' : ''}`} disabled={favoritePending} onClick={onToggleFavorite}>
            <span aria-hidden="true">★</span>{character.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          </button>
        </div>
      </div>
    </section>
  </div>
}

function formatObtainedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date indisponible' : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date)
}

export default BoxCharacterDetailModal
