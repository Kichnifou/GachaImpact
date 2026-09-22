import { useEffect, useRef, useState } from 'react'
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
export type TradeOpenIntent = { token: string; tab?: Tab; partner?: { id: string; displayName: string } }
const resourceLabel = (key: string) => elementLabels[key.replace('particles_', '') as ElementKey]
export default function TradesScreen({ actions, onSnapshot, playerId, intent, refreshToken = 0 }: { actions: TradeActions; onSnapshot: (value: TradeSnapshot) => void; playerId: string; intent?: TradeOpenIntent; refreshToken?: number }) {
  const [tab, setTab] = useState<Tab>(intent?.tab ?? 'create'), [query, setQuery] = useState(intent?.partner?.displayName ?? ''), [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(intent?.partner?.id ?? null), [amount, setAmount] = useState(''), [searchOpen, setSearchOpen] = useState(false)
  const handledIntent = useRef(intent), searchBox = useRef<HTMLDivElement>(null)
  const controller = useTrades(actions, onSnapshot, query, page, tab === 'create')
  const { snapshot, partners, pending, error, feedback, mutate } = controller
  const { clearFeedback, refresh, refreshPartners } = controller
  const seenRefreshToken = useRef(refreshToken)
  useEffect(() => {
    if (seenRefreshToken.current === refreshToken) return
    seenRefreshToken.current = refreshToken
    void refresh()
    refreshPartners()
  }, [refreshToken, refresh, refreshPartners])
  useEffect(() => { if (intent && intent !== handledIntent.current) { handledIntent.current = intent; setTab(intent.tab ?? 'create'); setQuery(intent.partner?.displayName ?? ''); setPage(1); setSelected(intent.partner?.id ?? null); clearFeedback(); void refresh() } }, [intent, clearFeedback, refresh])
  const selectPartner = (id: string) => { const choice = partners?.partners.find(p => p.id === id); if (!choice) return; setSelected(id); setQuery(choice.displayName); setPage(1); setAmount(''); setSearchOpen(false) }
  const changeTab = (next: Tab) => { if (next !== tab) { clearFeedback(); setTab(next) } }
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
      <details className="trade-stocks"><summary>Vos particules · Total / Réservé / Disponible</summary><div className="trade-stock-grid">{snapshot?.stocks.map(s => <div key={s.resourceKey} className="trade-stock"><strong>{resourceLabel(s.resourceKey)}</strong><span title="Total">{formatResourceAmount(s.total)}</span><span title="Réservé">{formatResourceAmount(s.reserved)}</span><b title="Disponible">{formatResourceAmount(s.available)}</b></div>)}</div></details>
      <nav className="trade-tabs" aria-label="Sections Échanges">{Object.entries(tabs).map(([id, label]) => <AppButton key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => changeTab(id as Tab)}>{label}{id === 'received' && snapshot?.received.length ? ` (${snapshot.received.length})` : id === 'sent' && snapshot?.sent.length ? ` (${snapshot.sent.length})` : ''}</AppButton>)}</nav>
      <div className="trade-feedback" role={error ? 'alert' : 'status'}>{pending ? 'Traitement en cours…' : error || feedback || '\u00a0'}{controller.canRetry && <AppButton disabled={pending} onClick={controller.retry}>Réessayer l’action</AppButton>}</div>
      {controller.syncError && <small role="status">{controller.syncError}</small>}
      {tab === 'create' && <div className="trade-compose"><div className="trade-search" ref={searchBox} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setSearchOpen(false) }} onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); searchBox.current?.querySelector('input')?.focus() } }}><label>Partenaire<input role="combobox" aria-expanded={searchOpen && !!query} aria-controls="trade-partner-options" aria-autocomplete="list" aria-label="Rechercher un partenaire" placeholder="Rechercher un partenaire" value={query} maxLength={100} onFocus={() => setSearchOpen(true)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); searchBox.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus() } }} onChange={e => { setQuery(e.target.value); setPage(1); setSelected(null); setSearchOpen(true) }} /></label><div id="trade-partner-options" role="listbox" aria-label="Résultats partenaires" className="trade-search-results" hidden={!searchOpen || !query}>{partners?.partners.map(p => <button type="button" role="option" aria-selected={selected === p.id} key={p.id} disabled={pending} onClick={() => selectPartner(p.id)}>{p.displayName} · {formatResourceAmount(p.maximum)}</button>)}{partners && !partners.partners.length && <span>Aucun partenaire disponible.</span>}</div></div><label>Quantité<input aria-label="Quantité" inputMode="numeric" value={amount} disabled={pending} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} /></label><AppButton disabled={pending || !partner} onClick={() => partner && setAmount(partner.maximum)}>MAX</AppButton><AppButton variant="primary" disabled={pending || !validAmount} onClick={() => { if (partner) void mutate(`create:${partner.id}:${amount}`, async key => { await actions.create(partner.id, amount, key); setAmount(''); setSelected(null); return 'Demande envoyée.' }) }}>Envoyer</AppButton>{intent?.partner && partners && !partner && selected === intent.partner.id && <span>Aucun échange disponible avec ce joueur pour le moment.</span>}</div>}
      {tab === 'received' && <div className="trade-controls"><AppButton disabled={pending || !snapshot?.received.length} onClick={() => all('accept')}>Accepter tout</AppButton><AppButton disabled={pending || !snapshot?.received.length} onClick={() => all('refuse')}>Refuser tout</AppButton></div>}
    </>} footer={tab === 'create' ? <div className="trade-pagination"><AppButton disabled={pending || !partners || partners.page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</AppButton><span>{partners?.page ?? 1} / {partners?.totalPages ?? 1}</span><AppButton disabled={pending || !partners || partners.page >= partners.totalPages} onClick={() => setPage(p => p + 1)}>Suivant</AppButton></div> : undefined}>
      {!snapshot && <p>Chargement des échanges…</p>}
      {snapshot && tab === 'create' && <>
        <div className="trade-list">{partners?.partners.map(p => <button type="button" className={`trade-partner${selected === p.id ? ' selected' : ''}`} key={p.id} disabled={pending} aria-pressed={selected === p.id} onClick={() => selectPartner(p.id)}><span className="trade-element"><GameAssetIcon src={getElementAssetPath(p.elementKey)} fallback="✦" /></span><strong>{p.displayName}</strong><span>Échangeable : <b>{formatResourceAmount(p.maximum)}</b></span></button>)}</div>
        {partners && !partners.partners.length && <p>Aucun partenaire échangeable pour cette recherche.</p>}
      </>}
      {snapshot && (tab === 'received' || tab === 'sent') && <div className="trade-list">{snapshot[tab].map(r => <article className="trade-request" key={r.id}><div><strong>{tab === 'received' ? r.sender.displayName : r.recipient.displayName}</strong><p>{formatResourceAmount(r.currentAmount)} {resourceLabel(r.senderResourceKey)} ⇄ {formatResourceAmount(r.currentAmount)} {resourceLabel(r.recipientResourceKey)}</p>{r.originalAmount !== r.currentAmount && <small>Montant initial : {formatResourceAmount(r.originalAmount)}</small>}</div><div className="trade-row-actions">{tab === 'received' ? <><AppButton disabled={pending} variant="primary" onClick={() => resolve(r, 'accept')}>Accepter</AppButton><AppButton disabled={pending} onClick={() => resolve(r, 'refuse')}>Refuser</AppButton></> : <AppButton disabled={pending} onClick={() => resolve(r, 'cancel')}>Annuler</AppButton>}</div></article>)}{!snapshot[tab].length && <p>Aucune demande {tab === 'received' ? 'reçue' : 'envoyée'}.</p>}</div>}
      {snapshot && tab === 'history' && <div className="trade-history" aria-label="Échanges récents">{snapshot.history.map(r => <article className="trade-request" key={r.id}><div><strong>{r.sender.id === playerId ? r.recipient.displayName : r.sender.displayName}</strong><p>{formatResourceAmount(r.amount)} {resourceLabel(r.senderResourceKey)} ⇄ {formatResourceAmount(r.amount)} {resourceLabel(r.recipientResourceKey)}</p></div><time dateTime={r.executedAt}>{new Date(r.executedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</time></article>)}{!snapshot.history.length && <p>Aucun échange effectué.</p>}</div>}
    </ScrollableScreenPanel>
  </div>
}
