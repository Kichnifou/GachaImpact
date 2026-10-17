import { useRef, useState } from 'react'
import AppButton from '../components/AppButton'
import { apiErrorMessage } from '../utils/formatters'
import type { Access, Birthday } from './types'
import './profile-birthday.css'
const format = (date: Birthday) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, date.month - 1, date.day)))
export default function ProfileBirthday({ value, own, onSave, onReload }: { value: Access<Birthday | null>; own: boolean; onSave?: (day: number, month: number) => Promise<Birthday>; onReload: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false), [confirm, setConfirm] = useState(false)
  const [day, setDay] = useState(1), [month, setMonth] = useState(1), [pending, setPending] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  if (value.access === 'PRIVATE' || !own && !value.data) return null
  const save = async () => {
    if (lock.current || !onSave) return
    lock.current = true; setPending(true); setError('')
    try { await onSave(day, month); setEditing(false); setConfirm(false) }
    catch (reason) { setError(apiErrorMessage(reason)) }
    finally { lock.current = false; setPending(false) }
  }
  const max = new Date(Date.UTC(2000, month, 0)).getUTCDate()
  return <section className="profile-birthday" aria-label="Anniversaire" data-business-pending={pending}>
    <div><span className="eyebrow">Anniversaire</span>{value.data ? <><p>{format(value.data)}</p>{own && <small>Date définitive · visibilité dans Confidentialité</small>}</> : <p>Partagez une date qui compte pour vous. Votre anniversaire reste privé par défaut.</p>}</div>
    {own && !value.data && onSave && (!editing ? <AppButton onClick={() => setEditing(true)}>Définir mon anniversaire</AppButton> : <div className="profile-birthday-editor">
      <p>Attention : votre anniversaire ne pourra plus être modifié après validation.</p>
      {!confirm ? <><label>Jour<select aria-label="Jour de l’anniversaire" value={day} onChange={e => setDay(Number(e.target.value))}>{Array.from({ length: max }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label><label>Mois<select aria-label="Mois de l’anniversaire" value={month} onChange={e => { const next = Number(e.target.value); setMonth(next); setDay(current => Math.min(current, new Date(Date.UTC(2000, next, 0)).getUTCDate())) }}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{format({ day: 1, month: i + 1 }).replace(/^1 /, '')}</option>)}</select></label><AppButton onClick={() => { setError(''); setConfirm(true) }}>Continuer</AppButton></> : <><p>Confirmer définitivement le {format({ day, month })} ?</p><AppButton disabled={pending} onClick={() => void save()}>{pending ? 'Enregistrement…' : 'Confirmer définitivement'}</AppButton></>}
      <AppButton disabled={pending} onClick={() => { setEditing(false); setConfirm(false); setError('') }}>Annuler</AppButton>
      {error && <div role="alert"><p>{error}</p><AppButton onClick={() => void onReload().catch(reason => setError(apiErrorMessage(reason)))}>Actualiser le profil</AppButton></div>}
    </div>)}
  </section>
}
