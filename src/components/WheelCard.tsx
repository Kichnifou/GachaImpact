import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { WheelSpinDto, WheelTodayDto } from '../api/types'
import { apiErrorMessage, formatWheelResult, formatFreshWheelResult } from '../utils/formatters'
import { createWheelSegments, getWheelAnimatedRotation, getWheelRestingRotation, getWheelSegmentIndex, type WheelSegment } from '../wheel/wheel-presentation'
import AppButton from './AppButton'
import WheelGraphic from './WheelGraphic'
import { useModalDialog } from './useModalDialog'
import '../wheel/wheel-graphic.css'

type Props = { today: WheelTodayDto; onSpin: () => Promise<WheelSpinDto> }

function ProbabilityDialog({ segments, onClose }: { segments: readonly WheelSegment[]; onClose: () => void }) {
  const ref = useModalDialog<HTMLDivElement>(onClose)
  return createPortal(<div className="astral-probability-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={ref} className="astral-probability-dialog panel" role="dialog" aria-modal="true" aria-labelledby="astral-probabilities-title" tabIndex={-1}>
      <header><div><span className="eyebrow">Roue astrale</span><h2 id="astral-probabilities-title">Probabilités</h2></div><AppButton variant="icon" aria-label="Fermer" onClick={onClose}>×</AppButton></header>
      <ul>{segments.map(segment => <li key={segment.key}><span>{segment.assetPath && <img src={segment.assetPath} alt="" />}{segment.resultType === 'nothing' ? segment.label : formatWheelResult(segment)}</span><strong>{segment.probabilityPercent.toLocaleString('fr-FR')} %</strong></li>)}</ul>
      <p>Une tentative par jour, renouvelée à minuit, heure de Paris.</p>
    </div>
  </div>, document.body)
}

function WheelCardDay({ today, onSpin }: Props) {
  const segments = createWheelSegments(today.probabilities)
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'animating'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [freshResult, setFreshResult] = useState<WheelSpinDto | null>(null)
  const [showProbabilities, setShowProbabilities] = useState(false)
  const [rotation, setRotation] = useState(() => today.result ? getWheelRestingRotation(today.result, segments) : 0)
  const [diameter, setDiameter] = useState<number | null>(null)
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))
  const stageRef = useRef<HTMLDivElement>(null)
  const probabilityRef = useRef<HTMLButtonElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(false)
  const consumedRef = useRef(today.spun)
  const mountedRef = useRef(true)
  const result = freshResult ?? today.result
  const isAnimating = phase === 'animating'
  const used = today.spun || Boolean(freshResult)
  const selectedIndex = result ? getWheelSegmentIndex(result, segments) : -1

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const update = () => setReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setDiameter(Math.max(0, Math.floor(Math.min(entry.contentRect.width, entry.contentRect.height)) - 8))
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const finish = useCallback(() => {
    setPhase('idle')
    busyRef.current = false
    if (document.activeElement === skipRef.current) probabilityRef.current?.focus()
  }, [])
  useEffect(() => {
    if (!isAnimating) return
    const timer = window.setTimeout(finish, reducedMotion || document.visibilityState === 'hidden' ? 0 : 4100)
    const hidden = () => { if (document.visibilityState === 'hidden') finish() }
    document.addEventListener('visibilitychange', hidden)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', hidden) }
  }, [isAnimating, reducedMotion, finish])

  // An external chat/tab result is positioned directly, without simulating another spin.
  const displayedRotation = phase === 'idle' && result ? getWheelRestingRotation(result, segments) : rotation
  const spin = async () => {
    if (today.spun || consumedRef.current || busyRef.current || segments.length === 0) return
    busyRef.current = true
    setPhase('requesting')
    setErrorMessage(null)
    try {
      const serverResult = await onSpin()
      if (!mountedRef.current) return
      consumedRef.current = true
      setFreshResult(serverResult)
      if (serverResult.alreadySpun || reducedMotion || document.visibilityState === 'hidden' || getWheelSegmentIndex(serverResult, segments) < 0) {
        setRotation(getWheelRestingRotation(serverResult, segments))
        setPhase('idle')
        busyRef.current = false
      } else {
        setRotation(getWheelAnimatedRotation(displayedRotation, serverResult, segments))
        setPhase('animating')
      }
    } catch (error) {
      if (!mountedRef.current) return
      setErrorMessage(apiErrorMessage(error))
      setPhase('idle')
      busyRef.current = false
    }
  }

  let status = used ? 'Déjà utilisée aujourd’hui — résultat historique indisponible.' : 'Votre tentative du jour est disponible.'
  if (phase === 'requesting') status = 'Votre récompense est en cours de tirage…'
  else if (isAnimating) status = 'La roue révèle votre récompense…'
  else if (result) status = freshResult && !freshResult.alreadySpun ? formatFreshWheelResult(freshResult) : `Déjà utilisée aujourd’hui — ${formatWheelResult(result)}`

  return <section data-business-pending={phase !== 'idle'} data-tutorial-anchor="dailies-wheel" data-wheel-phase={phase} className={`wheel-card astral-wheel-card panel${used && phase === 'idle' ? ' is-settled' : ''}${freshResult && !freshResult.alreadySpun && phase === 'idle' ? ' is-fresh-result' : ''}`} aria-labelledby="wheel-title">
    <header className="astral-wheel-heading"><div><span className="eyebrow">Activité quotidienne</span><h2 id="wheel-title">Roue astrale</h2></div><span className="astral-daily-badge">{used ? 'Tentative utilisée' : '1 tentative disponible'}</span></header>
    <div ref={stageRef} className="astral-wheel-stage" style={diameter === null ? undefined : { '--astral-diameter': `${diameter}px` } as CSSProperties}>
      {segments.length && (!result || selectedIndex >= 0) ? <WheelGraphic segments={segments} rotation={displayedRotation} isAnimating={isAnimating} selectedKey={selectedIndex < 0 ? undefined : segments[selectedIndex]?.key} onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === 'transform' && isAnimating) finish() }} /> : <p className="astral-unavailable">{result ? 'Votre récompense est enregistrée. Actualisez la page pour retrouver sa représentation.' : 'Les probabilités ne sont pas disponibles. Actualisez la page avant de tourner.'}</p>}
    </div>
    <footer className="astral-wheel-footer"><div className="astral-wheel-result" role="status" aria-live="polite"><strong>{status}</strong><small>{errorMessage ? <span className="form-feedback error" role="alert">{errorMessage}</span> : 'Une tentative quotidienne · Renouvellement à minuit, heure de Paris'}</small></div>
      <div className="astral-wheel-actions">{isAnimating ? <AppButton ref={skipRef} variant="primary" onClick={finish}>Passer l’animation</AppButton> : !used ? <AppButton variant="primary" onClick={() => void spin()} disabled={phase === 'requesting' || !segments.length} aria-busy={phase === 'requesting'}>{phase === 'requesting' ? 'Tirage…' : 'Tourner la Roue'}</AppButton> : <span className="astral-next-spin">Prochain tour demain</span>}
        <AppButton ref={probabilityRef} disabled={!segments.length} onClick={() => setShowProbabilities(true)}>Probabilités</AppButton></div>
    </footer>
    {showProbabilities && <ProbabilityDialog segments={segments} onClose={() => setShowProbabilities(false)} />}
  </section>
}

function WheelCard(props: Props) { return <WheelCardDay key={props.today.businessDate} {...props} /> }
export default WheelCard
