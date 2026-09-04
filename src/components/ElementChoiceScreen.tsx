import { useState } from 'react'

import { elementKeys, type ElementKey } from '../api/types'
import { elementLabels } from '../utils/formatters'
import GameAssetIcon from './GameAssetIcon'
import { getElementAssetPath } from '../utils/gameAssets'

type ElementChoiceScreenProps = {
  onChoose: (elementKey: ElementKey) => Promise<void>
}

function ElementChoiceScreen({ onChoose }: ElementChoiceScreenProps) {
  const [selected, setSelected] = useState<ElementKey | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const confirm = async () => {
    if (!selected) return
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await onChoose(selected)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Impossible de choisir cet élément.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="entry-shell">
      <section className="element-entry-panel panel" aria-labelledby="element-title">
        <span className="entry-step">Affinité élémentaire</span>
        <h1 id="element-title">Choisis ton élément</h1>
        <p className="permanent-choice">Ce choix est permanent.</p>
        <div className="element-choice-grid">
          {elementKeys.map((elementKey) => (
            <button
              type="button"
              className={`element-choice ${elementKey}${selected === elementKey ? ' selected' : ''}`}
              aria-pressed={selected === elementKey}
              onClick={() => setSelected(elementKey)}
              key={elementKey}
            >
              <GameAssetIcon className="element-choice-icon" src={getElementAssetPath(elementLabels[elementKey])} fallback="✦" />
              <strong>{elementLabels[elementKey]}</strong>
            </button>
          ))}
        </div>
        {errorMessage && <p className="form-feedback error" role="alert">{errorMessage}</p>}
        <button type="button" className="entry-primary-button element-confirm" disabled={!selected || isSubmitting} onClick={confirm}>
          {isSubmitting ? 'Validation…' : selected ? `Choisir ${elementLabels[selected]}` : 'Sélectionne un élément'}
        </button>
      </section>
    </main>
  )
}

export default ElementChoiceScreen
