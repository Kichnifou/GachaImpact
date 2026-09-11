import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlayerShopDto, ShopEffectDto, ShopHistoryDto, ShopItemDto, ShopPurchaseDto, ShopPurchaseRecordDto } from '../api/types'
import GameAssetIcon from '../components/GameAssetIcon'
import HistoryModalShell from '../components/HistoryModalShell'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'
import { currencyAssetPaths } from '../utils/gameAssets'

type Props = { initialShop: PlayerShopDto | null; onLoad: () => Promise<PlayerShopDto>; onLoadHistory: (page: number) => Promise<ShopHistoryDto>; onPurchase: (itemId: string, quantity: string) => Promise<ShopPurchaseDto>; onNavigateBank: () => void }

function ShopScreen({ initialShop, onLoad, onLoadHistory, onPurchase, onNavigateBank }: Props) {
  const [shop, setShop] = useState(initialShop)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [ticketResult, setTicketResult] = useState<ShopEffectDto | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const mounted = useRef(false)
  const load = useCallback(async () => { const result = await onLoad(); if (mounted.current) { setShop(result); setError(null) }; return result }, [onLoad])

  useEffect(() => { mounted.current = true; void load().catch((reason) => { if (mounted.current) setError(apiErrorMessage(reason)) }); return () => { mounted.current = false } }, [load])

  const purchase = async (item: ShopItemDto) => {
    if (pendingItemId || !item.available) return
    const quantity = item.quantityMode === 'unit' ? '1' : (quantities[item.id] ?? '1').trim()
    if (!/^[1-9]\d*$/.test(quantity)) { setError('Saisissez une quantité entière strictement positive.'); return }
    setPendingItemId(item.id); setError(null); setFeedback(null)
    try {
      const result = await onPurchase(item.id, quantity)
      setShop(result)
      if (result.purchase.effect.type.startsWith('ticket_')) setTicketResult(result.purchase.effect)
      else setFeedback(`${effectLabel(result.purchase.effect)} · ${formatResourceAmount(result.purchase.totalPrice)} Moras dépensés`)
    } catch (reason) { setError(apiErrorMessage(reason)) }
    finally { setPendingItemId(null) }
  }

  if (!shop) return <div className="screen-content shop-screen"><section className="panel shop-status" role={error ? 'alert' : 'status'}><strong>{error ?? 'Ouverture de la Boutique…'}</strong>{error && <button type="button" onClick={() => void load()}>Réessayer</button>}</section></div>

  return <div className="screen-content shop-screen long-screen-layout">
    <ScrollableScreenPanel className="shop-screen-panel" bodyClassName="shop-scroll-body" fixed={<>
      <header className="shop-hero"><div><span className="eyebrow">Échanges astraux</span><h1>Boutique</h1><p>Le catalogue et chaque transaction sont validés par le serveur.</p></div><button type="button" className="shop-wallet" onClick={onNavigateBank} aria-label={`Ouvrir la Banque — portefeuille ${formatResourceAmount(shop.resources.moras)} Moras`}><GameAssetIcon className="shop-wallet-icon" src={currencyAssetPaths.mora} fallback="●" /><span>Portefeuille</span><strong>{formatResourceAmount(shop.resources.moras)} Moras</strong></button></header>
      <div className="shop-feedback-slot" aria-live="polite">{error ? <span className="error" role="alert">{error}</span> : feedback ? <span>{feedback}</span> : <span aria-hidden="true">&nbsp;</span>}</div>
    </>}>
      <section className="shop-grid" aria-label="Catalogue Boutique">{shop.items.map((item) => <ShopItemCard key={item.id} item={item} walletMoras={shop.resources.moras} quantity={quantities[item.id] ?? '1'} pending={pendingItemId === item.id} anyPending={pendingItemId !== null} onQuantity={(value) => setQuantities((current) => ({ ...current, [item.id]: value.replace(/[^0-9]/g, '') }))} onMax={() => setQuantities((current) => ({ ...current, [item.id]: (BigInt(shop.resources.moras) / BigInt(item.priceAmount)).toString() }))} onPurchase={() => void purchase(item)} />)}</section>
      <RecentPurchase purchase={shop.recentPurchases[0] ?? null} onOpenHistory={() => setHistoryOpen(true)} />
    </ScrollableScreenPanel>
    {ticketResult && <TicketResultModal effect={ticketResult} onClose={() => setTicketResult(null)} />}
    {historyOpen && <ShopHistoryModal onClose={() => setHistoryOpen(false)} onLoad={onLoadHistory} />}
  </div>
}

function ShopItemCard({ item, walletMoras, quantity, pending, anyPending, onQuantity, onMax, onPurchase }: { item: ShopItemDto; walletMoras: string; quantity: string; pending: boolean; anyPending: boolean; onQuantity: (value: string) => void; onMax: () => void; onPurchase: () => void }) {
  const parsedQuantity = /^\d+$/.test(quantity) ? BigInt(quantity) : 0n
  const total = BigInt(item.priceAmount) * parsedQuantity
  const reward = item.rewardPerUnit ? BigInt(item.rewardPerUnit.amount) * parsedQuantity : null
  const canAfford = parsedQuantity > 0n && total <= BigInt(walletMoras)
  return <article className={`shop-item panel ${item.visualKey}${item.available ? '' : ' unavailable'}`}><div className="shop-item-heading"><span className="shop-item-symbol" aria-hidden="true">{item.visualKey === 'mission' ? '▤' : item.visualKey === 'ticket' ? '✦' : '◆'}</span><div><span className="shop-tag">{item.effectType === 'random_ticket' ? 'Récompense immédiate' : item.effectType === 'daily_mission' ? 'Quotidien' : 'Ressources'}</span><h2>{item.displayName}</h2></div></div><p className="shop-description">{item.description}</p>{item.ticketRewards.length > 0 && <ul className="shop-ticket-odds">{item.ticketRewards.map((rewardOption) => <li key={rewardOption.id}><span>{rewardOption.label}</span><strong>{formatProbability(rewardOption.probabilityBasisPoints)}</strong></li>)}</ul>}<div className="shop-card-controls">{item.quantityMode === 'multiple' ? <div className="shop-quantity"><label><span>Quantité</span><input inputMode="numeric" value={quantity} disabled={anyPending} onChange={(event) => onQuantity(event.target.value)} /></label><button type="button" disabled={anyPending || BigInt(walletMoras) < BigInt(item.priceAmount)} onClick={onMax}>MAX</button></div> : <div className="shop-unit-label">Achat unitaire</div>}<div className="shop-totals"><span><GameAssetIcon className="shop-price-icon" src={currencyAssetPaths.mora} fallback="●" /> {formatResourceAmount((item.quantityMode === 'multiple' ? total : BigInt(item.priceAmount)).toString())} Moras</span>{reward !== null && <span className="reward"><GameAssetIcon className="shop-reward-icon" src={currencyAssetPaths.primogem} fallback="◆" /> +{formatResourceAmount(reward.toString())} Primos</span>}</div><div className="shop-availability">{item.available ? <span aria-hidden="true">&nbsp;</span> : <span>{item.unavailableReason ?? 'Indisponible'}</span>}</div><button type="button" className="shop-buy-button" disabled={anyPending || !item.available || (item.quantityMode === 'multiple' && !canAfford) || (item.quantityMode === 'unit' && BigInt(walletMoras) < BigInt(item.priceAmount))} onClick={onPurchase}>{pending ? 'Traitement…' : 'Acheter'}</button></div></article>
}

function RecentPurchase({ purchase, onOpenHistory }: { purchase: ShopPurchaseRecordDto | null; onOpenHistory: () => void }) {
  return <section className="panel shop-history"><header><div><span className="eyebrow">Activité</span><h2>Dernière transaction</h2></div><button type="button" onClick={onOpenHistory}>Voir l’historique</button></header>{!purchase ? <p className="shop-history-empty">Votre première transaction apparaîtra ici.</p> : <dl className="shop-last-purchase"><div><dt>Article</dt><dd>{purchase.displayName}</dd></div><div><dt>Quantité</dt><dd>{purchase.quantity}</dd></div><div><dt>Date</dt><dd>{formatPurchaseDate(purchase.purchasedAt)}</dd></div><div><dt>Résultat</dt><dd>{effectLabel(purchase.effect)}</dd></div><div><dt>Coût</dt><dd>−{formatResourceAmount(purchase.totalPrice)} Moras</dd></div></dl>}</section>
}

export function ShopHistoryModal({ onClose, onLoad }: { onClose: () => void; onLoad: (page: number) => Promise<ShopHistoryDto> }) {
  const [page, setPage] = useState(1)
  const [history, setHistory] = useState<ShopHistoryDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true); setError(null)
      try { const result = await onLoad(page); if (active) setHistory(result) }
      catch (reason) { if (active) setError(apiErrorMessage(reason)) }
      finally { if (active) setLoading(false) }
    })
    return () => { active = false }
  }, [onLoad, page])
  const visiblePage = history?.page ?? page
  return <HistoryModalShell title="Historique" category="Boutique / Achats" labelledBy="shop-history-title" page={visiblePage} totalPages={history?.totalPages ?? 0} loading={loading} onPageChange={setPage} onClose={onClose}>
    <div className="history-table-wrap">{error ? <p className="detail-status error" role="alert">{error}</p> : !history && loading ? <p className="detail-status">Chargement de l’historique…</p> : history?.totalCount === 0 ? <p className="detail-status">Aucun achat enregistré.</p> : <table className="history-table shop-history-table"><thead><tr><th>Date</th><th>Article</th><th>Quantité</th><th>Coût</th><th>Résultat</th></tr></thead><tbody>{history?.purchases.map((purchase) => <tr key={purchase.id}><td>{formatPurchaseDate(purchase.purchasedAt)}</td><td>{purchase.displayName}</td><td>{purchase.quantity}</td><td>−{formatResourceAmount(purchase.totalPrice)} Moras</td><td>{effectLabel(purchase.effect)}</td></tr>)}</tbody></table>}</div>
  </HistoryModalShell>
}

function TicketResultModal({ effect, onClose }: { effect: ShopEffectDto; onClose: () => void }) {
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close) }, [onClose])
  return <div className="modal-layer" onMouseDown={onClose}><section className="floating-panel shop-ticket-result" role="dialog" aria-modal="true" aria-labelledby="ticket-result-title" onMouseDown={(event) => event.stopPropagation()}><span className="shop-ticket-result-symbol" aria-hidden="true">✦</span><span className="eyebrow">Ticket révélé</span><h2 id="ticket-result-title">Récompense obtenue</h2><strong>{effectLabel(effect)}</strong><button type="button" onClick={onClose}>Continuer</button></section></div>
}

function effectLabel(effect: ShopEffectDto): string {
  if (effect.type === 'resource_bundle') return `+${formatResourceAmount(effect.amount)} Primos`
  if (effect.type === 'ticket_pity5') return `+${effect.grantedAmount} Pity 5★${effect.grantedAmount < effect.requestedAmount ? ' · plafond 90 atteint' : ''}`
  if (effect.type === 'ticket_other_element_particles') return `+${formatResourceAmount(effect.amount)} particules ${elementLabel(effect.elementKey)}`
  return effect.label
}
function elementLabel(element: string) { return ({ pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Électro', anemo: 'Anémo', geo: 'Géo', dendro: 'Dendro' } as Record<string, string>)[element] ?? element }
function formatProbability(basisPoints: number) { return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(basisPoints / 100)} %` }
function formatPurchaseDate(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }

export default ShopScreen
