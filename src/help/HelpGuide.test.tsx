// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import HelpGuide from './HelpGuide'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: ReturnType<typeof createRoot>
afterEach(() => { act(() => root?.unmount()); document.body.replaceChildren() })
it('searches accents and case across systems and real commands, separates Twitch and never sends a command', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  const onClose = vi.fn(), onTutorial = vi.fn()
  await act(async () => root.render(<HelpGuide onClose={onClose} onTutorial={onTutorial} />))
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
  const click = async (text: string) => act(async () => Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === text)!.click())
  await click('Systèmes'); expect(dialog.querySelectorAll('.help-system-grid article')).toHaveLength(8)
  await click('Commandes'); expect(dialog.textContent).toContain('!legende'); expect(dialog.textContent).not.toContain('!wish')
  expect(dialog.textContent).not.toContain('!gift'); expect(dialog.textContent).not.toContain('!xp')
  const input = dialog.querySelector<HTMLInputElement>('input')!
  const search = async (value: string) => act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); })
  await search('EQUIPE'); expect(dialog.textContent).toContain('Personnages'); expect(dialog.textContent).toContain('!team')
  await search('zzzzzz'); expect(dialog.textContent).toContain('Aucun résultat'); expect(dialog.textContent).not.toContain('Twitch uniquement')
  await click('Twitch'); expect(dialog.textContent).toContain('!wish'); expect(dialog.textContent).toContain('!giveaway stats'); expect(dialog.textContent).not.toContain('reroll')
  expect(onTutorial).not.toHaveBeenCalled()
  await click('Lancer le Tutoriel'); expect(onTutorial).toHaveBeenCalledOnce()
  await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(onClose).toHaveBeenCalledOnce()
})
it('traps keyboard focus and restores the connected opener', async () => {
  const opener = document.createElement('button'); document.body.append(opener); opener.focus()
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<HelpGuide onClose={vi.fn()} onTutorial={vi.fn()} />))
  const buttons = document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')
  buttons[buttons.length - 1]!.focus()
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })))
  expect(document.activeElement).toBe(buttons[0])
  await act(async () => root.unmount())
  expect(document.activeElement).toBe(opener)
})

it('closes with the close button or backdrop while preserving clicks inside the guide', async () => {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  const onClose = vi.fn()
  await act(async () => root.render(<HelpGuide onClose={onClose} onTutorial={vi.fn()} />))
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
  await act(async () => dialog.dispatchEvent(new Event('pointerdown', { bubbles: true })))
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Fermer"]')!.click())
  expect(onClose).toHaveBeenCalledOnce()
  onClose.mockClear()
  await act(async () => document.querySelector('.help-guide-layer')!.dispatchEvent(new Event('pointerdown', { bubbles: true })))
  expect(onClose).toHaveBeenCalledOnce()
})
