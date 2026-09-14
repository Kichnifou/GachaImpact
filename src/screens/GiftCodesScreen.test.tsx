// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AdminGiftCodeDto, AdminGiftCodesDto, GiftCodeDto, PlayerGiftCodesDto } from '../api/types'
import GiftCodeAdminPanel from '../components/GiftCodeAdminPanel'
import GiftCodesScreen from './GiftCodesScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const code: GiftCodeDto = { id: 'code-1', editionId: 'edition-1', token: 'FESTIVALRECOLTES', title: 'Festival des Récoltes', description: 'Un cadeau de septembre.', type: 'ANNUAL', editionKey: '2026', startsAt: '2026-08-31T22:00:00.000Z', endsAt: '2026-09-30T22:00:00.000Z', available: true, claimed: false, claimedAt: null, rewards: [{ resourceKey: 'primogems', displayName: 'Primogemmes', amount: '1600' }, { resourceKey: 'moras', displayName: 'Moras', amount: '200000' }] }
const initial: PlayerGiftCodesDto = { available: [code], claimed: [] }
let roots: Root[] = []
afterEach(() => { roots.forEach((root) => act(() => root.unmount())); roots = [] })

describe('GiftCodesScreen', () => {
  it('shows exact rewards and moves a claimed edition to Récupérés', async () => {
    const container = document.createElement('div'); const root = createRoot(container); roots.push(root)
    const onClaim = vi.fn(async () => ({ available: [], claimed: [{ ...code, claimed: true, claimedAt: '2026-09-14T12:00:00.000Z' }], resources: { primogems: '1600', moras: '200000', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } }, operation: { id: 'operation-1', alreadyProcessed: false } }))
    await act(async () => { root.render(<GiftCodesScreen onLoad={async () => initial} onClaim={onClaim} />); await Promise.resolve() })
    expect(container.textContent?.replace(/\s/g, '')).toContain('+1600Primogemmes')
    expect(container.textContent?.replace(/\s/g, '')).toContain('+200000Moras')
    await act(async () => { container.querySelector<HTMLButtonElement>('.gift-code-card > button')!.click(); await Promise.resolve() })
    expect(onClaim).toHaveBeenCalledWith('edition-1', expect.any(String))
    expect(container.textContent).toContain('Récupéré le')
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Récupérés')
  })

  it('shows an honest empty state in both tabs', async () => {
    const container = document.createElement('div'); const root = createRoot(container); roots.push(root)
    await act(async () => { root.render(<GiftCodesScreen onLoad={async () => ({ available: [], claimed: [] })} onClaim={vi.fn()} />); await Promise.resolve() })
    expect(container.textContent).toContain('Aucun code cadeau disponible pour le moment.')
    await act(async () => { Array.from(container.querySelectorAll('[role="tab"]')).find((tab) => tab.textContent?.includes('Récupérés'))!.dispatchEvent(new MouseEvent('click', { bubbles: true })); await Promise.resolve() })
    expect(container.textContent).toContain('Vous n’avez encore récupéré aucun code cadeau.')
  })

  it('edits identity and rewards only before the first claim', async () => {
    const adminCode: AdminGiftCodeDto = { id: 'code-admin', token: 'CADEAU-TEST', title: 'Cadeau test', description: 'Description', type: 'ANNUAL', status: 'PUBLISHED', recurringMonth: 9, startsAt: null, endsAt: null, createdAt: '2026-09-13T12:00:00.000Z', publishedAt: '2026-09-14T12:00:00.000Z', claimCount: 0, locked: false, rewards: [{ resourceKey: 'primogems', displayName: 'Primogemmes', amount: '1600' }], editions: [] }
    const renderAdmin = async (codeValue: AdminGiftCodeDto) => {
      const container = document.createElement('div'); const root = createRoot(container); roots.push(root)
      const value: AdminGiftCodesDto = { actorPlayerId: 'admin', codes: [codeValue] }
      const onUpdate = vi.fn(async (_codeId: string, _input: Record<string, unknown>) => value)
      await act(async () => { root.render(<GiftCodeAdminPanel onLoad={async () => value} onCreate={async () => value} onPublish={async () => value} onUpdate={onUpdate} onClaimants={async () => ({ code: { id: codeValue.id, token: codeValue.token, title: codeValue.title }, claimants: [] })} />); await Promise.resolve() })
      await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Modifier')!.click(); await Promise.resolve() })
      return { container, onUpdate }
    }

    const unlocked = await renderAdmin(adminCode)
    expect(unlocked.container.querySelector<HTMLInputElement>('.gift-code-edit-modal input[value="CADEAU-TEST"]')?.disabled).toBe(false)
    await act(async () => { unlocked.container.querySelector<HTMLFormElement>('.gift-code-edit-modal')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
    expect(unlocked.onUpdate).toHaveBeenCalledWith('code-admin', expect.objectContaining({ token: 'CADEAU-TEST', type: 'ANNUAL', recurringMonth: 9, rewards: [{ resourceKey: 'primogems', amount: '1600' }] }))

    const locked = await renderAdmin({ ...adminCode, claimCount: 1, locked: true })
    expect(locked.container.querySelector<HTMLInputElement>('.gift-code-edit-modal input[value="CADEAU-TEST"]')?.disabled).toBe(true)
    await act(async () => { locked.container.querySelector<HTMLFormElement>('.gift-code-edit-modal')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
    const lockedInput = locked.onUpdate.mock.calls[0]![1]
    expect(lockedInput).not.toHaveProperty('token')
    expect(lockedInput).not.toHaveProperty('type')
    expect(lockedInput).not.toHaveProperty('recurringMonth')
    expect(lockedInput).not.toHaveProperty('rewards')
  })
})
