// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import TwitchLiveLink from './TwitchLiveLink'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT=true
const roots:ReturnType<typeof createRoot>[]=[]
afterEach(()=>{act(()=>roots.splice(0).forEach(root=>root.unmount()));vi.useRealTimers()})
it('shows confirmed live with a secure external link and hides on failure',async()=>{
  vi.useFakeTimers()
  const load=vi.fn().mockResolvedValue({live:true,validForMs:45_000}),container=document.createElement('div'),root=createRoot(container)
  roots.push(root)
  await act(async()=>root.render(<TwitchLiveLink sessionKey="synthetic" load={load}/>))
  const link=container.querySelector('a')!
  expect(link.textContent).toBe('🔴 Kichni est en Live !')
  expect(link.href).toBe('https://www.twitch.tv/kichnifou')
  expect(link.target).toBe('_blank'); expect(link.rel).toBe('noopener noreferrer')
  load.mockRejectedValueOnce(Error('offline'))
  await act(async()=>vi.advanceTimersByTimeAsync(30_000))
  expect(container.querySelector('a')).toBeNull()
})
it('expires confirmed status even if the next request hangs',async()=>{
  vi.useFakeTimers()
  const load=vi.fn().mockResolvedValueOnce({live:true,validForMs:35_000}).mockImplementation(()=>new Promise(()=>undefined))
  const container=document.createElement('div'),root=createRoot(container);roots.push(root)
  await act(async()=>root.render(<TwitchLiveLink sessionKey="synthetic" load={load}/>))
  expect(container.querySelector('a')).not.toBeNull()
  await act(async()=>vi.advanceTimersByTimeAsync(36_000))
  expect(container.querySelector('a')).toBeNull()
})
it('does not reserve an empty slot without a session or when offline',async()=>{
  const load=vi.fn().mockResolvedValue({live:false}),container=document.createElement('div'),root=createRoot(container);roots.push(root)
  await act(async()=>root.render(<TwitchLiveLink load={load}/>))
  expect(load).not.toHaveBeenCalled();expect(container.innerHTML).toBe('')
  await act(async()=>root.render(<TwitchLiveLink sessionKey="synthetic" load={load}/>))
  expect(container.innerHTML).toBe('')
})
