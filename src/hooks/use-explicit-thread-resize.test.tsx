// @vitest-environment happy-dom
import { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { useExplicitThreadResize } from './use-explicit-thread-resize'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
it('places only explicit size requests, follows delayed images, and stops at reader or thread boundaries', async () => {
  const container = document.createElement('div'), root = createRoot(container)
  let height = 1000
  function Probe({ token, boundary }: { token: number; boundary: string }) {
    const list = useRef<HTMLDivElement>(null)
    useExplicitThreadResize(list, token, () => { if (list.current) list.current.scrollTop = height }, boundary)
    return <div ref={list}><img alt="" /></div>
  }
  try {
    await act(async () => root.render(<Probe token={0} boundary="chat" />))
    const owner = container.firstElementChild as HTMLElement, image = owner.querySelector('img')!
    owner.scrollTop = 120
    await act(async () => root.render(<Probe token={0} boundary="chat" />))
    expect(owner.scrollTop).toBe(120)
    await act(async () => root.render(<Probe token={1} boundary="chat" />))
    expect(owner.scrollTop).toBe(1000)
    height = 1200; window.dispatchEvent(new Event('resize'))
    expect(owner.scrollTop).toBe(1000)
    image.dispatchEvent(new Event('load'))
    expect(owner.scrollTop).toBe(1200)
    owner.dispatchEvent(new Event('wheel')); owner.scrollTop = 130; height = 1400
    image.dispatchEvent(new Event('load'))
    expect(owner.scrollTop).toBe(130)
    await act(async () => root.render(<Probe token={2} boundary="chat" />))
    expect(owner.scrollTop).toBe(1400)
    await act(async () => root.render(<Probe token={2} boundary="mp:other" />))
    owner.scrollTop = 150; image.dispatchEvent(new Event('load'))
    expect(owner.scrollTop).toBe(150)
  } finally { act(() => root.unmount()) }
})
