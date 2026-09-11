import { Fragment, useEffect, useRef, useState, type DragEvent } from 'react'
import type { NavigationMenuDestinationId, NavigationMenuPreferenceDto } from '../api/types'
import { navigationDestinations } from '../navigation/navigation'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage } from '../utils/formatters'

type DropIntent = Readonly<{ mode: 'swap'; target: NavigationMenuDestinationId } | { mode: 'insert'; index: number }>

function reorder(order: readonly NavigationMenuDestinationId[], dragged: NavigationMenuDestinationId, intent: DropIntent) {
  const next = [...order]
  const from = next.indexOf(dragged)
  if (from < 0) return next
  if (intent.mode === 'swap') {
    const to = next.indexOf(intent.target)
    if (to < 0 || from === to) return next
    ;[next[from], next[to]] = [next[to]!, next[from]!]
    return next
  }
  next.splice(from, 1)
  const insertionIndex = Math.max(0, Math.min(next.length, intent.index - (from < intent.index ? 1 : 0)))
  next.splice(insertionIndex, 0, dragged)
  return next
}

function ConfigurationScreen({ preference, onSave, onReset }: { preference: NavigationMenuPreferenceDto; onSave: (value: NavigationMenuPreferenceDto) => Promise<void>; onReset: () => Promise<void> }) {
  const [draft, setDraft] = useState(preference)
  const [pending, setPending] = useState(false)
  const [dragged, setDragged] = useState<NavigationMenuDestinationId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dropIntent, setDropIntent] = useState<DropIntent | null>(null)
  const dropped = useRef(false)
  const dragBase = useRef(preference)
  const draftRef = useRef(preference)
  const confirmedRef = useRef(preference)
  const replaceDraft = (next: NavigationMenuPreferenceDto) => { draftRef.current = next; setDraft(next) }
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active && !pending && !dragged) { confirmedRef.current = preference; replaceDraft(preference) } })
    return () => { active = false }
  }, [dragged, pending, preference])
  const persist = async (next: NavigationMenuPreferenceDto, rollback = draft) => {
    replaceDraft(next); setPending(true); setError(null)
    try { await onSave(next); confirmedRef.current = next }
    catch (reason) { replaceDraft(rollback); setError(apiErrorMessage(reason)) }
    finally { setPending(false) }
  }
  const move = (id: NavigationMenuDestinationId, delta: -1 | 1) => { const order = [...draft.order]; const index = order.indexOf(id); const target = index + delta; if (index < 0 || target < 0 || target >= order.length) return; [order[index], order[target]] = [order[target]!, order[index]!]; void persist({ ...draft, order }) }
  const toggle = (id: NavigationMenuDestinationId) => { if (id === 'configuration') return; const hidden = draft.hidden.includes(id) ? draft.hidden.filter((value) => value !== id) : [...draft.hidden, id]; void persist({ ...draft, hidden }) }
  const startDrag = (event: DragEvent, id: NavigationMenuDestinationId) => { if (pending) { event.preventDefault(); return }; dropped.current = false; dragBase.current = confirmedRef.current; draftRef.current = confirmedRef.current; setDragged(id); setDropIntent(null); event.dataTransfer.effectAllowed = 'move' }
  const previewDrop = (event: DragEvent, nextIntent: DropIntent) => {
    if (!dragged || pending) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropIntent(nextIntent)
    replaceDraft({ ...dragBase.current, order: reorder(dragBase.current.order, dragged, nextIntent) })
  }
  const commitDrop = (event: DragEvent, intent: DropIntent) => { if (!dragged || pending) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; dropped.current = true; const next = { ...dragBase.current, order: reorder(dragBase.current.order, dragged, intent) }; const rollback = confirmedRef.current; setDragged(null); setDropIntent(null); if (next.order.join('|') !== rollback.order.join('|')) void persist(next, rollback); else replaceDraft(rollback) }
  const finishDrag = () => { if (!dropped.current) replaceDraft(confirmedRef.current); setDragged(null); setDropIntent(null) }

  return <div className="screen-content configuration-screen long-screen-layout">
    <ScreenHeader eyebrow="Préférences" title="Configuration" description="Personnalisez le Menu global. Ces choix suivent votre compte." />
    <nav className="configuration-tabs" aria-label="Sections Configuration"><button type="button" className="active" aria-current="page">Menu</button><button type="button" disabled>Confidentialité</button><button type="button" disabled>Apparence</button></nav>
    <ScrollableScreenPanel className="configuration-frame" fixed={<header className="menu-configuration-heading"><div><h2>Menu</h2><p>Neuf destinations maximum sont affichées par page.</p></div><button type="button" disabled={pending} onClick={() => { setPending(true); setError(null); void onReset().catch((reason) => setError(apiErrorMessage(reason))).finally(() => setPending(false)) }}>Réinitialiser</button></header>}>
      {error && <p className="configuration-error" role="alert">{error}</p>}
      <ol className="menu-configuration-list">{draft.order.map((id, index) => { const item = navigationDestinations.find((entry) => entry.id === id); if (!item) return null; const hidden = draft.hidden.includes(id); const visibleIndex = draft.order.filter((entry) => !draft.hidden.includes(entry)).indexOf(id); const swapActive = dropIntent?.mode === 'swap' && dropIntent.target === id; const insertionActive = dropIntent?.mode === 'insert' && dropIntent.index === index; const insertionIntent = { mode: 'insert', index } as const; const swapIntent = { mode: 'swap', target: id } as const; return <Fragment key={id}><li className={`menu-drop-zone${insertionActive ? ' active' : ''}`} aria-label={`Insérer avant ${item.label}`} onDragOver={(event) => previewDrop(event, insertionIntent)} onDrop={(event) => commitDrop(event, insertionIntent)}><span>Insérer ici</span></li><li draggable={!pending} className={`${dragged === id ? 'dragging' : ''}${swapActive ? ' drop-swap' : ''}`} onDragStart={(event) => startDrag(event, id)} onDragOver={(event) => previewDrop(event, swapIntent)} onDrop={(event) => commitDrop(event, swapIntent)} onDragEnd={finishDrag}><span aria-hidden="true">{item.icon}</span><strong>{item.label}</strong><small>{hidden ? 'Masqué' : `Page ${Math.floor(visibleIndex / 9) + 1} · position ${(visibleIndex % 9) + 1}`}</small><div><button type="button" disabled={pending || index === 0} onClick={() => move(id, -1)} aria-label={`Monter ${item.label}`}>↑</button><button type="button" disabled={pending || index === draft.order.length - 1} onClick={() => move(id, 1)} aria-label={`Descendre ${item.label}`}>↓</button><button type="button" className="menu-visibility-button" disabled={pending || id === 'configuration'} onClick={() => toggle(id)}>{hidden ? 'Afficher' : 'Masquer'}</button></div></li></Fragment>})}<li className={`menu-drop-zone final${dropIntent?.mode === 'insert' && dropIntent.index === draft.order.length ? ' active' : ''}`} aria-label="Insérer en dernière position" onDragOver={(event) => previewDrop(event, { mode: 'insert', index: draft.order.length })} onDrop={(event) => commitDrop(event, { mode: 'insert', index: draft.order.length })}><span>Insérer ici</span></li></ol>
    </ScrollableScreenPanel>
  </div>
}
export default ConfigurationScreen
