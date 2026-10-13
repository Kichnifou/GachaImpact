import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import type { PermanentMissionDto } from '../api/types'
import AppButton from '../components/AppButton'

export function missionPageGeometry(width: number, height: number) {
  const columns = width >= 720 ? 3 : width >= 480 ? 2 : 1
  const rows = Math.max(1, Math.min(3, Math.floor((height - 38 + 8) / 193)))
  return { columns, rows }
}

/** Presentation only; the parent supplies the complete canonical order. */
export default function MissionPages({ missions, renderCard }: { missions: readonly PermanentMissionDto[]; renderCard: (mission: PermanentMissionDto) => ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const [geometry, setGeometry] = useState({ columns: 3, rows: 3 })
  const [page, setPage] = useState(0)
  const [direction, setDirection] = useState(1)
  const capacity = geometry.columns * geometry.rows
  const pages = Math.max(1, Math.ceil(missions.length / capacity))
  const current = Math.min(page, pages - 1)
  useEffect(() => {
    const node = viewport.current
    if (!node) return
    const measure = () => {
      if (node.clientWidth && node.clientHeight) setGeometry(missionPageGeometry(node.clientWidth, node.clientHeight))
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  useLayoutEffect(() => {
    // Long descriptions may require fewer rows, never clipping their contents.
    const cards = viewport.current?.querySelectorAll<HTMLElement>('.mission-card')
    if (geometry.rows > 1 && cards && [...cards].some(card => card.scrollHeight > card.clientHeight + 1)) setGeometry(value => ({ ...value, rows: value.rows - 1 }))
  }, [missions, current, geometry])
  const move = (delta: -1 | 1) => { setDirection(delta); setPage(Math.max(0, Math.min(pages - 1, current + delta))) }
  return <div ref={viewport} className="mission-pages" style={{ '--mission-columns': geometry.columns, '--mission-rows': geometry.rows } as CSSProperties}>
    <div className="mission-page-window">
      <div key={`${current}:${capacity}`} className={`mission-grid mission-page-grid ${direction > 0 ? 'mission-slide-next' : 'mission-slide-previous'}`} data-mission-rows={geometry.rows} data-mission-page={current + 1}>{missions.slice(current * capacity, (current + 1) * capacity).map(renderCard)}</div>
    </div>
    {pages > 1 && <nav className="mission-pagination" aria-label="Pages des Missions"><AppButton variant="icon" aria-label="Missions précédentes" disabled={current === 0} onClick={() => move(-1)}>‹</AppButton><span role="status">{current + 1} / {pages}</span><AppButton variant="icon" aria-label="Missions suivantes" disabled={current === pages - 1} onClick={() => move(1)}>›</AppButton></nav>}
  </div>
}
