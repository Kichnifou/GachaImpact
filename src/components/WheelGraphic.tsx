import type { CSSProperties, TransitionEventHandler } from 'react'

import { wheelSegments } from '../wheel/wheel-presentation'
import GameAssetIcon from './GameAssetIcon'

type WheelGraphicProps = {
  rotation: number
  isAnimating: boolean
  onTransitionEnd?: TransitionEventHandler<HTMLDivElement>
}

/**
 * Présentation graphique réutilisable pour le futur écran Quotidiens.
 * Ce composant ne choisit jamais une récompense et n'est pas affiché sur l'Accueil.
 */
function WheelGraphic({ rotation, isAnimating, onTransitionEnd }: WheelGraphicProps) {
  return (
    <div className="wheel-visual" aria-label="Roue des récompenses">
      <span className="wheel-pointer" aria-hidden="true" />
      <div
        className={`wheel-disc${isAnimating ? ' spinning' : ''}`}
        style={{ transform: `rotate(${rotation}deg)` }}
        onTransitionEnd={onTransitionEnd}
        aria-hidden="true"
      >
        {wheelSegments.map((segment, index) => (
          <span
            className="wheel-prize"
            style={{ '--wheel-index': index } as CSSProperties}
            key={segment.key}
          >
            {segment.assetPath ? (
              <GameAssetIcon
                className="wheel-prize-icon"
                src={segment.assetPath}
                fallback={segment.fallback}
              />
            ) : (
              <span className="wheel-prize-icon empty">{segment.fallback}</span>
            )}
          </span>
        ))}
        <span className="wheel-hub">✦</span>
      </div>
    </div>
  )
}

export default WheelGraphic
