import { useId, type TransitionEventHandler } from 'react'
import { wheelPoint, wheelSectorPath, type WheelSegment } from '../wheel/wheel-presentation'
import { formatResourceAmount } from '../utils/formatters'
import '../wheel/wheel-graphic.css'

type Props = { segments: readonly WheelSegment[]; rotation: number; isAnimating: boolean; selectedKey?: string; onTransitionEnd?: TransitionEventHandler<SVGGElement> }

function WheelGraphic({ segments, rotation, isAnimating, selectedKey, onTransitionEnd }: Props) {
  const gradientId = useId().replaceAll(':', '')
  return <div className="astral-wheel-visual">
    <svg viewBox="0 0 400 400" role="img" aria-label="Roue des récompenses : secteurs proportionnels aux probabilités, détail disponible avec le bouton Probabilités.">
      <defs><radialGradient id={gradientId}><stop offset="0" stopColor="#080e20" stopOpacity=".1" /><stop offset=".75" stopColor="#080e20" stopOpacity=".08" /><stop offset="1" stopColor="#080e20" stopOpacity=".6" /></radialGradient></defs>
      <circle cx="200" cy="200" r="192" className="astral-rim-outer" />
      <circle cx="200" cy="200" r="183" className="astral-rim-inner" />
      <g className={`astral-disc${isAnimating ? ' is-spinning' : ''}`} style={{ transform: `rotate(${rotation}deg)` }} onTransitionEnd={onTransitionEnd} aria-hidden="true">
        {segments.map(segment => {
          const icon = wheelPoint(segment.centerAngle, 132)
          const text = wheelPoint(segment.centerAngle, 101)
          return <g key={segment.key} data-sector={segment.key} data-probability={segment.probabilityPercent}>
            <path d={wheelSectorPath(segment)} fill={segment.color} className={`astral-sector${!isAnimating && selectedKey === segment.key ? ' is-selected' : ''}`} />
            {segment.assetPath ? <><image href={segment.assetPath} x={icon.x - 15} y={icon.y - 15} width="30" height="30" /><text x={text.x} y={text.y} className="astral-sector-amount" dominantBaseline="middle" textAnchor="middle">{formatResourceAmount(segment.amount ?? '')}</text></> : <text x={icon.x} y={icon.y} className="astral-sector-empty" dominantBaseline="middle" textAnchor="middle">·</text>}
          </g>
        })}
        <circle cx="200" cy="200" r="178" fill={`url(#${gradientId})`} pointerEvents="none" />
      </g>
      <g aria-hidden="true"><circle cx="200" cy="200" r="38" className="astral-hub" /><path d="M200 177 L207 193 L223 200 L207 207 L200 223 L193 207 L177 200 L193 193 Z" className="astral-hub-star" /><path d="M188 6 L212 6 L200 31 Z" className="astral-pointer" /></g>
    </svg>
    <div className="astral-orbit" aria-hidden="true"><i /><i /><i /><i /><i /></div>
  </div>
}
export default WheelGraphic
