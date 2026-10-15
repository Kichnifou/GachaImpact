// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import PresentationNameEditor from './PresentationNameEditor'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: ReturnType<typeof createRoot> | undefined
afterEach(async () => { await act(async () => root?.unmount()); document.body.innerHTML = '' })
async function mount(onSave: (name: string) => Promise<void>) {
  const node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  await act(async () => root!.render(<PresentationNameEditor name="Étoile" onSave={onSave} />))
  return node
}

it('opens prefilled, cancels with Escape and restores the pencil focus without saving', async () => {
  const save = vi.fn(async () => undefined), node = await mount(save)
  const pencil = node.querySelector<HTMLButtonElement>('button')!
  await act(async () => pencil.click())
  expect(node.querySelector<HTMLInputElement>('input')!.value).toBe('Étoile')
  await act(async () => node.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(node.querySelector('form')).toBeNull(); expect(save).not.toHaveBeenCalled(); expect(document.activeElement).toBe(pencil)
})

it('submits once, preserves errors and lets a successful retry close the editor', async () => {
  let finish!: () => void
  const save = vi.fn().mockRejectedValueOnce(new Error('Erreur contrôlée')).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  const node = await mount(save)
  await act(async () => node.querySelector<HTMLButtonElement>('button')!.click())
  await act(async () => node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(node.querySelector('[role="alert"]')?.textContent).toBeTruthy(); expect(node.querySelector('input')).not.toBeNull()
  await act(async () => {
    node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    node.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  expect(save).toHaveBeenCalledTimes(2); expect(node.querySelector<HTMLInputElement>('input')!.disabled).toBe(true)
  expect(save).toHaveBeenLastCalledWith('Étoile', 0)
  await act(async () => finish())
  expect(node.querySelector('form')).toBeNull()
  expect(document.activeElement).toBe(node.querySelector('button'))
})
