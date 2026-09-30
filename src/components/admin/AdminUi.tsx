import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { apiErrorMessage } from '../../utils/formatters'

export function useAdminTask(onDone?: () => void) {
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const retry = useRef<{ signature: string; key: string } | null>(null)
  const execute = async (signature: string, action: (key: string) => Promise<unknown>) => {
    if (pendingRef.current) return false
    pendingRef.current = true
    const key = retry.current?.signature === signature ? retry.current.key : crypto.randomUUID()
    retry.current = { signature, key }
    setPending(true); setError(''); setNotice('')
    try { await action(key); retry.current = null; setNotice('Modification enregistrée.'); onDone?.(); return true }
    catch (reason) { setError(apiErrorMessage(reason)); return false }
    finally { pendingRef.current = false; setPending(false) }
  }
  return { pending, error, notice, execute, setError }
}

export function AdminFeedback({ error, notice }: { error?: string; notice?: string }) {
  return <>{error && <p role="alert" className="moderation-feedback error">{error}</p>}
    {notice && <p role="status" className="moderation-feedback">{notice}</p>}</>
}

export function ConfirmAction({ title, children, onCancel, onConfirm, pending }: { title: string; children: ReactNode;
  onCancel: () => void; onConfirm: () => void; pending?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null)
  const overlay = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const background = Array.from(document.body.children).filter(node => node !== overlay.current)
      .map(node => ({ node, wasInert: node.hasAttribute('inert') }))
    background.forEach(({ node }) => node.setAttribute('inert', ''))
    cancel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!pendingRef.current) cancelRef.current(); return }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])
      if (!focusable.length) { event.preventDefault(); dialog.current?.focus(); return }
      const first = focusable[0]!, last = focusable[focusable.length - 1]!
      if (!dialog.current?.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      background.forEach(({ node, wasInert }) => { if (!wasInert) node.removeAttribute('inert') })
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])
  return createPortal(<div ref={overlay} className="moderation-delete-overlay admin-confirm-overlay" onPointerDown={event => { if (event.target === event.currentTarget && !pending) onCancel() }}>
    <div ref={dialog} tabIndex={-1} className="moderation-delete-confirm" role="dialog" aria-modal="true" aria-label={title}>
      <strong>{title}</strong><p>{children}</p><div>
        <button type="button" className="danger" disabled={pending} onClick={onConfirm}>Confirmer</button>
        <button ref={cancel} type="button" disabled={pending} onClick={onCancel}>Annuler</button>
      </div>
    </div>
  </div>, document.body)
}

export function AdminPager({ page, totalPages, onPage, pending }: { page: number; totalPages: number; onPage: (page: number) => void; pending?: boolean }) {
  return <footer className="admin-pager"><button type="button" disabled={pending || page <= 1} onClick={() => onPage(page - 1)}>Précédent</button>
    <span>Page {page} / {totalPages}</span><button type="button" disabled={pending || page >= totalPages} onClick={() => onPage(page + 1)}>Suivant</button></footer>
}
