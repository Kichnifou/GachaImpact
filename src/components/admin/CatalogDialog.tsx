import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useModalDialog } from '../useModalDialog'

export function CatalogDialog({ title, onClose, pending, children, navigation, returnFocus }: { title: string; onClose: () => void; pending?: boolean; children: ReactNode; navigation?: ReactNode; returnFocus?:HTMLElement|null }) {
  const opener = useRef(returnFocus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null))
  const ref = useModalDialog<HTMLDivElement>(() => { if (!pending) onClose() })
  useEffect(() => {
    if (pending) ref.current?.focus()
  }, [pending, ref])
  useEffect(() => {
    const dialog = ref.current?.closest('.catalog-dialog-overlay')
    const background = Array.from(document.body.children).filter(node => node !== dialog).map(node => ({ node, inert: node.hasAttribute('inert') }))
    background.forEach(({ node }) => node.setAttribute('inert', ''))
    return () => {
      background.forEach(({ node, inert }) => { if (!inert) node.removeAttribute('inert') })
      // The shared hook cleans up first, while the opener is still inert.
      // Restore once more after restoring the background's original state.
      if (opener.current?.isConnected && !opener.current.closest('[inert]')) opener.current.focus()
    }
  }, [ref])
  return createPortal(<div className="catalog-dialog-overlay" onPointerDown={event => { if (event.target === event.currentTarget && !pending) onClose() }}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`panel admin-domain catalog-dialog${navigation?' catalog-dialog-tabbed':''}`}>
      <header><h2>{title}</h2><button type="button" disabled={pending} onClick={onClose} aria-label="Fermer la fiche">×</button></header>
      {navigation}
      <div className="catalog-dialog-body">{children}</div>
    </div>
  </div>, document.body)
}
