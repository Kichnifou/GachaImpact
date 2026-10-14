import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useModalDialog } from '../components/useModalDialog'
import ModalCloseButton from '../components/ModalCloseButton'

export default function AppearanceChooser({ title, onClose, children, background }: { title: string; onClose: () => void; children: ReactNode; background?: HTMLElement | null }) {
  const id = useId()
  const ref = useModalDialog<HTMLElement>(onClose)
  useEffect(() => {
    const surfaces = [document.body, background].filter((node): node is HTMLElement => Boolean(node))
    const previous = surfaces.map(node => node.style.overflow)
    surfaces.forEach(node => { node.style.overflow = 'hidden' })
    return () => { surfaces.forEach((node, index) => { node.style.overflow = previous[index]! }) }
  }, [background])
  return createPortal(<div className="modal-layer appearance-chooser-layer" onMouseDown={onClose}>
    <section ref={ref} className="panel appearance-chooser" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} data-tutorial-anchor="appearance-chooser" onMouseDown={event => event.stopPropagation()}>
      <header><h2 id={id}>{title}</h2><ModalCloseButton onClose={onClose} /></header>
      <div className="appearance-chooser-body">{children}</div>
    </section>
  </div>, document.body)
}
