import { useEffect, useMemo, useState } from 'react'
import type { NavigationMenuPreferenceDto } from '../api/types'
import { navigationDestinations } from '../navigation/navigation'
import type { ScreenId } from '../types'

const PAGE_SIZE = 9
function GlobalMenu({ preference, onNavigate, onClose }: { preference: NavigationMenuPreferenceDto; onNavigate: (screen: ScreenId) => void; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const destinations = useMemo(() => preference.order.map((id) => navigationDestinations.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item) && !preference.hidden.includes(item!.id)), [preference])
  const totalPages = Math.max(1, Math.ceil(destinations.length / PAGE_SIZE))
  const visible = destinations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [onClose])
  return <div className="modal-layer global-menu-layer" onMouseDown={onClose}><section className="floating-panel global-menu" role="dialog" aria-modal="true" aria-labelledby="global-menu-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">Navigation</span><h2 id="global-menu-title">Menu</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer">×</button></header><div className="global-menu-grid">{visible.map((item) => <button type="button" key={item.id} disabled={!item.available || !item.screen} title={item.available ? item.label : `${item.label} — bientôt disponible`} onClick={() => { if (item.screen) { onNavigate(item.screen); onClose() } }}><span aria-hidden="true">{item.icon}</span><strong>{item.label}</strong>{!item.available && <small>À venir</small>}</button>)}</div><footer><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</button><span>Page {page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Suivant</button></footer></section></div>
}
export default GlobalMenu
