// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import ElementChoiceScreen from './ElementChoiceScreen'

it('keeps the unselected CTA disabled with a non-interactive cursor and preserves element confirmation', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container), choose = vi.fn(async () => undefined)
  try {
    await act(async () => root.render(<ElementChoiceScreen onChoose={choose} />))
    const confirm = container.querySelector<HTMLButtonElement>('.element-confirm')!
    expect(confirm.textContent).toBe('Sélectionne un élément')
    expect(confirm.disabled).toBe(true)
    expect(confirm.getAttribute('aria-busy')).toBe('false')
    expect(readFileSync(`${process.cwd()}/src/App.css`, 'utf8')).toContain('.element-confirm:disabled { cursor: not-allowed; }')
    await act(async () => confirm.click())
    expect(choose).not.toHaveBeenCalled()
    await act(async () => container.querySelector<HTMLButtonElement>('.element-choice.pyro')!.click())
    expect(confirm.disabled).toBe(false)
    await act(async () => confirm.click())
    expect(choose).toHaveBeenCalledExactlyOnceWith('pyro')
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
