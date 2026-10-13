// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import EventMessageInbox from './EventMessageInbox'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('preserves every character while paging messages and keeps the selected message across refreshes', () => {
  const messages = Array.from({ length: 6 }, (_, index) => ({ id: `m${index}`, sender: { id: `s${index}`, displayName: `Sender ${index}` }, message: `${index}${'a'.repeat(499)}`, createdAt: '2026-10-13T12:00:00Z', viewed: true }))
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  try {
    act(() => root.render(<EventMessageInbox messages={messages} />))
    for (const message of messages) {
      expect(container.querySelector('article p')?.textContent).toBe(message.message)
      const next = container.querySelector<HTMLButtonElement>('[aria-label="Message suivant"]')!
      expect(next.disabled).toBe(message === messages.at(-1))
      if (!next.disabled) act(() => next.click())
    }
    act(() => root.render(<EventMessageInbox messages={[{ ...messages[0], id: 'new' }, ...messages]} />))
    expect(container.querySelector('article p')?.textContent).toBe(messages[5].message)
    act(() => root.render(<EventMessageInbox messages={messages.slice(0, 1)} />))
    expect(container.querySelector('article p')?.textContent).toBe(messages[0].message)
  } finally { act(() => root.unmount()); container.remove() }
})
