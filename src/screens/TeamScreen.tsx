import { useState } from 'react'
import CharacterCard from '../components/CharacterCard'
import CharacterAssetImage from '../components/CharacterAssetImage'
import GameAssetIcon from '../components/GameAssetIcon'
import ScreenHeader from '../components/ScreenHeader'
import { activeTeam, characters } from '../data/mockData'
import type { Character } from '../types'
import { getElementAssetPath } from '../utils/gameAssets'

function TeamScreen() {
  const [selectedSlot, setSelectedSlot] = useState<Character | null>(null)
  const [previewCharacter, setPreviewCharacter] = useState<Character | null>(null)
  const [emptySlotIds, setEmptySlotIds] = useState<string[]>([])
  const availableCharacters = characters.filter((character) => character.owned)

  return (
    <div className="screen-content team-screen">
      <ScreenHeader
        eyebrow="Formation active"
        title="Équipe"
        description="Visualisez votre groupe principal et préparez ses futures synergies."
        meta="4 membres actifs"
      />

      <section className="large-team-grid" aria-label="Équipe active">
        {activeTeam.map((character, index) => emptySlotIds.includes(character.id) ? (
          <article className="large-team-card empty-team-card" key={character.id}>
            <span className="team-slot-number">0{index + 1}</span>
            <div className="empty-team-portrait" aria-hidden="true">＋</div>
            <div className="large-team-copy">
              <span className="eyebrow">Emplacement libre</span>
              <h2>Ajouter un personnage</h2>
              <p>Ce changement reste une prévisualisation locale.</p>
            </div>
            <div className="empty-team-action">
              <button type="button" onClick={() => setSelectedSlot(character)}>Ajouter</button>
            </div>
          </article>
        ) : (
          <article className={`large-team-card ${character.tone}`} key={character.id}>
            <span className="team-slot-number">0{index + 1}</span>
            <GameAssetIcon
              className="large-element"
              src={getElementAssetPath(character.element, 'badge')}
              fallback={character.elementIcon}
            />
            <div className="large-character-portrait" aria-hidden="true">
              <CharacterAssetImage
                characterName={character.name}
                className="large-character-asset-image"
                fallback={<><span>{character.name.slice(0, 1)}</span><i /></>}
              />
            </div>
            <div className="large-team-copy">
              <span className="character-rarity">{'★'.repeat(character.rarity)}</span>
              <h2>{character.name}</h2>
              <p>{character.element} · {character.role}</p>
              <div><span>Niveau {character.level}</span><span>C{character.constellation}</span></div>
            </div>
            <div className="team-card-actions">
              <button type="button">Fiche</button>
              <button type="button" onClick={() => setSelectedSlot(character)}>Changer</button>
              <button type="button" className="danger-action" onClick={() => setEmptySlotIds((slots) => [...slots, character.id])}>Retirer</button>
            </div>
          </article>
        ))}
      </section>

      <section className="panel team-bonuses">
        <div className="section-heading"><span>Bonus et passifs d’équipe</span><small>Aperçu futur</small></div>
        <div className="bonus-grid">
          <article><GameAssetIcon className="hydro bonus-element-icon" src={getElementAssetPath('Hydro')} fallback="●" /><div><strong>Résonance élémentaire</strong><p>Aucun bonus actif dans ce prototype.</p></div></article>
          <article><span className="gold">✦</span><div><strong>Passifs combinés</strong><p>Les effets de groupe apparaîtront ici.</p></div></article>
          <article><span className="violet">◇</span><div><strong>Puissance d’équipe</strong><p>Évaluation fictive : 8 420</p></div></article>
        </div>
      </section>

      {selectedSlot && (
        <div className="modal-layer" role="presentation" onMouseDown={() => setSelectedSlot(null)}>
          <section
            className="floating-panel team-selector"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-selector-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="floating-panel-heading">
              <div><span className="eyebrow">Emplacement de {selectedSlot.name}</span><h2 id="team-selector-title">Changer de personnage</h2></div>
              <button type="button" className="icon-button" onClick={() => setSelectedSlot(null)} aria-label="Fermer"><span className="icon-glyph">×</span></button>
            </div>
            <p className="selector-help">Sélection visuelle uniquement : le changement ne sera pas enregistré.</p>
            <div className="selector-character-grid">
              {availableCharacters.map((character) => (
                <CharacterCard
                  character={character}
                  compact
                  selected={(previewCharacter ?? selectedSlot).id === character.id}
                  onClick={() => setPreviewCharacter(character)}
                  key={character.id}
                />
              ))}
            </div>
            <div className="selector-footer">
              <span>Sélection : <strong>{(previewCharacter ?? selectedSlot).name}</strong></span>
              <button
                type="button"
                className="small-primary-button"
                onClick={() => {
                  setEmptySlotIds((slots) => slots.filter((id) => id !== selectedSlot.id))
                  setSelectedSlot(null)
                }}
              >
                Prévisualiser ce choix
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default TeamScreen
