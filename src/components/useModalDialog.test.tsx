// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ModalCloseButton from './ModalCloseButton'
import { useModalDialog } from './useModalDialog'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => { document.body.replaceChildren() })

function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useModalDialog<HTMLElement>(onClose)
  return <section ref={ref} tabIndex={-1} role="dialog"><ModalCloseButton onClose={onClose} /><button type="button">Dernière action</button></section>
}

function NestedDialogs({ onCloseOuter, onCloseInner }: { onCloseOuter: () => void; onCloseInner: () => void }) {
  const outerRef = useModalDialog<HTMLElement>(onCloseOuter)
  const innerRef = useModalDialog<HTMLElement>(onCloseInner)
  return <section ref={outerRef} tabIndex={-1} role="dialog"><button type="button">Action extérieure</button><section ref={innerRef} tabIndex={-1} role="dialog"><ModalCloseButton onClose={onCloseInner} /></section></section>
}

describe('useModalDialog', () => {
  it('focuses the standard dark close control, traps Tab, closes with Escape and restores focus', () => {
    const opener = document.createElement('button')
    opener.textContent = 'Ouvrir'
    document.body.append(opener)
    opener.focus()
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onClose = vi.fn(() => root.unmount())

    act(() => root.render(<Dialog onClose={onClose} />))
    const close = host.querySelector<HTMLButtonElement>('[aria-label="Fermer"]')!
    const last = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).at(-1)!
    expect(close.classList.contains('modal-close-button')).toBe(true)
    expect(document.activeElement).toBe(close)

    act(() => { last.focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })) })
    expect(document.activeElement).toBe(close)
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(onClose).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(opener)
  })

  it('only closes the innermost dialog when modals are nested', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const onCloseOuter = vi.fn()
    const onCloseInner = vi.fn()

    act(() => root.render(<NestedDialogs onCloseOuter={onCloseOuter} onCloseInner={onCloseInner} />))
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(onCloseInner).toHaveBeenCalledOnce()
    expect(onCloseOuter).not.toHaveBeenCalled()
    act(() => root.unmount())
  })
})
