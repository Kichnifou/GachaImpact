import { useState } from 'react'
import type { NavigationMenuDestinationId, NavigationMenuPreferenceDto } from '../api/types'
import { navigationDestinations } from '../navigation/navigation'
import ScreenHeader from '../components/ScreenHeader'

function ConfigurationScreen({ preference, onSave, onReset }: { preference: NavigationMenuPreferenceDto; onSave: (value: NavigationMenuPreferenceDto) => Promise<void>; onReset: () => Promise<void> }) {
  const [pending, setPending] = useState(false)
  const update = async (next: NavigationMenuPreferenceDto) => { setPending(true); try { await onSave(next) } finally { setPending(false) } }
  const move = (id: NavigationMenuDestinationId, delta: -1 | 1) => { const order = [...preference.order]; const index = order.indexOf(id); const target = index + delta; if (index < 0 || target < 0 || target >= order.length) return; [order[index], order[target]] = [order[target]!, order[index]!]; void update({ ...preference, order }) }
  const toggle = (id: NavigationMenuDestinationId) => { if (id === 'configuration') return; const hidden = preference.hidden.includes(id) ? preference.hidden.filter((value) => value !== id) : [...preference.hidden, id]; void update({ ...preference, hidden }) }
  return <div className="screen-content configuration-screen"><ScreenHeader eyebrow="Préférences" title="Configuration" description="Personnalisez le Menu global. Ces choix suivent votre compte." /><section className="panel menu-configuration"><header><div><h2>Menu</h2><p>Neuf destinations maximum sont affichées par page.</p></div><button type="button" disabled={pending} onClick={() => void onReset()}>Réinitialiser</button></header><ol>{preference.order.map((id, index) => { const item = navigationDestinations.find((entry) => entry.id === id); if (!item) return null; const hidden = preference.hidden.includes(id); return <li key={id}><span aria-hidden="true">{item.icon}</span><strong>{item.label}</strong><small>Page {Math.floor(index / 9) + 1} · position {(index % 9) + 1}</small><div><button type="button" disabled={pending || index === 0} onClick={() => move(id, -1)} aria-label={`Monter ${item.label}`}>↑</button><button type="button" disabled={pending || index === preference.order.length - 1} onClick={() => move(id, 1)} aria-label={`Descendre ${item.label}`}>↓</button><button type="button" disabled={pending || id === 'configuration'} onClick={() => toggle(id)}>{hidden ? 'Afficher' : 'Masquer'}</button></div></li>})}</ol></section></div>
}
export default ConfigurationScreen
