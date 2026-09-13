type Props = {
  onClose: () => void
  label?: string
}

export default function ModalCloseButton({ onClose, label = 'Fermer' }: Props) {
  return <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label={label}><span className="icon-glyph" aria-hidden="true">×</span></button>
}
