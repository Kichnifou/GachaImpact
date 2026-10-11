// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WheelCard from './WheelCard'
import type { WheelSpinDto, WheelTodayDto } from '../api/types'
import { testWheelProbabilities } from '../wheel/wheel-test-fixture'

const roots: Root[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => { vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))) })
afterEach(() => { act(() => roots.splice(0).forEach(root => root.unmount())); document.body.replaceChildren(); vi.unstubAllGlobals() })
const today: WheelTodayDto = { spun: false, businessDate: '2026-10-11', result: null, probabilities: testWheelProbabilities }
const reward: WheelSpinDto = { resultType: 'particles', resourceKey: 'particles_cryo', amount: '500', businessDate: today.businessDate, alreadySpun: false }
function mount(value = today, spin = vi.fn(async () => reward)) {
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container); roots.push(root)
  const render = (next: WheelTodayDto) => act(() => root.render(<WheelCard today={next} onSpin={spin} />))
  render(value)
  const button = (text: string) => Array.from(container.querySelectorAll('button')).find(item => item.textContent === text)!
  return { container, spin, render, button }
}
async function spinOnce(subject: ReturnType<typeof mount>) { await act(async () => { subject.button('Tourner la Roue').click(); await Promise.resolve() }) }
describe('astral Wheel interaction', () => {
  it('guards even two synchronous clicks and skip never calls the economy again', async () => {
    let resolve!: (result: WheelSpinDto) => void
    const subject = mount(today, vi.fn(() => new Promise<WheelSpinDto>(done => { resolve = done })))
    const button = subject.button('Tourner la Roue')
    act(() => { button.click(); button.click() })
    expect(subject.spin).toHaveBeenCalledTimes(1)
    expect(subject.container.querySelector('[data-wheel-phase="requesting"]')).not.toBeNull()
    await act(async () => { resolve(reward); await Promise.resolve() })
    expect(subject.container.querySelector('[data-wheel-phase="animating"]')).not.toBeNull()
    act(() => { subject.button('Passer l’animation').focus(); subject.button('Passer l’animation').click() })
    expect(subject.spin).toHaveBeenCalledTimes(1)
    expect(subject.container.textContent).toContain('+500 particules Cryo')
    expect(subject.container.querySelector('[data-sector="particles_cryo"] .is-selected')).not.toBeNull()
    expect(subject.button('Tourner la Roue')).toBeUndefined()
    expect(document.activeElement).toBe(subject.button('Probabilités'))
  })
  it.each(testWheelProbabilities)('reveals exactly the actual server reward $resourceKey', async result => {
    const subject = mount(today, vi.fn(async () => ({ ...result, businessDate: today.businessDate, alreadySpun: false })))
    await spinOnce(subject)
    act(() => subject.button('Passer l’animation').click())
    const key = result.resourceKey ?? 'nothing'
    expect(subject.container.querySelector(`[data-sector="${key}"] .is-selected`)).not.toBeNull()
    expect(subject.spin).toHaveBeenCalledTimes(1)
  })
  it('reduced motion displays the confirmed gain directly', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
    const subject = mount(); await spinOnce(subject)
    expect(subject.container.querySelector('[data-wheel-phase="idle"]')).not.toBeNull()
    expect(subject.container.textContent).toContain('+500 particules Cryo')
    expect(subject.button('Passer l’animation')).toBeUndefined()
  })
  it('a competing chat or tab gain is restored directly without a false new spin', async () => {
    const subject = mount(today, vi.fn(async () => ({ ...reward, alreadySpun: true }))); await spinOnce(subject)
    expect(subject.container.querySelector('[data-wheel-phase="idle"]')).not.toBeNull()
    expect(subject.container.textContent).toContain('Déjà utilisée aujourd’hui')
    expect(subject.container.textContent).not.toContain('Félicitations')
  })
  it('F5-style mounts and an unknown historical gain never call spin', () => {
    const used = mount({ ...today, spun: true, result: reward })
    expect(used.container.textContent).toContain('+500 particules Cryo')
    expect(used.spin).not.toHaveBeenCalled()
    const unknown = mount({ ...today, spun: true })
    expect(unknown.container.textContent).toContain('résultat historique indisponible')
    expect(unknown.button('Tourner la Roue')).toBeUndefined()
  })
  it('server-confirmed new business date reopens the attempt without automatically spinning', async () => {
    const subject = mount(); await spinOnce(subject)
    act(() => subject.button('Passer l’animation').click())
    subject.render({ ...today, businessDate: '2026-10-12' })
    expect(subject.button('Tourner la Roue').disabled).toBe(false)
    expect(subject.spin).toHaveBeenCalledTimes(1)
  })
  it('missing server probabilities disables the request without inventing a wheel', () => {
    const subject = mount({ ...today, probabilities: undefined })
    expect(subject.button('Tourner la Roue').disabled).toBe(true)
    expect(subject.container.querySelector('svg')).toBeNull()
    expect(subject.spin).not.toHaveBeenCalled()
  })
  it('a result outside the loaded projection remains real without pointing at an unrelated sector', async () => {
    const subject = mount(today, vi.fn(async () => ({ ...reward, amount: '999' }))); await spinOnce(subject)
    expect(subject.container.querySelector('svg')).toBeNull()
    expect(subject.container.textContent).toContain('+999 particules Cryo')
    expect(subject.button('Tourner la Roue')).toBeUndefined()
    expect(subject.spin).toHaveBeenCalledTimes(1)
  })
  it('probabilities have a keyboard-close dialog and restore focus', () => {
    const subject = mount()
    act(() => { subject.button('Probabilités').focus(); subject.button('Probabilités').click() })
    expect(document.querySelector('[role="dialog"] li')?.textContent).toContain('2 %')
    expect(document.querySelectorAll('[role="dialog"] li')).toHaveLength(10)
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(subject.button('Probabilités'))
  })
})
