import { useState } from 'react'

import type { EventDto } from '../api/types'
import { eventCurrencyLabel } from '../event/event-presentation'
import { formatResourceAmount } from '../utils/formatters'

export type EventShopTarget = 'PRIMOGEMS' | 'MORAS' | 'COLLECTION'
export type EventShopIntent = Readonly<{ target: EventShopTarget; quantity: number; key: string }>
type Props = Readonly<{
  value: EventDto
  intent: EventShopIntent | null
  pending: boolean
  feedback: string
  error: string
  canConvert: boolean
  canPurchaseCollection: boolean
  onTransact: (target: EventShopTarget, quantity: number) => void
}>

const cards = [
  { target: 'PRIMOGEMS', title: 'Primogemmes', icon: '✦', rate: 'primogems' },
  { target: 'MORAS', title: 'Moras', icon: '◈', rate: 'moras' },
] as const

export default function EventShopSection({ value, intent, pending, feedback, error, canConvert, canPurchaseCollection, onTransact }: Props) {
  const [quantities, setQuantities] = useState<Record<'PRIMOGEMS' | 'MORAS', string>>({ PRIMOGEMS: '1', MORAS: '1' })
  const balance = BigInt(value.shop.balance)
  const max = balance > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(balance)

  return <section className="event-shop" aria-label="Boutique du Festival">
    <div className="panel event-shop-balance"><div><span className="eyebrow">Votre solde du Festival</span><h2>{formatResourceAmount(value.shop.balance)} {eventCurrencyLabel(value.shop.balance, value.festival.currency)}</h2><p>Vos monnaies de ce Festival restent disponibles d’une année à l’autre.</p></div><span aria-hidden="true">{value.festival.currency.emoji}</span></div>
    {!value.shop.available && <p className="event-shop-preview">La boutique est consultable librement. Rejoignez le Festival pour effectuer un échange.</p>}
    <div className="event-shop-grid">
      {cards.map(({ target, title, icon, rate }) => {
        const displayedQuantity = intent?.target === target ? String(intent.quantity) : quantities[target]
        const quantity = /^\d+$/.test(displayedQuantity) ? Number(displayedQuantity) : NaN
        const valid = Number.isSafeInteger(quantity) && quantity > 0 && BigInt(quantity) <= balance
        return <article className="panel event-shop-card" key={target}>
          <span className="event-shop-icon" aria-hidden="true">{icon}</span><span className="eyebrow">Conversion</span><h2>{title}</h2>
          <p>1 {value.festival.currency.unit} → {formatResourceAmount(value.shop.rates[rate])} {title}</p>
          <label htmlFor={`event-shop-${target}`}>Quantité à échanger</label>
          <div className="event-shop-quantity"><button type="button" onClick={() => setQuantities((current) => ({ ...current, [target]: String(Math.max(1, Number(current[target]) - 1 || 1)) }))} disabled={pending || Boolean(intent)} aria-label={`Diminuer la quantité de ${title}`}>−</button><input id={`event-shop-${target}`} type="number" min="1" step="1" inputMode="numeric" value={displayedQuantity} disabled={pending || Boolean(intent)} onChange={(event) => setQuantities((current) => ({ ...current, [target]: event.target.value }))} /><button type="button" onClick={() => setQuantities((current) => ({ ...current, [target]: String(Math.min(max, (Number(current[target]) || 0) + 1)) }))} disabled={pending || Boolean(intent) || max === 0} aria-label={`Augmenter la quantité de ${title}`}>+</button><button type="button" className="event-shop-max" onClick={() => setQuantities((current) => ({ ...current, [target]: String(max) }))} disabled={pending || Boolean(intent) || max === 0}>MAX</button></div>
          <p className="event-shop-preview-total">Vous recevez <strong>{valid ? formatResourceAmount((BigInt(quantity) * BigInt(value.shop.rates[rate])).toString()) : '0'} {title}</strong></p>
          <button type="button" className="small-primary-button" disabled={!value.shop.available || !canConvert || pending || (!valid && intent?.target !== target) || Boolean(intent && intent.target !== target)} onClick={() => onTransact(target, quantity)}>{pending && intent?.target === target ? 'Échange…' : intent?.target === target ? 'Réessayer' : 'Convertir'}</button>
        </article>
      })}
      <article className="panel event-shop-card event-shop-collection"><span className="event-shop-icon" aria-hidden="true">✧</span><span className="eyebrow">Objet Collection</span><h2>{value.shop.collection.label}</h2><p>{formatResourceAmount(value.shop.collection.cost)} {eventCurrencyLabel(value.shop.collection.cost, value.festival.currency)} · un exemplaire par édition</p><p className="event-shop-collection-state">{value.shop.collection.obtainedThisEdition ? `Obtenu — édition ${value.edition.year}` : 'À conserver dans votre Collection.'}</p><button type="button" className="small-primary-button" disabled={!value.shop.available || !canPurchaseCollection || !value.shop.collection.available || value.shop.collection.obtainedThisEdition || (balance < BigInt(value.shop.collection.cost) && intent?.target !== 'COLLECTION') || pending || Boolean(intent && intent.target !== 'COLLECTION')} onClick={() => onTransact('COLLECTION', 1)}>{value.shop.collection.obtainedThisEdition ? 'Déjà obtenu' : pending && intent?.target === 'COLLECTION' ? 'Achat…' : intent?.target === 'COLLECTION' ? 'Réessayer' : 'Acheter'}</button></article>
    </div>
    <p className={`event-shop-feedback${feedback && !error ? ' success' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite">{error || feedback}</p>
  </section>
}
