import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useModalDialog } from '../useModalDialog'

export function CatalogDialog({ title, onClose, pending, children }: { title: string; onClose: () => void; pending?: boolean; children: ReactNode }) {
  const ref = useModalDialog<HTMLDivElement>(() => { if (!pending) onClose() })
  useEffect(() => {
    if (pending) ref.current?.focus()
  }, [pending, ref])
  useEffect(() => {
    const dialog = ref.current?.closest('.catalog-dialog-overlay')
    const background = Array.from(document.body.children).filter(node => node !== dialog).map(node => ({ node, inert: node.hasAttribute('inert') }))
    background.forEach(({ node }) => node.setAttribute('inert', ''))
    return () => { background.forEach(({ node, inert }) => { if (!inert) node.removeAttribute('inert') }) }
  }, [ref])
  return createPortal(<div className="catalog-dialog-overlay" onPointerDown={event => { if (event.target === event.currentTarget && !pending) onClose() }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="panel admin-domain catalog-dialog">
      <header><h2>{title}</h2><button type="button" disabled={pending} onClick={onClose} aria-label="Fermer la fiche">×</button></header>
      <div className="catalog-dialog-body">{children}</div>
    </div>
  </div>, document.body)
}
