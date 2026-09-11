import { useState } from 'react'
import type { DailyChallengeMutationDto, ElementKey } from '../api/types'
import { isAmbiguousMutationError } from '../api/mutation-errors'
import { apiErrorMessage, elementLabels, formatResourceAmount } from '../utils/formatters'

type Props = {
  elementKey: ElementKey
  stock: string
  onClose: () => void
  onConvert: (amount: string, idempotencyKey: string) => Promise<DailyChallengeMutationDto>
}

function ParticleConversionModal({ elementKey, stock, onClose, onConvert }: Props) {
  const [amount, setAmount] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intent, setIntent] = useState<{ amount: string; key: string } | null>(null)
  const valid = /^\d+$/.test(amount) && BigInt(amount) >= 1n && BigInt(amount) <= BigInt(stock)

  const submit = async () => {
    if (!valid || pending) return
    const currentIntent = intent?.amount === amount ? intent : { amount, key: crypto.randomUUID() }
    setIntent(currentIntent)
    setPending(true)
    setError(null)
    try {
      await onConvert(amount, currentIntent.key)
      setIntent(null)
      onClose()
    } catch (reason) {
      if (!isAmbiguousMutationError(reason)) setIntent(null)
      setError(apiErrorMessage(reason))
    } finally {
      setPending(false)
    }
  }

  return <div className="modal-layer" role="presentation" onMouseDown={onClose}><section className="floating-panel particle-conversion-modal" role="dialog" aria-modal="true" aria-labelledby="particle-conversion-title" onMouseDown={(event) => event.stopPropagation()}>
    <header className="floating-panel-heading"><div><span className="eyebrow">Conversion 1:1</span><h2 id="particle-conversion-title">Convertir vos particules {elementLabels[elementKey]}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer la conversion"><span className="icon-glyph">×</span></button></header>
    <p>Disponible : <strong>{formatResourceAmount(stock)}</strong></p>
    <label>Quantité<input type="text" inputMode="numeric" value={amount} onChange={(event) => { setAmount(event.target.value.replace(/\D/g, '')); setIntent(null) }} /></label>
    <button type="button" className="conversion-max-button" onClick={() => { setAmount(stock); setIntent(null) }}>MAX</button>
    <p className="conversion-preview">{amount || '0'} particules → {amount || '0'} Primos</p>
    {error && <p role="alert" className="inventory-inline-error">{error}</p>}
    <button type="button" className="small-primary-button" disabled={!valid || pending} onClick={() => void submit()}>{pending ? 'Conversion…' : 'Convertir'}</button>
  </section></div>
}

export default ParticleConversionModal
