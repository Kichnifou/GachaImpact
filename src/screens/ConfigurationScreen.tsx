import PrivacySettingsPanel from './PrivacySettingsPanel'
import AccountSettingsPanel from './AccountSettingsPanel'
import type { SocialActions } from '../social/types'
import { useEffect, useRef, useState } from 'react'
import type { NavigationMenuDestinationId, NavigationMenuPreferenceDto } from '../api/types'
import { navigationDestinations } from '../navigation/navigation'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage } from '../utils/formatters'

function ConfigurationScreen({ preference, onSave, onReset, socialActions, initialTab = 'menu' }: { socialActions?: SocialActions; initialTab?: 'menu' | 'privacy' | 'account'; preference: NavigationMenuPreferenceDto; onSave: (value: NavigationMenuPreferenceDto) => Promise<void>; onReset: () => Promise<void> }) {
  const [tab, setTab] = useState<'menu' | 'privacy' | 'account'>(initialTab)
  const [draft, setDraft] = useState(preference)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmedRef = useRef(preference)
  const replaceDraft = (next: NavigationMenuPreferenceDto) => setDraft(next)
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active && !pending) { confirmedRef.current = preference; replaceDraft(preference) } })
    return () => { active = false }
  }, [pending, preference])
  const persist = async (next: NavigationMenuPreferenceDto, rollback = draft) => {
    replaceDraft(next); setPending(true); setError(null)
    try { await onSave(next); confirmedRef.current = next }
    catch (reason) { replaceDraft(rollback); setError(apiErrorMessage(reason)) }
    finally { setPending(false) }
  }
  const move = (id: NavigationMenuDestinationId, delta: -1 | 1) => { const order = [...draft.order]; const index = order.indexOf(id); const target = index + delta; if (index < 0 || target < 0 || target >= order.length) return; [order[index], order[target]] = [order[target]!, order[index]!]; void persist({ ...draft, order }) }
  const toggle = (id: NavigationMenuDestinationId) => { if (id === 'configuration') return; const hidden = draft.hidden.includes(id) ? draft.hidden.filter((value) => value !== id) : [...draft.hidden, id]; void persist({ ...draft, hidden }) }

  return <div className="screen-content configuration-screen long-screen-layout">
    <ScreenHeader eyebrow="Préférences" title="Configuration" description="Personnalisez le Menu global. Ces choix suivent votre compte." />
    <nav className="configuration-tabs" aria-label="Sections Configuration"><button type="button" className={tab === 'menu' ? 'active' : ''} aria-current={tab === 'menu' ? 'page' : undefined} onClick={() => setTab('menu')}>Menu</button><button type="button" className={tab === 'privacy' ? 'active' : ''} aria-current={tab === 'privacy' ? 'page' : undefined} disabled={!socialActions} onClick={() => setTab('privacy')}>Confidentialité</button><button type="button" className={tab === 'account' ? 'active' : ''} aria-current={tab === 'account' ? 'page' : undefined} onClick={() => setTab('account')}>Compte</button><button type="button" disabled>Apparence</button></nav>
    {tab === 'account' ? <AccountSettingsPanel /> : tab === 'privacy' && socialActions ? <PrivacySettingsPanel actions={socialActions} /> : <ScrollableScreenPanel className="configuration-frame" fixed={<header className="menu-configuration-heading"><div><h2>Menu</h2></div><button type="button" disabled={pending} onClick={() => { setPending(true); setError(null); void onReset().catch((reason) => setError(apiErrorMessage(reason))).finally(() => setPending(false)) }}>Réinitialiser</button></header>}>
      {error && <p className="configuration-error" role="alert">{error}</p>}
      <ol className="menu-configuration-list">{draft.order.map((id, index) => { const item = navigationDestinations.find((entry) => entry.id === id); if (!item) return null; const hidden = draft.hidden.includes(id); const visibleIndex = draft.order.filter((entry) => !draft.hidden.includes(entry)).indexOf(id); return <li key={id}><span aria-hidden="true">{item.icon}</span><strong>{item.label}</strong><small>{hidden ? 'Masqué' : `Page ${Math.floor(visibleIndex / 9) + 1} · position ${(visibleIndex % 9) + 1}`}</small><div><button type="button" disabled={pending || index === 0} onClick={() => move(id, -1)} aria-label={`Monter ${item.label}`}>↑</button><button type="button" disabled={pending || index === draft.order.length - 1} onClick={() => move(id, 1)} aria-label={`Descendre ${item.label}`}>↓</button><button type="button" className="menu-visibility-button" disabled={pending || id === 'configuration'} onClick={() => toggle(id)}>{hidden ? 'Afficher' : 'Masquer'}</button></div></li>})}</ol>
    </ScrollableScreenPanel>}
  </div>
}
export default ConfigurationScreen
