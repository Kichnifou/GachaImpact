import { useState } from 'react'

import type { WheelSpinDto, WheelTodayDto } from '../api/types'
import { apiErrorMessage, formatWheelResult, formatFreshWheelResult } from '../utils/formatters'

type WheelCardProps = {
  today: WheelTodayDto
  onSpin: () => Promise<WheelSpinDto>
}

function WheelCard({ today, onSpin }: WheelCardProps) {
  const [isSpinning, setIsSpinning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [freshResult, setFreshResult] = useState<WheelSpinDto | null>(null)

  const spin = async () => {
    if (today.spun || isSpinning) return

    setIsSpinning(true)
    setErrorMessage(null)

    try {
      const result = await onSpin()
      setFreshResult(result.alreadySpun ? null : result)
    } catch (error) {
      setErrorMessage(apiErrorMessage(error))
    } finally {
      setIsSpinning(false)
    }
  }

  return (
    <section className="wheel-card panel" aria-labelledby="wheel-title">
      <div className="wheel-symbol" aria-hidden="true">✦</div>
      <div className="wheel-copy">
        <span className="eyebrow">Activité quotidienne</span>
        <h2 id="wheel-title">Roue astrale</h2>
        {freshResult && freshResult.businessDate === today.businessDate ? (
          <p className="wheel-result" role="status">
            <strong>{formatFreshWheelResult(freshResult)}</strong>
          </p>
        ) : today.result && !isSpinning ? (
          <p className="wheel-result" role="status">
            <strong>Déjà utilisée aujourd’hui — </strong>
            {formatWheelResult(today.result)}
          </p>
        ) : (
          <p>
            {isSpinning
              ? 'Le serveur détermine votre récompense…'
              : 'Votre tentative du jour est disponible.'}
          </p>
        )}
        {errorMessage && <p className="form-feedback error" role="alert">{errorMessage}</p>}
      </div>

      {!today.spun && (
        <button type="button" className="wheel-spin-button" onClick={spin} disabled={isSpinning}>
          {isSpinning ? 'Tirage…' : 'Tourner la Roue'}
        </button>
      )}
    </section>
  )
}

export default WheelCard
