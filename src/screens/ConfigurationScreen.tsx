import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { NavigationMenuDestinationId, NavigationMenuPreferenceDto } from '../api/types'
import { navigationDestinations } from '../navigation/navigation'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage } from '../utils/formatters'

function reorder(order: readonly NavigationMenuDestinationId[], dragged: NavigationMenuDestinationId, target: NavigationMenuDestinationId) {
  const next = [...order]
  const from = next.indexOf(dragged); const to = next.indexOf(target)
  if (from < 0 || to < 0 || from === to) return next
  next.splice(from, 1); next.splice(to, 0, dragged)
  return next
}

function ConfigurationScreen({ preference, onSave, onReset }: { preference: NavigationMenuPreferenceDto; onSave: (value: NavigationMenuPreferenceDto) => Promise<void>; onReset: () => Promise<void> }) {
  const [draft, setDraft] = useState(preference)
  const [pending, setPending] = useState(false)
  const [dragged, setDragged] = useState<NavigationMenuDestinationId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dropped = useRef(false)
  const dragBase = useRef(preference)
  const draftRef = useRef(preference)
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active && !pending && !dragged) setDraft(preference) })
    return () => { active = false }
  }, [dragged, pending, preference])

  const replaceDraft = (next: NavigationMenuPreferenceDto) => { draftRef.current = next; setDraft(next) }
  const persist = async (next: NavigationMenuPreferenceDto, rollback = draft) => {
    replaceDraft(next); setPending(true); setError(null)
    try { await onSave(next) }
    catch (reason) { replaceDraft(rollback); setError(apiErrorMessage(reason)) }
    finally { setPending(false) }
  }
  const move = (id: NavigationMenuDestinationId, delta: -1 | 1) => { const order = [...draft.order]; const index = order.indexOf(id); const target = index + delta; if (index < 0 || target < 0 || target >= order.length) return; [order[index], order[target]] = [order[target]!, order[index]!]; void persist({ ...draft, order }) }
  const toggle = (id: NavigationMenuDestinationId) => { if (id === 'configuration') return; const hidden = draft.hidden.includes(id) ? draft.hidden.filter((value) => value !== id) : [...draft.hidden, id]; void persist({ ...draft, hidden }) }
  const startDrag = (event: DragEvent, id: NavigationMenuDestinationId) => { if (pending) { event.preventDefault(); return }; dropped.current = false; dragBase.current = draft; draftRef.current = draft; setDragged(id); event.dataTransfer.effectAllowed = 'move' }
  const previewDrop = (event: DragEvent, id: NavigationMenuDestinationId) => { if (!dragged || pending) return; event.preventDefault(); replaceDraft({ ...dragBase.current, order: reorder(dragBase.current.order, dragged, id) }) }
  const commitDrop = (event: DragEvent) => { if (!dragged || pending) return; event.preventDefault(); dropped.current = true; const next = draftRef.current; setDragged(null); void persist(next, preference) }
  const finishDrag = () => { if (!dropped.current) replaceDraft(preference); setDragged(null) }

  return <div className="screen-content configuration-screen long-screen-layout">
    <ScreenHeader eyebrow="Préférences" title="Configuration" description="Personnalisez le Menu global. Ces choix suivent votre compte." />
    <nav className="configuration-tabs" aria-label="Sections Configuration"><button type="button" className="active" aria-current="page">Menu</button><button type="button" disabled>Confidentialité</button><button type="button" disabled>Apparence</button></nav>
    <ScrollableScreenPanel className="configuration-frame" fixed={<header className="menu-configuration-heading"><div><h2>Menu</h2><p>Neuf destinations maximum sont affichées par page.</p></div><button type="button" disabled={pending} onClick={() => { setPending(true); setError(null); void onReset().catch((reason) => setError(apiErrorMessage(reason))).finally(() => setPending(false)) }}>Réinitialiser</button></header>}>
      {error && <p className="configuration-error" role="alert">{error}</p>}
      <ol className="menu-configuration-list">{draft.order.map((id, index) => { const item = navigationDestinations.find((entry) => entry.id === id); if (!item) return null; const hidden = draft.hidden.includes(id); const visibleIndex = draft.order.filter((entry) => !draft.hidden.includes(entry)).indexOf(id); return <li key={id} draggable={!pending} className={dragged === id ? 'dragging' : ''} onDragStart={(event) => startDrag(event, id)} onDragOver={(event) => previewDrop(event, id)} onDrop={commitDrop} onDragEnd={finishDrag}><span aria-hidden="true">{item.icon}</span><strong>{item.label}</strong><small>{hidden ? 'Masqué' : `Page ${Math.floor(visibleIndex / 9) + 1} · position ${(visibleIndex % 9) + 1}`}</small><div><button type="button" disabled={pending || index === 0} onClick={() => move(id, -1)} aria-label={`Monter ${item.label}`}>↑</button><button type="button" disabled={pending || index === draft.order.length - 1} onClick={() => move(id, 1)} aria-label={`Descendre ${item.label}`}>↓</button><button type="button" className="menu-visibility-button" disabled={pending || id === 'configuration'} onClick={() => toggle(id)}>{hidden ? 'Afficher' : 'Masquer'}</button></div></li>})}</ol>
    </ScrollableScreenPanel>
  </div>
}
export default ConfigurationScreen
