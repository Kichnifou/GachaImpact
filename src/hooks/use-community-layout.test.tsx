// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useCommunityLayout } from './use-community-layout'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })
it('persists per Player, survives remount, and preserves the choice on a narrow viewport', () => {
  let wide = true
  vi.stubGlobal('matchMedia', () => ({ matches: wide, addEventListener() {}, removeEventListener() {} }))
  let state!: ReturnType<typeof useCommunityLayout>
  function Probe({ id }: { id: string }) { state = useCommunityLayout(id); return null }
  const root = createRoot(document.createElement('div'))
  try {
    act(() => root.render(<Probe id="first" />)); act(() => state.setExpanded(true))
    expect(state.expanded).toBe(true)
    act(() => root.render(<Probe id="second" />)); expect(state.expanded).toBe(false)
    wide = false; act(() => root.render(<Probe id="first" />))
    expect(state.expanded).toBe(true); expect(state.available).toBe(false)
  } finally { act(() => root.unmount()); vi.unstubAllGlobals() }
  const next = createRoot(document.createElement('div'))
  try { act(() => next.render(<Probe id="first" />)); expect(state.expanded).toBe(true) } finally { act(() => next.unmount()) }
})
it('still toggles when reads work but storage writes fail', () => {
  const root = createRoot(document.createElement('div'))
  let state!: ReturnType<typeof useCommunityLayout>
  function Probe() { state = useCommunityLayout('quota'); return null }
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
  try {
    act(() => root.render(<Probe />)); act(() => state.setExpanded(true)); expect(state.expanded).toBe(true)
    act(() => state.setExpanded(false)); expect(state.expanded).toBe(false)
  } finally { act(() => root.unmount()) }
})
