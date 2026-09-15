type Props = {
  onClose: () => void
  label?: string
}

export default function ModalCloseButton({ onClose, label = 'Fermer' }: Props) {
  return <AppButton variant="icon" className="modal-close-button" onClick={onClose} aria-label={label}><span className="icon-glyph" aria-hidden="true">×</span></AppButton>
}
import AppButton from './AppButton'
