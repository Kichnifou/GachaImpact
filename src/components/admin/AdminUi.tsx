import { useEffect, useRef, useState, type ReactNode } from 'react'
import { apiErrorMessage } from '../../utils/formatters'

export function useAdminTask(onDone?: () => void) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const retry = useRef<{ signature: string; key: string } | null>(null)
  const execute = async (signature: string, action: (key: string) => Promise<unknown>) => {
    if (pending) return
    const key = retry.current?.signature === signature ? retry.current.key : crypto.randomUUID()
    retry.current = { signature, key }
    setPending(true); setError(''); setNotice('')
    try { await action(key); retry.current = null; setNotice('Modification enregistrée.'); onDone?.(); return true }
    catch (reason) { setError(apiErrorMessage(reason)); return false }
    finally { setPending(false) }
  }
  return { pending, error, notice, execute, setError }
}

export function AdminFeedback({ error, notice }: { error?: string; notice?: string }) {
  return <>{error && <p role="alert" className="moderation-feedback error">{error}</p>}
    {notice && <p role="status" className="moderation-feedback">{notice}</p>}</>
}

export function ConfirmAction({ title, children, onCancel, onConfirm, pending }: { title: string; children: ReactNode;
  onCancel: () => void; onConfirm: () => void; pending?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pending) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, pending])
  return <div className="moderation-delete-overlay" onPointerDown={event => { if (event.target === event.currentTarget && !pending) onCancel() }}>
    <div className="moderation-delete-confirm" role="dialog" aria-modal="true" aria-label={title}>
      <strong>{title}</strong><p>{children}</p><div>
        <button type="button" className="danger" disabled={pending} onClick={onConfirm}>Confirmer</button>
        <button type="button" disabled={pending} onClick={onCancel}>Annuler</button>
      </div>
    </div>
  </div>
}

export function AdminPager({ page, totalPages, onPage, pending }: { page: number; totalPages: number; onPage: (page: number) => void; pending?: boolean }) {
  return <footer className="admin-pager"><button type="button" disabled={pending || page <= 1} onClick={() => onPage(page - 1)}>Précédent</button>
    <span>Page {page} / {totalPages}</span><button type="button" disabled={pending || page >= totalPages} onClick={() => onPage(page + 1)}>Suivant</button></footer>
}
