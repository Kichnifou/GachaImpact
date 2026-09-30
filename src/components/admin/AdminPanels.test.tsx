// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminBannerOverview, AdminCharacter, AdminChatReport, AdminEvent, AdminPossession } from '../../api/admin-types'
import type { ModerationStateDto } from '../../api/types'

const api = vi.hoisted(() => ({
  setAdminRole: vi.fn(), getAdminCharacters: vi.fn(), createAdminCharacter: vi.fn(), updateAdminCharacter: vi.fn(),
  getAdminPossessions: vi.fn(), changeAdminPossession: vi.fn(), getAdminBanners: vi.fn(), correctAdminBanner: vi.fn(), retryAdminBanner: vi.fn(),
  getAdminEvents: vi.fn(), updateAdminEvent: vi.fn(), getAdminChatReports: vi.fn(), getAdminChatReport: vi.fn(),
  moderateAdminChatMessage: vi.fn(), deleteAdminChatReport: vi.fn(), getAdminAudit: vi.fn(), getAdminAuditDetail: vi.fn(),
}))
vi.mock('../../api/game-api', () => ({ getGameApiClient: () => api }))

import { ConfirmAction } from './AdminUi'
import RoleAdminPanel from './RoleAdminPanel'
import CharacterAdminPanel from './CharacterAdminPanel'
import BannerAdminPanel from './BannerAdminPanel'
import EventAdminPanel from './EventAdminPanel'
import GlobalChatReportsPanel from './GlobalChatReportsPanel'
import AdminAuditPanel from './AdminAuditPanel'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const roots: { root: Root; container: HTMLDivElement }[] = []
async function mount(element: React.ReactNode) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push({ root, container })
  await act(async () => { root.render(element); await Promise.resolve(); await Promise.resolve() })
  return { root, container }
}
async function click(button: HTMLButtonElement) { await act(async () => { button.click(); await Promise.resolve(); await Promise.resolve() }) }
function button(scope: ParentNode, label: string) {
  const found = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent?.includes(label))
  if (!found) throw new Error(`Bouton absent : ${label}`)
  return found
}
function dialog() { const found = document.body.querySelector<HTMLElement>('[role="dialog"]'); if (!found) throw new Error('Dialogue absent'); return found }
function selectValue(select: HTMLSelectElement, value: string) {
  act(() => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, value); select.dispatchEvent(new Event('change', { bubbles: true })) })
}
function inputValue(input: HTMLInputElement, value: string) {
  act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
}
const page = <T,>(entries: T[]) => ({ page: 1, pageSize: 20, total: entries.length, totalPages: 1, entries })
const character = (id: string, rarity: 4 | 5 = 5): AdminCharacter => ({ id, externalKey: id, name: id, rarity, elementKey: 'hydro',
  weaponType: null, region: null, classKey: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null,
  displayOrder: null, isActive: true, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' })
const possession = (id: string): AdminPossession => ({ playerId: 'player-a', characterId: id, constellation: 0, copies: 1,
  firstObtainedAt: '2026-09-01T00:00:00Z', favorite: false, character: { name: id, rarity: 5, elementKey: 'hydro', externalKey: id, isActive: true } })
const state = (id: string): ModerationStateDto => ({ player: { id, displayName: id === 'player-a' ? 'Alice' : 'Bob', elementKey: 'hydro',
  avatarAssetPath: null, level: 1, tester: false, rank: 'PLAYER', roles: [] },
  permissions: { roles: ['ADMIN'], capabilities: { moderationAccess: true, communityModeration: true, selfResourceTools: true,
    selfGameplayTools: true, superTools: true, canSelectPlayers: true } },
  resources: { primogems: '0', moras: '0', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } },
  progression: { totalXp: '0', level: 0, xpIntoCurrentStep: '0', xpPerStep: '30', isMaxLevel: false, level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0' },
  gachaState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0,
    selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
  stella: { quantity: '0' } })

beforeEach(() => {
  vi.resetAllMocks()
  for (const name of ['setAdminRole', 'createAdminCharacter', 'updateAdminCharacter', 'changeAdminPossession', 'correctAdminBanner',
    'retryAdminBanner', 'updateAdminEvent', 'moderateAdminChatMessage', 'deleteAdminChatReport'] as const) api[name].mockResolvedValue({ operationId: 'operation', alreadyProcessed: false })
  api.getAdminCharacters.mockResolvedValue(page([]))
  api.getAdminPossessions.mockResolvedValue(page([]))
})
afterEach(async () => { for (const { root, container } of roots.splice(0)) { await act(async () => root.unmount()); container.remove() } })

describe('Admin confirmations', () => {
  it('keeps keyboard focus inside and ignores Escape or backdrop while pending', async () => {
    function Harness() { const [open, setOpen] = useState(false); const [pending, setPending] = useState(false)
      return <><button onClick={() => setOpen(true)}>Ouvrir</button><button>Arrière</button>
        {open && <ConfirmAction title="Confirmer ?" pending={pending} onCancel={() => setOpen(false)} onConfirm={() => setPending(true)}>Action</ConfirmAction>}</> }
    const { container } = await mount(<Harness />)
    const trigger = button(container, 'Ouvrir'); trigger.focus(); await click(trigger)
    expect(container.hasAttribute('inert')).toBe(true)
    expect(dialog().contains(document.activeElement)).toBe(true)
    const confirm = button(dialog(), 'Confirmer')
    button(dialog(), 'Annuler').focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(confirm)
    confirm.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(button(dialog(), 'Annuler'))
    button(container, 'Arrière').focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(dialog().contains(document.activeElement)).toBe(true)
    await click(confirm)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await act(async () => { document.body.querySelector<HTMLElement>('.admin-confirm-overlay')!.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(dialog()).toBeTruthy()
    expect(button(dialog(), 'Annuler').disabled).toBe(true)
  })

  it('restores focus and cancels on Escape or backdrop when idle', async () => {
    function Harness() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>Ouvrir</button><button>Arrière</button>
      {open && <ConfirmAction title="Confirmer ?" onCancel={() => setOpen(false)} onConfirm={() => {}}>Action</ConfirmAction>}</> }
    const { container } = await mount(<Harness />)
    const trigger = button(container, 'Ouvrir'); trigger.focus(); await click(trigger)
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(container.hasAttribute('inert')).toBe(false)
    expect(document.activeElement).toBe(trigger)
    await click(trigger)
    await act(async () => { document.body.querySelector<HTMLElement>('.admin-confirm-overlay')!.dispatchEvent(new Event('pointerdown', { bubbles: true })) })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('keeps a role grant attached to the Player named when the dialog opened', async () => {
    const onChanged = vi.fn(async () => {})
    const { root, container } = await mount(<RoleAdminPanel state={state('player-a')} onChanged={onChanged} />)
    await click(button(Array.from(container.querySelectorAll('.admin-role-list > div')).find(row => row.textContent?.includes('Modérateur'))!, 'Attribuer'))
    expect(dialog().textContent).toContain('Alice')
    await act(async () => root.render(<RoleAdminPanel state={state('player-b')} onChanged={onChanged} />))
    await click(button(dialog(), 'Confirmer'))
    expect(api.setAdminRole).toHaveBeenCalledWith('player-a', 'MODERATOR', true, expect.any(String))
  })

  it('keeps a possession removal attached to its original Player and character', async () => {
    api.getAdminPossessions.mockResolvedValue(page([possession('hero-a')]))
    const { root, container } = await mount(<CharacterAdminPanel playerId="player-a" playerName="Alice" />)
    await click(button(container, 'Possessions de Alice'))
    await click(button(container, 'Retirer'))
    expect(dialog().textContent).toContain('Alice')
    await act(async () => { root.render(<CharacterAdminPanel playerId="player-b" playerName="Bob" />); await Promise.resolve() })
    await click(button(dialog(), 'Confirmer'))
    expect(api.changeAdminPossession).toHaveBeenCalledWith('player-a', 'hero-a', { action: 'remove', idempotencyKey: expect.any(String) })
  })

  it('submits the banner composition copied before the dialog opened', async () => {
    const fives = Array.from({ length: 5 }, (_, index) => character(`five-${index + 1}`))
    const fours = Array.from({ length: 6 }, (_, index) => character(`four-${index + 1}`, 4))
    api.getAdminCharacters.mockImplementation(async (query: { rarity: 4 | 5 }) => page(query.rarity === 5 ? fives : fours))
    const overview: AdminBannerOverview = { active: { id: 'rotation-x', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-10-31T00:00:00Z', status: 'ACTIVE',
      generationVoteSnapshot: { original: true }, legacyProvenance: null, featuredCharacters: [
        ...fives.slice(0, 4).map((row, index) => ({ characterId: row.id, rarity: 5, slot: index + 1, selectionSource: 'RANDOM', character: { name: row.name, isActive: true, rarity: 5 } })),
        ...fours.map((row, index) => ({ characterId: row.id, rarity: 4, slot: index + 1, selectionSource: 'RANDOM', character: { name: row.name, isActive: true, rarity: 4 } })),
      ] }, next: null, currentWeek: { startsAt: '2026-09-28T00:00:00Z', endsAt: '2026-10-05T00:00:00Z' },
      voteCycle: { candidates: [], totalVotes: 0 }, diagnostics: { validComposition: true, withinWindow: true, inactiveFeatured: [] } }
    api.getAdminBanners.mockResolvedValue(overview)
    const { container } = await mount(<BannerAdminPanel />)
    await click(button(container, 'Corriger la bannière active'))
    const firstSelect = container.querySelector<HTMLSelectElement>('.admin-banner-slots select')!
    selectValue(firstSelect, 'five-5')
    await click(button(dialog(), 'Confirmer'))
    expect(api.correctAdminBanner).toHaveBeenCalledWith('rotation-x', { fiveStarIds: ['five-1', 'five-2', 'five-3', 'five-4'],
      fourStarIds: fours.map(row => row.id), idempotencyKey: expect.any(String) })
  })

  it('submits the confirmed week for a banner-generation retry', async () => {
    const week = { startsAt: '2026-09-28T00:00:00Z', endsAt: '2026-10-05T00:00:00Z' }
    api.getAdminBanners.mockResolvedValue({ active: null, next: null, currentWeek: week,
      voteCycle: { candidates: [], totalVotes: 0 }, diagnostics: { validComposition: false, withinWindow: false, inactiveFeatured: [] } } satisfies AdminBannerOverview)
    const { container } = await mount(<BannerAdminPanel />)
    await click(button(container, 'courante'))
    await click(button(dialog(), 'Confirmer'))
    expect(api.retryAdminBanner).toHaveBeenCalledWith(expect.any(String), week.startsAt)
  })
})

describe('Admin panel actions', () => {
  it('saves the complete editable Character metadata', async () => {
    api.getAdminCharacters.mockResolvedValue(page([{ ...character('hero-a'), name: 'Ancien' }]))
    const { container } = await mount(<CharacterAdminPanel playerId="player-a" playerName="Alice" />)
    await click(button(container, 'Modifier'))
    const weapon = Array.from(container.querySelectorAll<HTMLInputElement>('.admin-editor input')).find(input => input.parentElement?.textContent?.includes('Arme'))!
    inputValue(weapon, 'Épée')
    await click(button(container, 'Enregistrer'))
    expect(api.updateAdminCharacter).toHaveBeenCalledWith('hero-a', expect.objectContaining({ weaponType: 'Épée', idempotencyKey: expect.any(String) }))
  })

  it('deactivates the selected Event definition only after confirmation', async () => {
    const event: AdminEvent = { id: 'event-a', externalKey: 'event-a', displayName: 'Festival A', calendarMonth: 11, currencyKey: 'festival',
      config: { emoji: '⭐', currency: { label: 'Étoile', emoji: '⭐' }, collection: { key: 'star', label: 'Étoile' } }, isActive: true, editions: [] }
    api.getAdminEvents.mockResolvedValue({ entries: [event] })
    const { container } = await mount(<EventAdminPanel />)
    await click(button(container, 'Désactiver'))
    expect(api.updateAdminEvent).not.toHaveBeenCalled()
    await click(button(dialog(), 'Confirmer'))
    expect(api.updateAdminEvent).toHaveBeenCalledWith('event-a', { isActive: false, idempotencyKey: expect.any(String) })
  })

  it('opens a frozen Chat report and moderates its source without deleting the report', async () => {
    const report: AdminChatReport = { id: 'report-a', messageId: 'message-a', reporterPlayerId: 'reporter', reportedPlayerId: 'author',
      messageSnapshot: { content: 'Signalé' }, contextSnapshot: [{ id: 'message-a', content: 'Preuve gelée', deletionState: 'ACTIVE', createdAt: '2026-09-01T00:00:00Z' }],
      createdAt: '2026-09-01T00:00:00Z', reporter: { displayName: 'Reporter' }, reported: { displayName: 'Auteur' }, message: { deletionState: 'ACTIVE' } }
    api.getAdminChatReports.mockResolvedValue(page([report])); api.getAdminChatReport.mockResolvedValue(report)
    const { container } = await mount(<GlobalChatReportsPanel />)
    await click(button(container, 'Auteur'))
    expect(container.textContent).toContain('Preuve gelée')
    await click(button(container, 'Modérer le message source'))
    await click(button(dialog(), 'Confirmer'))
    expect(api.moderateAdminChatMessage).toHaveBeenCalledWith('report-a', expect.any(String))
    expect(api.deleteAdminChatReport).not.toHaveBeenCalled()
  })

  it('filters the Journal and opens a read-only detail', async () => {
    const entry = { id: 'audit-a', actorPlayerId: 'admin', actorName: 'Admin', targetPlayerId: 'target', targetName: 'Target', domain: 'roles',
      action: 'grant-tester', operationId: 'operation-a', createdAt: '2026-09-01T00:00:00Z', before: { enabled: false }, after: { enabled: true } }
    api.getAdminAudit.mockResolvedValue(page([entry])); api.getAdminAuditDetail.mockResolvedValue(entry)
    const { container } = await mount(<AdminAuditPanel />)
    inputValue(container.querySelector<HTMLInputElement>('.admin-filters input')!, 'roles')
    expect(api.getAdminAudit).toHaveBeenLastCalledWith({ page: 1, domain: 'roles', action: undefined })
    await click(button(container, 'grant-tester'))
    expect(api.getAdminAuditDetail).toHaveBeenCalledWith('audit-a')
    expect(container.textContent).toContain('operation-a')
  })
})
