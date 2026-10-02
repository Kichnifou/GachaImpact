export type TutorialRect = Readonly<{ left: number; top: number; right: number; bottom: number; width: number; height: number }>
export function unionTutorialRects(rects: readonly TutorialRect[]): TutorialRect | null {
  if (!rects.length) return null
  const left = Math.min(...rects.map(r => r.left)), top = Math.min(...rects.map(r => r.top))
  const right = Math.max(...rects.map(r => r.right)), bottom = Math.max(...rects.map(r => r.bottom))
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}
export function spotlightRect(rect: TutorialRect, width: number, height: number, padding = 8): TutorialRect {
  const left = Math.max(0, Math.min(width, rect.left - padding)), top = Math.max(0, Math.min(height, rect.top - padding))
  const right = Math.max(left, Math.min(width, rect.right + padding)), bottom = Math.max(top, Math.min(height, rect.bottom + padding))
  return { left, top, right, bottom, width: right - left, height: bottom - top }
}
export function tutorialBubblePosition(target: TutorialRect | null, bubble: { width: number; height: number }, viewport: { width: number; height: number }) {
  const margin = 12, gap = 16
  const maxX = Math.max(margin, viewport.width - bubble.width - margin), maxY = Math.max(margin, viewport.height - bubble.height - margin)
  if (!target) return { left: Math.max(margin, (viewport.width - bubble.width) / 2), top: Math.max(margin, (viewport.height - bubble.height) / 2) }
  const candidates = [
    { left: target.right + gap, top: target.top + (target.height - bubble.height) / 2 },
    { left: target.left - gap - bubble.width, top: target.top + (target.height - bubble.height) / 2 },
    { left: target.left + (target.width - bubble.width) / 2, top: target.bottom + gap },
    { left: target.left + (target.width - bubble.width) / 2, top: target.top - gap - bubble.height },
  ].map(p => ({ left: Math.max(margin, Math.min(maxX, p.left)), top: Math.max(margin, Math.min(maxY, p.top)) }))
  const overlap = (p: typeof candidates[number]) => Math.max(0, Math.min(target.right, p.left + bubble.width) - Math.max(target.left, p.left)) * Math.max(0, Math.min(target.bottom, p.top + bubble.height) - Math.max(target.top, p.top))
  return candidates.reduce((best, p) => overlap(p) < overlap(best) ? p : best, candidates[0]!)
}
