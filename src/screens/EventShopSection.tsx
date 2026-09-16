import { useState } from 'react'

import type { EventDto } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { eventCurrencyLabel } from '../event/event-presentation'
import { apiErrorMessage, formatResourceAmount } from '../utils/formatters'

type Target = 'PRIMOGEMS' | 'MORAS'
type Props = Readonly<{
  value: EventDto
  onConvert?: (target: Target, quantity: number, key: string) => Promise<EventDto>
  onPurchaseCollection?: (key: string) => Promise<EventDto>
}>

const cards = [
  { target: 'PRIMOGEMS', title: 'Primogemmes', icon: '✦', rate: 'primogems' },
  { target: 'MORAS', title: 'Moras', icon: '◈', rate: 'moras' },
] as const

export default function EventShopSection({ value, onConvert, onPurchaseCollection }: Props) {
  const [quantities, setQuantities] = useState<Record<Target, string>>({ PRIMOGEMS: '1', MORAS: '1' })
  const [intent, setIntent] = useState<{ target: Target | 'COLLECTION'; quantity: number; key: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const balance = BigInt(value.shop.balance)
  const max = balance > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(balance)

  const transact = async (target: Target | 'COLLECTION') => {
    if (pending || !value.shop.available || (target === 'COLLECTION' ? !onPurchaseCollection || value.shop.collection.obtainedThisEdition || !value.shop.collection.available : !onConvert)) return
    if (intent && intent.target !== target) return
    const parsed = intent?.quantity ?? (target === 'COLLECTION' ? 1 : /^\d+$/.test(quantities[target]) ? Number(quantities[target]) : NaN)
    if (!Number.isSafeInteger(parsed) || parsed <= 0 || (!intent && target !== 'COLLECTION' && BigInt(parsed) > balance)) { setError('Choisissez une quantité valide, dans la limite de votre solde.'); return }
    if (!intent && target === 'COLLECTION' && balance < BigInt(value.shop.collection.cost)) { setError('Votre solde est insuffisant pour cet objet.'); return }
    const next = intent ?? { target, quantity: parsed, key: crypto.randomUUID() }
    setIntent(next)
    setPending(true)
    setError('')
    try {
      await (target === 'COLLECTION' ? onPurchaseCollection!(next.key) : onConvert!(target, next.quantity, next.key))
      setIntent(null)
      setFeedback(target === 'COLLECTION' ? `${value.shop.collection.label} obtenue !` : `Échange effectué : ${formatResourceAmount(String(next.quantity * Number(value.shop.rates[target === 'PRIMOGEMS' ? 'primogems' : 'moras'])))} ${target === 'PRIMOGEMS' ? 'Primogemmes' : 'Moras'}.`)
    } catch (reason) {
      if (!isAmbiguousMutationError(reason)) setIntent(null)
      setError(apiErrorMessage(reason))
    } finally {
      setPending(false)
    }
  }

  return <section className="event-shop" aria-label="Boutique du Festival">
    <div className="panel event-shop-balance"><div><span className="eyebrow">Votre solde du Festival</span><h2>{formatResourceAmount(value.shop.balance)} {eventCurrencyLabel(value.shop.balance, value.festival.currency)}</h2><p>Vos monnaies de ce Festival restent disponibles d’une année à l’autre.</p></div><span aria-hidden="true">{value.festival.currency.emoji}</span></div>
    {!value.shop.available && <p className="event-shop-preview">La boutique est consultable librement. Rejoignez le Festival pour effectuer un échange.</p>}
    <div className="event-shop-grid">
      {cards.map(({ target, title, icon, rate }) => {
        const quantity = /^\d+$/.test(quantities[target]) ? Number(quantities[target]) : NaN
        const valid = Number.isSafeInteger(quantity) && quantity > 0 && BigInt(quantity) <= balance
        return <article className="panel event-shop-card" key={target}>
          <span className="event-shop-icon" aria-hidden="true">{icon}</span><span className="eyebrow">Conversion</span><h2>{title}</h2>
          <p>1 {value.festival.currency.unit} → {formatResourceAmount(value.shop.rates[rate])} {title}</p>
          <label htmlFor={`event-shop-${target}`}>Quantité à échanger</label>
          <div className="event-shop-quantity"><button type="button" onClick={() => setQuantities((current) => ({ ...current, [target]: String(Math.max(1, Number(current[target]) - 1 || 1)) }))} disabled={pending || Boolean(intent)} aria-label={`Diminuer la quantité de ${title}`}>−</button><input id={`event-shop-${target}`} type="number" min="1" step="1" inputMode="numeric" value={quantities[target]} disabled={pending || Boolean(intent)} onChange={(event) => setQuantities((current) => ({ ...current, [target]: event.target.value }))} /><button type="button" onClick={() => setQuantities((current) => ({ ...current, [target]: String(Math.min(max, (Number(current[target]) || 0) + 1)) }))} disabled={pending || Boolean(intent) || max === 0} aria-label={`Augmenter la quantité de ${title}`}>+</button><button type="button" className="event-shop-max" onClick={() => setQuantities((current) => ({ ...current, [target]: String(max) }))} disabled={pending || Boolean(intent) || max === 0}>MAX</button></div>
          <p className="event-shop-preview-total">Vous recevez <strong>{valid ? formatResourceAmount((BigInt(quantity) * BigInt(value.shop.rates[rate])).toString()) : '0'} {title}</strong></p>
          <button type="button" className="small-primary-button" disabled={!value.shop.available || !onConvert || pending || (!valid && intent?.target !== target) || Boolean(intent && intent.target !== target)} onClick={() => void transact(target)}>{pending && intent?.target === target ? 'Échange…' : intent?.target === target ? 'Réessayer' : 'Convertir'}</button>
        </article>
      })}
      <article className="panel event-shop-card event-shop-collection"><span className="event-shop-icon" aria-hidden="true">✧</span><span className="eyebrow">Objet Collection</span><h2>{value.shop.collection.label}</h2><p>{formatResourceAmount(value.shop.collection.cost)} {eventCurrencyLabel(value.shop.collection.cost, value.festival.currency)} · un exemplaire par édition</p><p className="event-shop-collection-state">{value.shop.collection.obtainedThisEdition ? `Obtenu — édition ${value.edition.year}` : 'À conserver dans votre Collection.'}</p><button type="button" className="small-primary-button" disabled={!value.shop.available || !onPurchaseCollection || !value.shop.collection.available || value.shop.collection.obtainedThisEdition || (balance < BigInt(value.shop.collection.cost) && intent?.target !== 'COLLECTION') || pending || Boolean(intent && intent.target !== 'COLLECTION')} onClick={() => void transact('COLLECTION')}>{value.shop.collection.obtainedThisEdition ? 'Déjà obtenu' : pending && intent?.target === 'COLLECTION' ? 'Achat…' : intent?.target === 'COLLECTION' ? 'Réessayer' : 'Acheter'}</button></article>
    </div>
    <p className="event-shop-feedback" role={error ? 'alert' : 'status'} aria-live="polite">{error || feedback}</p>
  </section>
}
