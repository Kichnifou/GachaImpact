import { useEffect, useState, type FormEvent } from 'react'
import { getGameApiClient } from '../../api/game-api'
import type { AdminEvent, AdminEventConfig } from '../../api/admin-types'
import { apiErrorMessage } from '../../utils/formatters'
import { AdminFeedback, ConfirmAction, useAdminTask } from './AdminUi'

export default function EventAdminPanel() {
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [selected, setSelected] = useState<AdminEvent | null>(null)
  const [config, setConfig] = useState<AdminEventConfig | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; displayName: string; isActive: boolean } | null>(null)
  const [reload, setReload] = useState(0)
  const [loadError, setLoadError] = useState('')
  const task = useAdminTask(() => setReload(value => value + 1))
  useEffect(() => { let live = true
    void getGameApiClient().getAdminEvents().then(value => { if (live) setEvents(value.entries) })
      .catch(error => { if (live) setLoadError(apiErrorMessage(error)) })
    return () => { live = false }
  }, [reload])
  const choose = (event: AdminEvent) => { setSelected(event); setConfig(event.config) }
  const changeConfig = (path: 'emoji' | 'currency.label' | 'currency.emoji' | 'collection.key' | 'collection.label', value: string) => {
    setConfig(current => { if (!current) return current
      if (path === 'emoji') return { ...current, emoji: value }
      const [group, key] = path.split('.') as ['currency' | 'collection', 'label' | 'emoji' | 'key']
      return { ...current, [group]: { ...current[group], [key]: value } } as AdminEventConfig
    })
  }
  const save = (event: FormEvent) => { event.preventDefault(); if (!selected || !config) return
    void task.execute(JSON.stringify({ id: selected.id, config }), key => getGameApiClient().updateAdminEvent(selected.id, { config, idempotencyKey: key })) }
  const toggle = async (intent: { id: string; displayName: string; isActive: boolean }) => {
    const success = await task.execute(JSON.stringify(intent), key => getGameApiClient().updateAdminEvent(intent.id, { isActive: intent.isActive, idempotencyKey: key }))
    if (success) setConfirm(null)
  }
  return <div className="admin-domain admin-events" aria-label="Administration des événements"><AdminFeedback error={task.error || loadError} notice={task.notice} />
    <section className="panel admin-list"><h2>Festivals</h2><div className="admin-scroll-list">{events.map(event => <article key={event.id} className="admin-list-row">
      <div><strong>{event.displayName} · mois {event.calendarMonth}</strong><small>{event.externalKey} · {event.currencyKey} · {event.isActive ? 'Actif' : 'Inactif'}</small>
        {event.editions.map(edition => <small key={edition.id}>Édition {edition.year} · {edition.status} · {new Date(edition.startsAt).toLocaleDateString('fr-FR')}–{new Date(edition.endsAt).toLocaleDateString('fr-FR')} · {edition._count.participants} participant(s)</small>)}</div>
      <button type="button" onClick={() => choose(event)}>Configuration</button><button type="button" className={event.isActive ? 'danger' : ''} onClick={() => { const intent = { id: event.id, displayName: event.displayName, isActive: !event.isActive }; if (event.isActive) setConfirm(intent); else void toggle(intent) }}>{event.isActive ? 'Désactiver' : 'Réactiver'}</button>
    </article>)}</div></section>
    {selected && config && <section className="panel admin-editor"><h2>Configuration future de {selected.displayName}</h2><p>Les éditions démarrées et les snapshots existants restent figés.</p>
      <form onSubmit={save}><label>Emoji Festival<input value={config.emoji} onChange={event => changeConfig('emoji', event.target.value)} required /></label>
        <label>Nom de la monnaie<input value={config.currency.label} onChange={event => changeConfig('currency.label', event.target.value)} required /></label>
        <label>Emoji monnaie<input value={config.currency.emoji} onChange={event => changeConfig('currency.emoji', event.target.value)} required /></label>
        <label>Clé Collection<input value={config.collection.key} onChange={event => changeConfig('collection.key', event.target.value)} required /></label>
        <label>Nom Collection<input value={config.collection.label} onChange={event => changeConfig('collection.label', event.target.value)} required /></label>
        <button type="submit" disabled={task.pending}>Enregistrer</button><button type="button" onClick={() => setSelected(null)}>Fermer</button></form></section>}
    {confirm && <ConfirmAction title={`Désactiver ${confirm.displayName} ?`} pending={task.pending} onCancel={() => setConfirm(null)} onConfirm={() => void toggle(confirm)}>
      Le Festival ne sera plus résolu comme actif. Ses éditions, participants, points, récompenses et claims restent conservés.</ConfirmAction>}
  </div>
}
