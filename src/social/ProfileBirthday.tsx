import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import AppButton from '../components/AppButton'
import { useModalDialog } from '../components/useModalDialog'
import { apiErrorMessage } from '../utils/formatters'
import type { Access, Birthday } from './types'
import './profile-birthday.css'

const months = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1))))
const format = (date: Birthday) => `${date.day} ${months[date.month - 1]}`
const daysIn = (month: number) => new Date(Date.UTC(2000, month, 0)).getUTCDate()
export const parisCalendarYear = (now = new Date()) => Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Paris' }).format(now))
export function birthdayCalendarGeometry(year: number, month: number) {
  return { max: new Date(Date.UTC(year, month, 0)).getUTCDate(), offset: (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7 }
}

function useParisCalendarYear() {
  const [year, setYear] = useState(parisCalendarYear)
  useEffect(() => {
    // Paris civil New Year is January 1 at 00:00 CET. Recheck on resume as
    // background tabs can suspend timers across that boundary.
    let timer: number
    const refresh = () => {
      window.clearTimeout(timer)
      const current = parisCalendarYear()
      setYear(current)
      const remaining = Date.UTC(current, 11, 31, 23) - Date.now()
      timer = window.setTimeout(refresh, Math.max(1, Math.min(remaining, 60_000)))
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return year
}

export default function ProfileBirthday({ value, own, onSave, onReload }: { value: Access<Birthday | null>; own: boolean; onSave?: (day: number, month: number) => Promise<Birthday>; onReload: () => Promise<unknown> }) {
  const [stage, setStage] = useState<'closed' | 'calendar' | 'confirm'>('closed')
  const [day, setDay] = useState<number | null>(null), [month, setMonth] = useState(1)
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  if (value.access === 'PRIVATE' || !own && !value.data) return null
  const save = async () => {
    if (lock.current || !onSave || day === null) return
    lock.current = true; setPending(true); setError('')
    try { await onSave(day, month); setStage('closed') }
    catch (reason) { setError(apiErrorMessage(reason)) }
    finally { lock.current = false; setPending(false) }
  }
  const changeMonth = (next: number) => { setMonth(next); setDay(current => current === null ? null : Math.min(current, daysIn(next))) }
  return <div className="profile-birthday" aria-label="Anniversaire" data-business-pending={pending}>
    {value.data ? <small>Anniversaire · {format(value.data)}</small> : own && onSave && <button className="profile-birthday-link" type="button" onClick={() => { setError(''); setStage('calendar') }}>Définir mon anniversaire</button>}
    {own && !value.data && stage === 'calendar' && <BirthdayCalendar day={day} month={month} onDay={setDay} onMonth={changeMonth} onClose={() => setStage('closed')} onConfirm={() => { setError(''); setStage('confirm') }} />}
    {own && !value.data && stage === 'confirm' && day !== null && <BirthdayConfirmation date={{ day, month }} pending={pending} error={error} onReturn={() => { if (!lock.current) { setError(''); setStage('calendar') } }} onConfirm={() => void save()} onReload={() => void onReload().catch(reason => setError(apiErrorMessage(reason)))} />}
  </div>
}

function BirthdayCalendar({ day, month, onDay, onMonth, onClose, onConfirm }: { day: number | null; month: number; onDay: (day: number) => void; onMonth: (month: number) => void; onClose: () => void; onConfirm: () => void }) {
  const dialog = useModalDialog<HTMLElement>(onClose)
  const year = useParisCalendarYear()
  const { max, offset } = birthdayCalendarGeometry(year, month)
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>, current: number) => {
    const jump: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    const next = event.key === 'Home' ? 1 : event.key === 'End' ? max : event.key in jump ? Math.max(1, Math.min(max, current + jump[event.key])) : null
    if (next === null) return
    event.preventDefault(); onDay(next); dialog.current?.querySelector<HTMLButtonElement>(`[data-day="${next}"]`)?.focus()
  }
  return <div className="modal-layer profile-birthday-layer" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section ref={dialog} tabIndex={-1} className="panel birthday-dialog" role="dialog" aria-modal="true" aria-labelledby="birthday-calendar-title">
    <header><div><span className="eyebrow">Une date qui compte pour vous</span><h2 id="birthday-calendar-title">Votre anniversaire</h2></div><AppButton variant="icon" aria-label="Fermer le calendrier" onClick={onClose}>×</AppButton></header>
    <div className="birthday-month"><AppButton variant="icon" aria-label="Mois précédent" onClick={() => onMonth(month === 1 ? 12 : month - 1)}>‹</AppButton><select aria-label="Mois de l’anniversaire" value={month} onChange={event => onMonth(Number(event.target.value))}>{months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select><AppButton variant="icon" aria-label="Mois suivant" onClick={() => onMonth(month === 12 ? 1 : month + 1)}>›</AppButton></div>
    <small>Calendrier {year} · Seuls le jour et le mois seront enregistrés.</small>
    <div className="birthday-weekdays" aria-hidden="true">{['L', 'Ma', 'Me', 'J', 'V', 'S', 'D'].map(label => <span key={label}>{label}</span>)}</div>
    <div className="birthday-days" role="grid" aria-label={`Jours de ${months[month - 1]} ${year}`}>
      {Array.from({ length: offset }, (_, i) => <span aria-hidden="true" key={`empty-${i}`} />)}
      {Array.from({ length: max }, (_, i) => i + 1).map(value => <button type="button" role="gridcell" key={value} data-day={value} aria-label={format({ day: value, month })} aria-selected={day === value} tabIndex={value === (day !== null && day <= max ? day : 1) ? 0 : -1} onKeyDown={event => keyboard(event, value)} onClick={() => onDay(value)}>{value}</button>)}
    </div>
    {month === 2 && max === 28 && <div className="birthday-leap-option"><AppButton data-day="29" aria-pressed={day === 29} onClick={() => onDay(29)}>29 février</AppButton><small>Option anniversaire pour les années bissextiles, hors calendrier {year}.</small></div>}
    <p className="birthday-chosen" role="status">{day === null ? 'Choisissez le mois et le jour.' : format({ day, month })}</p>
    <footer><AppButton onClick={onClose}>Annuler</AppButton><AppButton variant="primary" disabled={day === null} onClick={onConfirm}>Confirmer</AppButton></footer>
  </section></div>
}

function BirthdayConfirmation({ date, pending, error, onReturn, onConfirm, onReload }: { date: Birthday; pending: boolean; error: string; onReturn: () => void; onConfirm: () => void; onReload: () => void }) {
  const dialog = useModalDialog<HTMLElement>(onReturn)
  return <div className="modal-layer profile-birthday-layer"><section ref={dialog} tabIndex={-1} className="panel birthday-dialog" role="alertdialog" aria-modal="true" aria-labelledby="birthday-confirm-title" aria-describedby="birthday-confirm-warning">
    <h2 id="birthday-confirm-title">Confirmer le {format(date)} ?</h2>
    <p id="birthday-confirm-warning">Cette date sera définitive et ne pourra plus être modifiée. Êtes-vous sûr de vouloir continuer ?</p>
    {error && <div role="alert"><p>{error}</p><AppButton disabled={pending} onClick={onReload}>Actualiser le profil</AppButton></div>}
    <footer><AppButton disabled={pending} onClick={onReturn}>Retour</AppButton><AppButton variant="primary" disabled={pending} onClick={onConfirm}>{pending ? 'Enregistrement…' : 'Confirmer définitivement'}</AppButton></footer>
  </section></div>
}
