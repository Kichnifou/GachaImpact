import { useState } from 'react'

import { elementKeys, type ElementKey } from '../api/types'
import { elementLabels } from '../utils/formatters'
import GameAssetIcon from './GameAssetIcon'
import { getElementAssetPath } from '../utils/gameAssets'
import AppButton from './AppButton'
import ModalCloseButton from './ModalCloseButton'
import { useModalDialog } from './useModalDialog'
import AccountSettingsPanel from '../screens/AccountSettingsPanel'

type ElementChoiceScreenProps = {
  onSignOut?: () => Promise<void>
  onChoose: (elementKey: ElementKey) => Promise<void>
  onRefreshPlayerState?: () => Promise<void>
  twitchReturn?: string | null
  onBeforeTwitchRedirect?: () => void
}

function PreElementAccount({ onClose, onRefreshPlayerState, onBeforeTwitchRedirect }: { onClose: () => void; onRefreshPlayerState: () => Promise<void>; onBeforeTwitchRedirect?: () => void }) {
  const dialog = useModalDialog<HTMLElement>(onClose)
  return <div className="modal-layer" role="presentation" onMouseDown={onClose}>
    <section ref={dialog} className="floating-panel pre-element-account" role="dialog" aria-modal="true" aria-labelledby="pre-element-account-title" onMouseDown={event => event.stopPropagation()}>
      <header className="floating-panel-heading"><h2 id="pre-element-account-title">Configuration › Compte</h2><ModalCloseButton onClose={onClose} /></header>
      <AccountSettingsPanel onRefreshPlayerState={onRefreshPlayerState} onBeforeTwitchRedirect={onBeforeTwitchRedirect} />
    </section>
  </div>
}

function ElementChoiceScreen({ onChoose, onRefreshPlayerState, onSignOut, twitchReturn, onBeforeTwitchRedirect }: ElementChoiceScreenProps) {
  const [selected, setSelected] = useState<ElementKey | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(Boolean(twitchReturn))

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
    <><main className="entry-shell">
      <section className="element-entry-panel panel" aria-labelledby="element-title">
        <span className="entry-step">Affinité élémentaire</span>
        <h1 id="element-title">Choisis ton élément</h1>
        <p className="permanent-choice">Ce choix est permanent.</p>
        {onRefreshPlayerState && <div className="element-account-help"><p>Tu jouais déjà sur Twitch ? Récupère ta progression en liant ton compte juste ici :</p><AppButton className="element-twitch-link" disabled={isSubmitting} onClick={() => setAccountOpen(true)}>Lier mon compte Twitch</AppButton><span className="element-path-separator">OU</span></div>}
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
        <button type="button" className="entry-primary-button element-confirm" disabled={!selected || isSubmitting} aria-busy={isSubmitting} onClick={confirm}>
          {isSubmitting ? 'Validation…' : selected ? `Choisir ${elementLabels[selected]}` : 'Sélectionne un élément'}
        </button>
        {onSignOut && <div className="element-entry-footer"><button type="button" className="element-sign-out" disabled={isSubmitting} onClick={() => void onSignOut().catch(() => setErrorMessage('Impossible de vous déconnecter. Réessayez.'))}>Déconnexion</button></div>}
      </section>
    </main>{accountOpen && onRefreshPlayerState && <PreElementAccount onClose={() => setAccountOpen(false)} onRefreshPlayerState={onRefreshPlayerState} onBeforeTwitchRedirect={onBeforeTwitchRedirect} />}</>
  )
}

export default ElementChoiceScreen
