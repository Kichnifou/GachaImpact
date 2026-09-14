// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../api/game-api'
import type { AdminGiftCodeDto, AdminGiftCodesDto, GiftCodeDto, PlayerGiftCodesDto } from '../api/types'
import GiftCodeAdminPanel from '../components/GiftCodeAdminPanel'
import GiftCodesScreen from './GiftCodesScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const code: GiftCodeDto = { id: 'code-1', editionId: 'edition-1', token: 'FESTIVALRECOLTES', title: 'Festival des Récoltes', description: 'Un cadeau de septembre.', type: 'ANNUAL', editionKey: '2026', startsAt: '2026-08-31T22:00:00.000Z', endsAt: '2026-09-30T22:00:00.000Z', available: true, claimed: false, claimedAt: null, rewards: [{ resourceKey: 'primogems', displayName: 'Primogemmes', amount: '1600' }, { resourceKey: 'moras', displayName: 'Moras', amount: '200000' }] }
const initial: PlayerGiftCodesDto = { available: [code], claimed: [] }
let roots: Root[] = []
afterEach(() => { roots.forEach((root) => act(() => root.unmount())); roots = []; document.body.replaceChildren() })

async function waitFor(predicate: () => boolean, message: string) {
  const deadline = Date.now() + 2_000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message)
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 10)) })
  }
}

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
      const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
      const value: AdminGiftCodesDto = { actorPlayerId: 'admin', page: 1, pageSize: 20, total: 1, totalPages: 1, codes: [codeValue] }
      const mutation = { code: codeValue }
      const onUpdate = vi.fn(async (_codeId: string, _input: Record<string, unknown>) => mutation)
      await act(async () => { root.render(<GiftCodeAdminPanel onLoad={async () => value} onCreate={async () => mutation} onPublish={async () => mutation} onUpdate={onUpdate} onClaimants={async () => ({ code: { id: codeValue.id, token: codeValue.token, title: codeValue.title }, page: 1, pageSize: 20, total: 0, totalPages: 1, claimants: [] })} />) })
      await waitFor(() => Array.from(container.querySelectorAll('button')).some((button) => button.textContent === 'Liste'), 'Le bouton Liste n’a pas été rendu.')
      await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Liste')!.click() })
      await waitFor(() => Array.from(document.querySelectorAll('button')).some((button) => button.textContent === 'Modifier'), 'La liste des codes n’a pas été chargée.')
      await act(async () => { Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Modifier')!.click() })
      return { container, onUpdate, root }
    }

    const unlocked = await renderAdmin(adminCode)
    expect(document.querySelector<HTMLInputElement>('.gift-code-edit-modal input[value="CADEAU-TEST"]')?.disabled).toBe(false)
    await act(async () => { document.querySelector<HTMLFormElement>('.gift-code-edit-modal')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
    expect(unlocked.onUpdate).toHaveBeenCalledWith('code-admin', expect.objectContaining({ token: 'CADEAU-TEST', type: 'ANNUAL', recurringMonth: 9, rewards: [{ resourceKey: 'primogems', amount: '1600' }] }))
    act(() => unlocked.root.unmount())
    roots.splice(roots.indexOf(unlocked.root), 1)
    unlocked.container.remove()

    const locked = await renderAdmin({ ...adminCode, claimCount: 1, locked: true })
    expect(document.querySelector<HTMLInputElement>('.gift-code-edit-modal input[value="CADEAU-TEST"]')?.disabled).toBe(true)
    await act(async () => { document.querySelector<HTMLFormElement>('.gift-code-edit-modal')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await Promise.resolve(); await Promise.resolve() })
    const lockedInput = locked.onUpdate.mock.calls[0]![1]
    expect(lockedInput).not.toHaveProperty('token')
    expect(lockedInput).not.toHaveProperty('type')
    expect(lockedInput).not.toHaveProperty('recurringMonth')
    expect(lockedInput).not.toHaveProperty('rewards')
  })

  it('keeps both admin modals accessible and restores focus for every close path', async () => {
    const adminCode: AdminGiftCodeDto = { id: 'code-admin', token: 'CADEAU-TEST', title: 'Cadeau test', description: 'Description', type: 'ANNUAL', status: 'PUBLISHED', recurringMonth: 9, startsAt: null, endsAt: null, createdAt: '2026-09-13T12:00:00.000Z', publishedAt: '2026-09-14T12:00:00.000Z', claimCount: 1, locked: true, rewards: [{ resourceKey: 'primogems', displayName: 'Primogemmes', amount: '1600' }], editions: [] }
    const value: AdminGiftCodesDto = { actorPlayerId: 'admin', page: 1, pageSize: 20, total: 1, totalPages: 1, codes: [adminCode] }
    const mutation = { code: adminCode }
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const onLoad = vi.fn(async () => value)
    await act(async () => { root.render(<GiftCodeAdminPanel onLoad={onLoad} onCreate={async () => mutation} onPublish={async () => mutation} onUpdate={async () => mutation} onClaimants={async () => ({ code: { id: adminCode.id, token: adminCode.token, title: adminCode.title }, page: 1, pageSize: 20, total: 1, totalPages: 1, claimants: [{ playerId: 'player-1', displayName: 'Joueuse', editionKey: '2026', claimedAt: '2026-09-14T12:00:00.000Z' }] })} />) })
    await waitFor(() => Array.from(container.querySelectorAll('button')).some((button) => button.textContent === 'Liste'), 'Le bouton Liste n’a pas été rendu.')
    expect(onLoad).not.toHaveBeenCalled()
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Liste')!.click() })
    await waitFor(() => onLoad.mock.calls.length > 0, 'La liste des codes n’a pas été chargée.')
    await waitFor(() => Array.from(document.querySelectorAll('button')).some((button) => button.textContent === 'Modifier'), 'Les actions de la liste n’ont pas été rendues.')
    expect(onLoad).toHaveBeenCalledWith({ page: 1, sort: 'createdAt', direction: 'desc' })

    const button = (label: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((candidate) => candidate.textContent === label)!
    const open = async (label: string) => { const opener = button(label); opener.focus(); await act(async () => { opener.click(); await Promise.resolve() }); return opener }
    const press = async (key: string, shiftKey = false) => { await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true })); await Promise.resolve() }) }

    let opener = await open('Modifier')
    let dialog = document.querySelector<HTMLElement>('.gift-code-edit-modal')!
    expect(dialog).not.toBeNull()
    expect(dialog.contains(document.activeElement)).toBe(true)
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'))
    focusable.at(-1)!.focus()
    await press('Tab')
    expect(document.activeElement).toBe(focusable[0])
    await press('Escape')
    expect(document.querySelector('.gift-code-edit-modal')).toBeNull()
    expect(document.querySelector('.gift-code-list-modal')).not.toBeNull()
    expect(document.activeElement).toBe(opener)

    opener = await open('Modifier')
    await act(async () => { document.querySelector<HTMLElement>('.nested-modal-layer')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await Promise.resolve() })
    expect(document.querySelector('.gift-code-edit-modal')).toBeNull()
    expect(document.activeElement).toBe(opener)

    opener = await open('Modifier')
    await act(async () => { document.querySelector<HTMLButtonElement>('.gift-code-edit-modal [aria-label="Fermer"]')!.click(); await Promise.resolve() })
    expect(document.querySelector('.gift-code-edit-modal')).toBeNull()
    expect(document.activeElement).toBe(opener)

    opener = await open('Récupérations')
    await waitFor(() => Boolean(document.querySelector('.gift-code-claimants-modal')), 'Le détail des récupérations n’a pas été rendu.')
    dialog = document.querySelector<HTMLElement>('.gift-code-claimants-modal')!
    expect(dialog.getAttribute('aria-label')).toBe('Détail des récupérations')
    expect(dialog.contains(document.activeElement)).toBe(true)
    await press('Tab')
    expect(dialog.contains(document.activeElement)).toBe(true)
    await press('Escape')
    expect(document.querySelector('.gift-code-claimants-modal')).toBeNull()
    expect(document.activeElement).toBe(opener)

    opener = await open('Récupérations')
    await act(async () => { document.querySelector<HTMLElement>('.nested-modal-layer')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await Promise.resolve() })
    expect(document.querySelector('.gift-code-claimants-modal')).toBeNull()
    expect(document.activeElement).toBe(opener)

    opener = await open('Récupérations')
    await act(async () => { document.querySelector<HTMLButtonElement>('.gift-code-claimants-modal [aria-label="Fermer"]')!.click(); await Promise.resolve() })
    expect(document.querySelector('.gift-code-claimants-modal')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('loads, filters, sorts, and paginates the complete admin catalogue through server queries', async () => {
    const adminCode: AdminGiftCodeDto = { id: 'code-admin', token: 'CADEAU-TEST', title: 'Cadeau test', description: 'Description', type: 'ANNUAL', status: 'PUBLISHED', recurringMonth: 9, startsAt: null, endsAt: null, createdAt: '2026-09-13T12:00:00.000Z', publishedAt: '2026-09-14T12:00:00.000Z', claimCount: 21, locked: true, rewards: [{ resourceKey: 'primogems', displayName: 'Primogemmes', amount: '1600' }], editions: [] }
    const onLoad = vi.fn(async (query: { page: number }) => ({ actorPlayerId: 'admin', page: query.page, pageSize: 20 as const, total: 21, totalPages: 2, codes: [adminCode] }))
    const mutation = { code: adminCode }
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    await act(async () => { root.render(<GiftCodeAdminPanel onLoad={onLoad} onCreate={async () => mutation} onPublish={async () => mutation} onUpdate={async () => mutation} onClaimants={async () => ({ code: { id: adminCode.id, token: adminCode.token, title: adminCode.title }, page: 1, pageSize: 20, total: 0, totalPages: 1, claimants: [] })} />) })
    await waitFor(() => container.querySelectorAll('.gift-code-admin-form-heading button').length === 2, 'Les actions d’administration n’ont pas été rendues.')
    const headingButtons = container.querySelectorAll<HTMLButtonElement>('.gift-code-admin-form-heading button')
    expect(Array.from(headingButtons, (button) => button.textContent)).toEqual(['Liste', 'Générer le code'])
    expect(onLoad).not.toHaveBeenCalled()
    await act(async () => { headingButtons[0]!.click() })
    await waitFor(() => onLoad.mock.calls.length > 0, 'La liste des codes n’a pas été chargée.')
    expect(onLoad).toHaveBeenLastCalledWith({ page: 1, sort: 'createdAt', direction: 'desc' })

    const modal = document.querySelector<HTMLElement>('.gift-code-list-modal')!
    const status = Array.from(modal.querySelectorAll<HTMLSelectElement>('select')).find((select) => select.closest('label')?.textContent?.startsWith('État'))!
    const callsBeforeStatus = onLoad.mock.calls.length
    await act(async () => { status.value = 'PUBLISHED'; status.dispatchEvent(new Event('change', { bubbles: true })) })
    await waitFor(() => onLoad.mock.calls.length > callsBeforeStatus, 'Le filtre d’état n’a pas été appliqué.')
    expect(onLoad).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: 'PUBLISHED', sort: 'createdAt', direction: 'desc' }))
    const direction = modal.querySelector<HTMLButtonElement>('[aria-label="Tri descendant"]')!
    const callsBeforeDirection = onLoad.mock.calls.length
    await act(async () => { direction.click() })
    await waitFor(() => onLoad.mock.calls.length > callsBeforeDirection, 'Le sens de tri n’a pas été appliqué.')
    expect(onLoad).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, status: 'PUBLISHED', direction: 'asc' }))
    const next = Array.from(modal.querySelectorAll<HTMLButtonElement>('footer button')).find((button) => button.textContent === 'Suivant')!
    const callsBeforePage = onLoad.mock.calls.length
    await act(async () => { next.click() })
    await waitFor(() => onLoad.mock.calls.length > callsBeforePage, 'La page suivante n’a pas été chargée.')
    expect(onLoad).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, status: 'PUBLISHED', direction: 'asc' }))
  })

  it('keeps one idempotency key for an ambiguous create retry and reports pending then confirmation', async () => {
    const adminCode: AdminGiftCodeDto = { id: 'code-admin', token: 'CADEAU-TEST', title: 'Cadeau test', description: 'Description', type: 'ONE_OFF', status: 'DRAFT', recurringMonth: null, startsAt: '2026-09-14T12:00:00.000Z', endsAt: '2026-10-14T12:00:00.000Z', createdAt: '2026-09-14T12:00:00.000Z', publishedAt: null, claimCount: 0, locked: false, rewards: [{ resourceKey: 'primogems', displayName: 'Primogemmes', amount: '1' }], editions: [] }
    let release!: () => void
    const firstResponse = new Promise<never>((_resolve, reject) => { release = () => reject(new ApiError('NETWORK_ERROR', 'Réponse perdue', null)) })
    const onCreate = vi.fn().mockImplementationOnce(() => firstResponse).mockResolvedValue({ code: adminCode })
    const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
    const mutation = { code: adminCode }
    await act(async () => { root.render(<GiftCodeAdminPanel onLoad={async () => ({ actorPlayerId: 'admin', page: 1, pageSize: 20, total: 0, totalPages: 1, codes: [] })} onCreate={onCreate} onPublish={async () => mutation} onUpdate={async () => mutation} onClaimants={async () => ({ code: { id: adminCode.id, token: adminCode.token, title: adminCode.title }, page: 1, pageSize: 20, total: 0, totalPages: 1, claimants: [] })} />); await Promise.resolve() })
    const form = container.querySelector<HTMLFormElement>('.gift-code-admin-form')!
    const setInput = (selector: string, value: string) => { const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!; const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) }
    act(() => { setInput('input[placeholder="Saisie manuelle ou génération"]', 'CADEAU-TEST'); setInput('input[required]', 'Cadeau test'); setInput('textarea[required]', 'Description'); setInput('.gift-code-admin-rewards input', '1') })

    act(() => form.requestSubmit())
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Enregistrement…')
    expect(onCreate).toHaveBeenCalledTimes(1)
    const key = onCreate.mock.calls[0]![0].idempotencyKey
    await act(async () => { release(); await firstResponse.catch(() => undefined); await Promise.resolve() })
    await act(async () => { form.requestSubmit(); await Promise.resolve(); await Promise.resolve() })
    expect(onCreate).toHaveBeenCalledTimes(2)
    expect(onCreate.mock.calls[1]![0].idempotencyKey).toBe(key)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Modification enregistrée.')
  })
})
