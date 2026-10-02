import { expect, it } from 'vitest'
import { spotlightRect, tutorialBubblePosition, unionTutorialRects } from './tutorial-geometry'
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height })
it('unions two real resources anchors including the space between', () => {
  expect(unionTutorialRects([rect(10, 20, 100, 40), rect(10, 70, 100, 30)])).toEqual(rect(10, 20, 100, 80))
  expect(unionTutorialRects([])).toBeNull()
})
it('pads and clips spotlight to viewport', () => expect(spotlightRect(rect(2, 3, 100, 100), 90, 90)).toEqual(rect(0, 0, 90, 90)))
it.each([[1920, 1080], [390, 844], [320, 400]])('bounds bubble and uses a non-overlapping placement at %s/%s', (width, height) => {
  const target = rect(12, 12, 100, 80), bubble = { width: Math.min(350, width - 24), height: 240 }
  const p = tutorialBubblePosition(target, bubble, { width, height })
  expect(p.left).toBeGreaterThanOrEqual(12); expect(p.top).toBeGreaterThanOrEqual(12)
  expect(p.left + bubble.width).toBeLessThanOrEqual(width - 12); expect(p.top + bubble.height).toBeLessThanOrEqual(height - 12)
  expect(p.left >= target.right || p.top >= target.bottom).toBe(true)
})
