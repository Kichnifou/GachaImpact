import { useEffect, useRef, useState } from 'react'
import AppButton from './AppButton'
import { apiErrorMessage } from '../utils/formatters'
import './presentation-name.css'

export default function PresentationNameEditor({ name, revision = 0, onSave }: { name: string; revision?: number; onSave: (name: string, expectedRevision: number) => Promise<void> }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(name), [pending, setPending] = useState(false), [error, setError] = useState('')
  const expectedRevision = useRef(revision)
  const trigger = useRef<HTMLButtonElement>(null), mounted = useRef(true), flight = useRef(false), restoreFocus = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (restoreFocus.current && !editing && !pending) { restoreFocus.current = false; trigger.current?.focus() } }, [editing, pending])
  const close = () => { restoreFocus.current = true; setEditing(false); setError('') }
  const save = async () => {
    if (flight.current) return
    flight.current = true; setPending(true); setError('')
    try { await onSave(draft, expectedRevision.current); if (mounted.current) close() }
    catch (reason) { if (mounted.current) setError(apiErrorMessage(reason)) }
    finally { flight.current = false; if (mounted.current) setPending(false) }
  }
  return <><AppButton ref={trigger} variant="icon" className="presentation-name-pencil" disabled={pending} aria-label="Modifier le pseudo" onClick={() => { setDraft(name); expectedRevision.current = revision; setError(''); setEditing(true) }}>✎</AppButton>
    {editing && <form className="presentation-name-editor" aria-label="Modifier le pseudo" onSubmit={event => { event.preventDefault(); void save() }} onKeyDown={event => { if (event.key === 'Escape' && !pending) { event.preventDefault(); close() } }}>
      <label htmlFor="presentation-name-input">Pseudo</label><input id="presentation-name-input" autoFocus autoComplete="nickname" value={draft} maxLength={40} required disabled={pending} onChange={event => setDraft(event.target.value)} />
      <AppButton type="submit" disabled={pending || !draft.trim()}>{pending ? 'Enregistrement…' : 'Confirmer'}</AppButton><AppButton disabled={pending} onClick={close}>Annuler</AppButton>
      {error && <p role="alert">{error}</p>}
    </form>}
  </>
}
