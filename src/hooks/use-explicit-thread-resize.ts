import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useLatestRef } from './use-latest-ref'

/** Only a deliberate Community size action starts this placement request. */
export function useExplicitThreadResize(owner: RefObject<HTMLElement | null>, token: number, bottom: () => void, boundary: string) {
  const previous = useRef(token)
  const latestBottom = useLatestRef(bottom)
  useLayoutEffect(() => {
    if (previous.current === token) return
    previous.current = token
    const element = owner.current
    if (!element) return
    let following = true
    const place = latestBottom.current
    const settle = () => { if (following) place() }
    const stop = () => { following = false }
    // Layout is already committed; the next frame also covers parent layout work.
    settle()
    const frame = requestAnimationFrame(settle)
    // Late graphical results retain the bottom until the reader interacts.
    element.addEventListener('load', settle, true)
    for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) element.addEventListener(event, stop)
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('load', settle, true)
      for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown']) element.removeEventListener(event, stop)
    }
  }, [token, owner, latestBottom, boundary])
}
