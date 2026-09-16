// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { EventDto } from '../api/types'
import EventShopSection from './EventShopSection'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const view = (joined: boolean, balance: string, obtained = false): EventDto => ({
  festival: { currency: { key: 'harvest-tokens', unit: 'Jeton de Récolte', label: 'Jetons de Récolte', emoji: '🌾' } },
  edition: { year: 2026 },
  shop: { available: joined, balance, rates: { primogems: '160', moras: '20000' }, collection: { itemExternalKey: 'gerbe_de_recolte', label: 'Gerbe de Récolte', cost: '80', obtainedThisEdition: obtained, available: true } },
} as EventDto)

const mounted: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = []
afterEach(() => { for (const { root, container } of mounted.splice(0)) { act(() => root.unmount()); container.remove() } })

function mount(value = view(true, '7'), onTransact = vi.fn()) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); mounted.push({ root, container })
  act(() => root.render(<EventShopSection value={value} intent={null} pending={false} feedback="" error="" canConvert canPurchaseCollection onTransact={onTransact} />))
  return { container, root, onTransact }
}
function click(button: HTMLButtonElement) { act(() => button.click()) }
function buttons(container: HTMLElement) { return Array.from(container.querySelectorAll<HTMLButtonElement>('button')) }

describe('Event Shop', () => {
  it('keeps quantity buttons intrinsic and lets the input absorb available space', () => {
    const css = readFileSync('src/App.css', 'utf8')
    expect(css).toMatch(/\.event-shop-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*280px\),\s*1fr\)\);/s)
    expect(css).toMatch(/\.event-shop-quantity button\s*\{[^}]*flex:\s*0 0 auto;/s)
    expect(css).toMatch(/\.event-shop-quantity input\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-width:\s*0;/s)
    expect(css).toMatch(/\.event-shop-quantity \.event-shop-max\s*\{[^}]*min-width:\s*max-content;[^}]*padding-inline:\s*12px;[^}]*white-space:\s*nowrap;/s)
    expect(css).toMatch(/\.event-shop-feedback\.success\s*\{[^}]*color:\s*#8df1c8;/s)
  })

  it('previews all three offers publicly while forbidding purchases before joining', () => {
    const { container } = mount(view(false, '7'))
    expect(container.textContent).toContain('Primogemmes')
    expect(container.textContent).toContain('Moras')
    expect(container.textContent).toContain('Gerbe de Récolte')
    expect(container.textContent).toContain('1 Jeton de Récolte')
    expect(container.textContent).toContain('7 Jetons de Récolte')
    expect(buttons(container).filter((button) => button.textContent === 'Convertir' || button.textContent === 'Acheter').every((button) => button.disabled)).toBe(true)
  })

  it('computes MAX and a multi-unit Primogemmes preview from the server rates', async () => {
    const onTransact = vi.fn()
    const { container } = mount(view(true, '7'), onTransact)
    click(buttons(container).find((button) => button.textContent === 'MAX')!)
    expect((container.querySelector('#event-shop-PRIMOGEMS') as HTMLInputElement).value).toBe('7')
    expect(container.textContent).toContain('1 120 Primogemmes')
    await act(async () => { buttons(container).find((button) => button.textContent === 'Convertir')!.click(); await Promise.resolve() })
    expect(onTransact).toHaveBeenCalledWith('PRIMOGEMS', 7)
  })

  it('shows the annual Collection state and disables a second purchase', () => {
    const { container } = mount(view(true, '80', true))
    expect(container.textContent).toContain('Obtenu — édition 2026')
    expect(buttons(container).find((button) => button.textContent === 'Déjà obtenu')?.disabled).toBe(true)
  })

  it('requires enough currency and valid integral quantities', () => {
    const { container } = mount(view(true, '1'))
    expect(buttons(container).find((button) => button.textContent === 'Acheter')?.disabled).toBe(true)
    const input = container.querySelector('#event-shop-MORAS') as HTMLInputElement
    act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(buttons(container).filter((button) => button.textContent === 'Convertir')[1]?.disabled).toBe(true)
  })
})
