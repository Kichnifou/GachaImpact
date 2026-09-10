// @vitest-environment happy-dom

import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/game-api'
import type { ModerationStateDto } from '../api/types'
import { ModerationIntentCoordinator, type ModerationResourceInput } from '../moderation/moderation-intent-coordinator'
import ModerationScreen from './ModerationScreen'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const state = (primogems = '1000'): ModerationStateDto => ({
  permissions: { roles: ['TESTER'], capabilities: { moderationAccess: true, selfTestTools: true } },
  resources: {
    primogems,
    moras: '1000',
    particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' },
  },
  progression: { totalXp: '88', level: 2, xpIntoCurrentStep: '28', xpPerStep: '30', isMaxLevel: false, level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0' },
  gachaState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
  stella: { quantity: '0' },
})

const roots: Root[] = []
afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()))
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

async function mount(onResource: ComponentProps<typeof ModerationScreen>['onResource'] = vi.fn(async () => state())) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  const onApplied = vi.fn()
  await act(async () => {
    root.render(<ModerationScreen onLoad={vi.fn(async () => state())} onResource={onResource} onXp={vi.fn()} onGacha={vi.fn()} onStella={vi.fn()} onApplied={onApplied} />)
    await Promise.resolve()
    await Promise.resolve()
  })
  return { container, onApplied }
}

function changeInput(input: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('ModerationScreen', () => {
  it('offers only compact self-test sections without another-player targeting', async () => {
    const { container } = await mount()
    for (const label of ['Ressources', 'Progression', 'Gacha', 'Objets', 'Préparer prochain niveau']) expect(container.textContent).toContain(label)
    expect(container.textContent).not.toContain('targetPlayerId')
    expect(container.textContent).not.toContain('Joueur cible')
  })

  it('retries an ambiguous resource delta with one key and applies only the returned snapshot', async () => {
    const createKey = vi.fn(() => 'stable-resource-key')
    const coordinator = new ModerationIntentCoordinator(createKey)
    let attempt = 0
    const resourceApi = vi.fn(async (_input: ModerationResourceInput & { idempotencyKey: string }) => {
      attempt += 1
      if (attempt === 1) throw new ApiError('NETWORK_ERROR', 'Réponse perdue', null)
      return state('2000')
    })
    const onResource = (input: ModerationResourceInput) => coordinator.execute(
      'player-a',
      { type: 'resource', payload: input },
      (idempotencyKey) => resourceApi({ ...input, idempotencyKey }),
    )
    const { container, onApplied } = await mount(onResource)
    const form = container.querySelector<HTMLFormElement>('.moderation-tool')!
    changeInput(form.querySelector<HTMLInputElement>('input[type="number"]')!, '1000')

    await submit(form)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Le serveur GachaImpact est momentanément inaccessible.')
    await submit(form)

    expect(resourceApi).toHaveBeenCalledTimes(2)
    expect(resourceApi.mock.calls.map(([input]) => input.idempotencyKey)).toEqual(['stable-resource-key', 'stable-resource-key'])
    expect(createKey).toHaveBeenCalledOnce()
    expect(onApplied).toHaveBeenCalledOnce()
    expect(onApplied).toHaveBeenCalledWith(state('2000'))
  })

  it('shows the player-facing conflict and does not send a changed resource payload', async () => {
    const coordinator = new ModerationIntentCoordinator(() => 'locked-key')
    const resourceApi = vi.fn(async (_input: ModerationResourceInput & { idempotencyKey: string }) => { throw new ApiError('NETWORK_ERROR', 'Réponse perdue', null) })
    const onResource = (input: ModerationResourceInput) => coordinator.execute(
      'player-a',
      { type: 'resource', payload: input },
      (idempotencyKey) => resourceApi({ ...input, idempotencyKey }),
    )
    const { container } = await mount(onResource)
    const form = container.querySelector<HTMLFormElement>('.moderation-tool')!
    const amount = form.querySelector<HTMLInputElement>('input[type="number"]')!
    changeInput(amount, '1000')
    await submit(form)

    changeInput(amount, '2000')
    await submit(form)

    expect(resourceApi).toHaveBeenCalledOnce()
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Une opération de test précédente a un résultat incertain. Réessayez la même action pour vérifier son résultat avant d’en lancer une autre.')
  })
})
