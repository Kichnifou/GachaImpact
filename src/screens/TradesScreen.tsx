import { useState } from 'react'
import AppButton from '../components/AppButton'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import GameAssetIcon from '../components/GameAssetIcon'
import { elementLabels, formatResourceAmount } from '../utils/formatters'
import { getElementAssetPath } from '../utils/gameAssets'
import type { ElementKey } from '../api/types'
import type { TradeActions, TradeRequest, TradeSnapshot } from '../trades/types'
import { useTrades } from '../trades/use-trades'
import './TradesScreen.css'

const tabs = { create: 'Partenaires', received: 'Reçues', sent: 'Envoyées', history: 'Historique' } as const
type Tab = keyof typeof tabs
const resourceLabel = (key: string) => elementLabels[key.replace('particles_', '') as ElementKey]
export default function TradesScreen({ actions, onSnapshot, playerId }: { actions: TradeActions; onSnapshot: (value: TradeSnapshot) => void; playerId: string }) {
  const [tab, setTab] = useState<Tab>('create'), [query, setQuery] = useState(''), [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null), [amount, setAmount] = useState('')
  const controller = useTrades(actions, onSnapshot, query, page)
  const { snapshot, partners, pending, error, feedback, mutate } = controller
  const partner = partners?.partners.find(p => p.id === selected)
  const validAmount = /^[1-9][0-9]*$/.test(amount) && !!partner && BigInt(amount) <= BigInt(partner.maximum)
  const resolve = (request: TradeRequest, action: 'accept' | 'refuse' | 'cancel') => void mutate(`${action}:${request.id}`, async key => {
    const result = await actions.mutate(request.id, action, key)
    return result.state === 'UNAVAILABLE' ? 'Cette demande n’est plus disponible.' : action === 'accept' ? `Échange effectué : ${formatResourceAmount(result.amount)} contre ${formatResourceAmount(result.amount)}.` : action === 'refuse' ? 'Demande refusée.' : 'Demande annulée.'
  })
  const all = (action: 'accept' | 'refuse') => void mutate(`${action}:all`, async key => {
    const result = await actions.all(action, key), done = result.results.filter(r => r.state === (action === 'accept' ? 'ACCEPTED' : 'REFUSED')).length
    return `${done} demande${done > 1 ? 's' : ''} ${action === 'accept' ? 'acceptée' : 'refusée'}${done > 1 ? 's' : ''}.${result.results.length > done ? ' Certaines demandes ne sont plus disponibles.' : ''}`
  })
  return <div className="screen-content trades-screen long-screen-layout">
    <ScreenHeader eyebrow="Particules" title="Échanges" />
    <ScrollableScreenPanel className="trades-panel" fixed={<>
      <details className="trade-stocks" open><summary>Vos particules · Total / Réservé / Disponible</summary><div className="trade-stock-grid">{snapshot?.stocks.map(s => <div key={s.resourceKey} className="trade-stock"><strong>{resourceLabel(s.resourceKey)}</strong><span title="Total">{formatResourceAmount(s.total)}</span><span title="Réservé">{formatResourceAmount(s.reserved)}</span><b title="Disponible">{formatResourceAmount(s.available)}</b></div>)}</div></details>
      <nav className="trade-tabs" aria-label="Sections Échanges">{Object.entries(tabs).map(([id, label]) => <AppButton key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id as Tab)}>{label}{id === 'received' && snapshot?.received.length ? ` (${snapshot.received.length})` : id === 'sent' && snapshot?.sent.length ? ` (${snapshot.sent.length})` : ''}</AppButton>)}</nav>
      <div className="trade-feedback" role={error ? 'alert' : 'status'}>{pending ? 'Traitement en cours…' : error || feedback || '\u00a0'}{controller.canRetry && <AppButton disabled={pending} onClick={controller.retry}>Réessayer l’action</AppButton>}</div>
      {tab === 'create' && <div className="trade-controls"><input aria-label="Rechercher un partenaire" placeholder="Rechercher un partenaire" value={query} maxLength={100} onChange={e => { setQuery(e.target.value); setPage(1); setSelected(null) }} /><span>Un échange : même quantité des deux éléments.</span></div>}
      {tab === 'received' && <div className="trade-controls"><AppButton disabled={pending || !snapshot?.received.length} onClick={() => all('accept')}>Accepter tout</AppButton><AppButton disabled={pending || !snapshot?.received.length} onClick={() => all('refuse')}>Refuser tout</AppButton><small>Les plus anciennes d’abord.</small></div>}
    </>} footer={tab === 'create' ? <div className="trade-pagination"><AppButton disabled={pending || !partners || partners.page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</AppButton><span>{partners?.page ?? 1} / {partners?.totalPages ?? 1}</span><AppButton disabled={pending || !partners || partners.page >= partners.totalPages} onClick={() => setPage(p => p + 1)}>Suivant</AppButton></div> : undefined}>
      {!snapshot && <p>Chargement des échanges…</p>}
      {snapshot && tab === 'create' && <>
        <div className="trade-compose"><label>Partenaire<select aria-label="Partenaire" value={selected ?? ''} disabled={pending} onChange={e => { setSelected(e.target.value || null); setAmount('') }}><option value="">Choisir un partenaire</option>{partners?.partners.map(p => <option key={p.id} value={p.id}>{p.displayName} · {elementLabels[p.elementKey]}</option>)}</select></label><label>Quantité<input aria-label="Quantité" inputMode="numeric" value={amount} maxLength={19} disabled={pending} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} /></label><AppButton disabled={pending || !partner} onClick={() => partner && setAmount(partner.maximum)}>MAX</AppButton><AppButton variant="primary" disabled={pending || !validAmount} onClick={() => { if (partner) void mutate(`create:${partner.id}:${amount}`, async key => { await actions.create(partner.id, amount, key); setAmount(''); setSelected(null); return 'Demande envoyée.' }) }}>Envoyer</AppButton></div>
        <p className="trade-help">Seules vos particules proposées sont réservées. Les demandes expirent à minuit, heure de Paris.</p>
        <div className="trade-list">{partners?.partners.map(p => <button type="button" className={`trade-partner${selected === p.id ? ' selected' : ''}`} key={p.id} disabled={pending} onClick={() => { setSelected(p.id); setAmount('') }}><span className="trade-element"><GameAssetIcon src={getElementAssetPath(p.elementKey)} fallback="✦" /></span><strong>{p.displayName}</strong><span>{elementLabels[p.elementKey]}</span><span>Maximum : <b>{formatResourceAmount(p.maximum)}</b></span></button>)}</div>
        {partners && !partners.partners.length && <p>Aucun partenaire échangeable pour cette recherche.</p>}
      </>}
      {snapshot && (tab === 'received' || tab === 'sent') && <div className="trade-list">{snapshot[tab].map(r => <article className="trade-request" key={r.id}><div><strong>{tab === 'received' ? r.sender.displayName : r.recipient.displayName}</strong><p>{formatResourceAmount(r.currentAmount)} {resourceLabel(r.senderResourceKey)} ⇄ {formatResourceAmount(r.currentAmount)} {resourceLabel(r.recipientResourceKey)}</p>{r.originalAmount !== r.currentAmount && <small>Montant initial : {formatResourceAmount(r.originalAmount)}</small>}</div><div className="trade-row-actions">{tab === 'received' ? <><AppButton disabled={pending} variant="primary" onClick={() => resolve(r, 'accept')}>Accepter</AppButton><AppButton disabled={pending} onClick={() => resolve(r, 'refuse')}>Refuser</AppButton></> : <AppButton disabled={pending} onClick={() => resolve(r, 'cancel')}>Annuler</AppButton>}</div></article>)}{!snapshot[tab].length && <p>Aucune demande {tab === 'received' ? 'reçue' : 'envoyée'}.</p>}</div>}
      {snapshot && tab === 'history' && <div className="trade-history" aria-label="Échanges récents">{snapshot.history.map(r => <article className="trade-request" key={r.id}><div><strong>{r.sender.id === playerId ? r.recipient.displayName : r.sender.displayName}</strong><p>{formatResourceAmount(r.amount)} {resourceLabel(r.senderResourceKey)} ⇄ {formatResourceAmount(r.amount)} {resourceLabel(r.recipientResourceKey)}</p></div><time dateTime={r.executedAt}>{new Date(r.executedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</time></article>)}{!snapshot.history.length && <p>Aucun échange effectué.</p>}</div>}
    </ScrollableScreenPanel>
  </div>
}
