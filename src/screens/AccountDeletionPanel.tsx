import { useState } from 'react'
import AppButton from '../components/AppButton'
import { useModalDialog } from '../components/useModalDialog'
import { useTutorialPresentation } from '../tutorial/tutorial-presentation'

const unavailable = 'La suppression de compte est temporairement indisponible. Aucune donnée ne sera supprimée.'

function DeletionDialog({ onClose }: { onClose: () => void }) {
  const ref = useModalDialog<HTMLDivElement>(onClose)
  const [confirmation, setConfirmation] = useState('')
  return <div className="account-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={ref} className="account-confirm account-deletion-dialog" role="dialog" aria-modal="true" aria-labelledby="account-deletion-title" aria-describedby="account-deletion-warning account-deletion-unavailable" tabIndex={-1}>
      <h3 id="account-deletion-title">Supprimer mon compte</h3>
      <p id="account-deletion-warning">Cette action supprimera définitivement ton compte GachaImpact, tes personnages, tes ressources et toute ta progression. Elle est irréversible. Certaines preuves historiques anonymisées pourront être conservées.</p>
      <p id="account-deletion-unavailable" role="status">{unavailable}</p>
      <label htmlFor="account-deletion-confirmation">Saisis SUPPRIMER pour confirmer</label>
      <input id="account-deletion-confirmation" autoComplete="off" spellCheck={false} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
      <p>Une nouvelle vérification de ton identité sera nécessaire lorsque la suppression sera disponible.</p>
      <div>
        <AppButton onClick={onClose}>Annuler</AppButton>
        {/* R1100 fallback: no handler, capability flag or client-side way to enable deletion. */}
        <AppButton variant="danger" disabled aria-describedby="account-deletion-unavailable">Supprimer définitivement</AppButton>
      </div>
    </div>
  </div>
}

export default function AccountDeletionPanel() {
  const [open, setOpen] = useState(false)
  const tutorial = useTutorialPresentation().active
  return <section className="account-section account-deletion-section">
    <h3>Supprimer mon compte</h3>
    <p>La suppression efface définitivement ton compte et toute ta progression.</p>
    <p>{unavailable}</p>
    <AppButton variant="danger" disabled={tutorial} onClick={() => setOpen(true)}>Supprimer mon compte</AppButton>
    {open && !tutorial && <DeletionDialog onClose={() => setOpen(false)} />}
  </section>
}
