// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BankTransferDto, PlayerBankDto, PlayerResourcesDto } from '../api/types'
import { applyBankWalletToResources, formatBankCountdown } from '../bank/bank-presentation'
import BankScreen from './BankScreen'
import { ApiError } from '../api/game-api'
import { BankTransferIntentCoordinator } from '../bank/bank-transfer-intent-coordinator'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const now = new Date('2026-09-09T12:00:00.000Z').getTime()
const bank = (overrides: Partial<PlayerBankDto> = {}): PlayerBankDto => ({
  walletMoras: '1000', bankMoras: '500', totalWealth: '1500', estimatedInterest: '15', interestRatePercent: 3,
  nextInterestAt: '2026-09-09T22:00:00.000Z',
  recentOperations: [{ id: 'op', type: 'INTEREST', amount: '15', bankBalanceAfter: '500', walletBalanceAfter: null, businessDate: '2026-09-09', createdAt: '2026-09-09T00:00:00.000Z' }],
  ...overrides,
})

const roots: Root[] = []
afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()))
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function mount(overrides: Partial<React.ComponentProps<typeof BankScreen>> = {}) {
  const onLoad = overrides.onLoad ?? vi.fn(async () => bank())
  const onTransfer = overrides.onTransfer ?? vi.fn(async (direction: 'deposit' | 'withdraw'): Promise<BankTransferDto> => ({
    ...bank(direction === 'deposit' ? { walletMoras: '750', bankMoras: '750' } : {}),
    operation: { id: direction, alreadyProcessed: false },
  }))
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => { root.render(<BankScreen onLoad={onLoad} onTransfer={onTransfer} />); await Promise.resolve(); await Promise.resolve() })
  return { container, onLoad, onTransfer }
}

function changeInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('Bank screen', () => {
  it('renders the zero account without inventing operations', async () => {
    const { container } = await mount({ onLoad: vi.fn(async () => bank({ walletMoras: '0', bankMoras: '0', totalWealth: '0', estimatedInterest: '0', recentOperations: [] })) })
    expect(container.textContent).toContain('Aucune opération')
    expect(container.textContent).toContain('Votre premier dépôt apparaîtra ici.')
    expect(container.querySelectorAll('.bank-balance-card strong')).toHaveLength(3)
  })

  it('renders authoritative balances, estimated interest, countdown and recent history', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const { container } = await mount()
    expect(container.textContent).toContain('Portefeuille')
    expect(container.textContent).toContain('1 000')
    expect(container.textContent).toContain('Patrimoine')
    expect(container.textContent).toContain('Prochain gain estimé : +15')
    expect(container.textContent).toContain('10 h 00 min')
    expect(container.textContent).toContain('Intérêt quotidien')
  })

  it('submits a deposit, applies the response immediately and supports server-side MAX', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const onTransfer = vi.fn(async (_direction: 'deposit' | 'withdraw', amount: string): Promise<BankTransferDto> => ({ ...bank({ walletMoras: amount === 'max' ? '0' : '750', bankMoras: amount === 'max' ? '1500' : '750', totalWealth: '1500', estimatedInterest: amount === 'max' ? '45' : '22' }), operation: { id: amount, alreadyProcessed: false } }))
    const { container } = await mount({ onTransfer })
    const form = container.querySelector<HTMLFormElement>('.bank-transfer-form.deposit')!
    const input = form.querySelector<HTMLInputElement>('input')!
    act(() => changeInput(input, '250'))
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
    expect(onTransfer.mock.calls[0]).toEqual(['deposit', '250'])
    expect(container.textContent).toContain('750')
    const max = form.querySelector<HTMLButtonElement>('.bank-max-button')!
    await act(async () => { max.click(); await Promise.resolve(); await Promise.resolve() })
    expect(onTransfer.mock.calls[1]).toEqual(['deposit', 'max'])
    expect(container.textContent).toContain('1 500')
  })

  it('submits withdrawals, keeps controls pending and sends MAX as an authoritative intent', async () => {
    let resolveWithdrawal!: (value: BankTransferDto) => void
    const onTransfer = vi.fn((_direction: 'deposit' | 'withdraw', _amount: string) => new Promise<BankTransferDto>((resolve) => { resolveWithdrawal = resolve }))
    const { container } = await mount({ onTransfer })
    const form = container.querySelector<HTMLFormElement>('.bank-transfer-form.withdraw')!
    const input = form.querySelector<HTMLInputElement>('input')!
    act(() => changeInput(input, '125'))
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve() })
    expect(onTransfer.mock.calls[0]).toEqual(['withdraw', '125'])
    expect(form.querySelector<HTMLButtonElement>('.bank-submit-button')?.textContent).toBe('Traitement…')
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('.bank-transfer-form button')).every(({ disabled }) => disabled)).toBe(true)
    await act(async () => { resolveWithdrawal({ ...bank({ walletMoras: '1125', bankMoras: '375', estimatedInterest: '11' }), operation: { id: 'withdraw', alreadyProcessed: false } }); await Promise.resolve(); await Promise.resolve() })
    expect(container.textContent).toContain('1 125')
    await act(async () => { form.querySelector<HTMLButtonElement>('.bank-max-button')!.click(); await Promise.resolve() })
    expect(onTransfer.mock.calls[1]).toEqual(['withdraw', 'max'])
  })

  it('keeps invalid input local while server errors remain visible', async () => {
    const onTransfer = vi.fn(async () => { throw new ApiError('BANK_WALLET_INSUFFICIENT', 'Refus autoritaire', 409) })
    const { container } = await mount({ onTransfer })
    const form = container.querySelector<HTMLFormElement>('.bank-transfer-form.deposit')!
    act(() => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(container.textContent).toContain('Saisissez un montant entier strictement positif.')
    const input = form.querySelector<HTMLInputElement>('input')!
    act(() => changeInput(input, '10'))
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
    expect(container.textContent).toContain('Votre portefeuille ne contient pas assez de Moras.')
  })

  it('retries an ambiguous transfer with the same key and blocks a different intent', async () => {
    const coordinator = new BankTransferIntentCoordinator(() => 'stable-key')
    let attempt = 0
    const request = vi.fn(async (_direction: 'deposit' | 'withdraw', _amount: string, _idempotencyKey: string): Promise<BankTransferDto> => {
      attempt += 1
      if (attempt === 1) throw new ApiError('NETWORK_ERROR', 'Réponse perdue', null)
      return { ...bank({ walletMoras: '900', bankMoras: '600', totalWealth: '1500', estimatedInterest: '18' }), operation: { id: 'deposit', alreadyProcessed: true } }
    })
    const onTransfer = (direction: 'deposit' | 'withdraw', amount: string) => coordinator.execute('player', direction, amount, (idempotencyKey) => request(direction, amount, idempotencyKey))
    const { container } = await mount({ onTransfer })
    const form = container.querySelector<HTMLFormElement>('.bank-transfer-form.deposit')!
    const input = form.querySelector<HTMLInputElement>('input')!

    act(() => changeInput(input, '100'))
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
    expect(request.mock.calls[0]).toEqual(['deposit', '100', 'stable-key'])

    act(() => changeInput(input, '200'))
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
    expect(request).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Une opération Banque précédente doit d’abord être vérifiée ou réessayée avec le même montant.')

    act(() => changeInput(input, '100'))
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
    expect(request.mock.calls[1]).toEqual(['deposit', '100', 'stable-key'])
    expect(container.textContent).toContain('900')
    expect(container.textContent).toContain('600')
    expect(coordinator.getIntent('player')).toBeNull()
  })

  it('refetches when the authoritative countdown reaches zero', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const onLoad = vi.fn()
      .mockResolvedValueOnce(bank({ nextInterestAt: new Date(now + 1_000).toISOString() }))
      .mockResolvedValueOnce(bank({ bankMoras: '515', totalWealth: '1515', nextInterestAt: new Date(now + 86_400_000).toISOString() }))
    await mount({ onLoad })
    await act(async () => { await vi.advanceTimersByTimeAsync(1_100); await Promise.resolve() })
    expect(onLoad).toHaveBeenCalledTimes(2)
  })

  it('updates the sidebar wallet snapshot losslessly and formats countdowns', () => {
    const resources: PlayerResourcesDto = { primogems: '2', moras: '9007199254740993', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } }
    expect(applyBankWalletToResources(resources, { walletMoras: '9007199254740994' }).moras).toBe('9007199254740994')
    expect(formatBankCountdown(0)).toBe('00 h 00 min')
    expect(formatBankCountdown(3_660_000)).toBe('01 h 01 min')
  })
})
