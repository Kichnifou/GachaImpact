// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PermanentMissionDto, PermanentMissionRankDto, PlayerMissionsDto } from '../api/types'
import { lockedZMessage, progressPercent } from '../missions/mission-presentation'
import MissionsScreen from './MissionsScreen'
import { TutorialPresentationContext } from '../tutorial/tutorial-presentation'
import { getTutorialStep, type TutorialStepId } from '../tutorial/tutorial-catalog'
import MissionProjectionView from '../missions/MissionProjectionView'
import { missionPageGeometry } from '../missions/MissionPages'

const roots: Root[] = []
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })

const mission = (rank: PermanentMissionRankDto, index: number, status: PermanentMissionDto['status'] = index === 0 ? 'COMPLETED' : index === 1 ? 'ACTIVE' : 'LOCKED'): PermanentMissionDto => ({
  externalKey: `${rank.toLocaleLowerCase('fr-FR')}-mission-${index + 1}`,
  rank,
  displayName: `Mission ${rank}${index + 1}`,
  description: `Description publique ${rank}${index + 1}`,
  progressLabel: 'Actions réalisées',
  progress: status === 'COMPLETED' ? '9007199254740993' : index === 1 ? '5' : '0',
  target: status === 'COMPLETED' ? '9007199254740993' : '10',
  status,
  rewardPrimogems: '1600',
  completedAt: status === 'COMPLETED' ? '2026-09-25T10:00:00.000Z' : null,
})
const nine = (rank: 'B' | 'A' | 'S') => Array.from({ length: 9 }, (_, index) => mission(rank, index))
const locked: PlayerMissionsDto = { catchUpApplied: false, ranks: { B: nine('B'), A: nine('A'), S: nine('S') }, z: { status: 'LOCKED' } }
const unlocked: PlayerMissionsDto = { ...locked, z: { status: 'ACTIVE', unlockedAt: '2026-09-25T09:00:00.000Z', missions: Array.from({ length: 4 }, (_, index) => mission('Z', index, index === 0 ? 'COMPLETED' : 'ACTIVE')) } }

async function mount(onLoad = vi.fn(async () => locked)) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  await act(async () => { root.render(<MissionsScreen onLoad={onLoad} />); await Promise.resolve(); await Promise.resolve() })
  return { container, root, onLoad }
}

describe('MissionsScreen', () => {
  it('paginates canonical cards without duplicates, resets on rank/length changes, and leaves Profile unpaged', async () => {
    const projection: PlayerMissionsDto = { ...locked, ranks: { ...locked.ranks, B: Array.from({ length: 19 }, (_, i) => mission('B', i, 'ACTIVE')) } }
    const { container, root } = await mount(vi.fn(async () => projection))
    const keys = () => [...container.querySelectorAll<HTMLElement>('[data-mission-key]')].map(n => n.dataset.missionKey)
    const seen = [...keys()]
    const next = () => container.querySelector<HTMLButtonElement>('[aria-label="Missions suivantes"]')!
    expect(keys()).toHaveLength(6)
    expect(container.textContent).not.toContain('Suivez vos objectifs')
    while (!next().disabled) { act(() => next().click()); seen.push(...keys()) }
    expect(keys()).toHaveLength(1); expect(next().disabled).toBe(true)
    expect(seen).toHaveLength(19); expect(new Set(seen).size).toBe(19)
    expect(seen).toEqual(projection.ranks.B.map(m => m.externalKey))
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Missions précédentes"]')!.click())
    expect(container.querySelector('[data-mission-page]')?.getAttribute('data-mission-page')).toBe('3')
    act(() => [...container.querySelectorAll<HTMLButtonElement>('.missions-rank-tabs button')].find(n => n.textContent === 'A')!.click())
    expect(container.querySelector('[data-mission-page]')?.getAttribute('data-mission-page')).toBe('1')
    expect(keys()).toHaveLength(6)
    expect(next().disabled).toBe(false)
    act(() => root.render(<MissionProjectionView value={projection} />))
    expect(container.querySelectorAll('.mission-card')).toHaveLength(19)
    expect(container.querySelector('.mission-pages')).toBeNull()
    act(() => root.render(<MissionProjectionView paginated value={projection} />))
    act(() => next().click())
    act(() => root.render(<MissionProjectionView paginated value={{ ...projection, ranks: { ...projection.ranks, B: projection.ranks.B.slice(0, 4) } }} />))
    expect(keys()).toHaveLength(4); expect(container.querySelector('.mission-pagination')).toBeNull()
  })
  it('uses a bounded readable capacity for narrow and low viewports', () => {
    expect(missionPageGeometry(1000, 640)).toEqual({ columns: 3, rows: 2 })
    expect(missionPageGeometry(600, 400)).toEqual({ columns: 2, rows: 2 })
    expect(missionPageGeometry(320, 280)).toEqual({ columns: 1, rows: 1 })
  })
  it.each(['missions-ranks', 'missions-progress', 'missions-secret-z'] as const)('presents %s on B for locked and unlocked Z, restoring the normal rank afterward', async (stepId: TutorialStepId) => {
    for (const value of [locked, unlocked]) {
      const container = document.createElement('div'); document.body.append(container)
      const root = createRoot(container); roots.push(root)
      const onLoad = vi.fn(async () => value)
      const render = (active: boolean) => <TutorialPresentationContext.Provider value={{ active, step: active ? getTutorialStep(stepId) : null }}><MissionsScreen onLoad={onLoad} /></TutorialPresentationContext.Provider>
      await act(async () => root.render(render(false)))
      const z = container.querySelector<HTMLButtonElement>('[data-tutorial-anchor="missions-rank-z-tab"]')!
      act(() => z.click())
      expect(z.getAttribute('aria-pressed')).toBe('true')
      act(() => root.render(render(true)))
      expect(z.getAttribute('aria-pressed')).toBe('false')
      expect(container.querySelectorAll('[data-mission-rank="B"] .mission-card')).toHaveLength(6)
      expect(container.querySelector('[data-tutorial-anchor="missions-progress"] [data-mission-rank="B"]')).not.toBeNull()
      expect(container.querySelector('[data-mission-rank="Z"]')).toBeNull()
      expect(container.textContent).not.toContain('Description publique Z')
      expect(getTutorialStep('missions-secret-z')?.anchor).toBe('missions-rank-z-tab')
      act(() => root.render(render(false)))
      expect(z.getAttribute('aria-pressed')).toBe('true')
      expect(onLoad).toHaveBeenCalledOnce()
      expect(container.querySelector('[data-mission-rank="Z"]') !== null).toBe(value === unlocked)
    }
  })
  it('loads once on entry and exposes all nine authoritative cards across six-card pages', async () => {
    const { container, onLoad } = await mount()
    expect(onLoad).toHaveBeenCalledOnce()
    expect(container.querySelectorAll('[data-mission-rank="B"] .mission-card')).toHaveLength(6)
    expect(container.textContent).toMatch(/En cours.*Verrouillée/s)
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Missions suivantes"]')!.click())
    expect(container.querySelectorAll('[data-mission-rank="B"] .mission-card')).toHaveLength(3)
    expect(container.textContent).toContain('Mission B1')
    expect(container.textContent).toContain('9 007 199 254 740 993 / 9 007 199 254 740 993')
    expect(container.textContent).toContain('+1 600 Primogemmes')
    expect(container.textContent).toMatch(/Verrouillée.*Terminée/s)
    expect(container.querySelector('[data-mission-key] button')).toBeNull()
  })

  it('opens the first incomplete rank and keeps a manual selection for the mounted entry', async () => {
    const completedRank = (rank: 'B' | 'A' | 'S') => Array.from({ length: 9 }, (_, index) => mission(rank, index, 'COMPLETED'))
    const projection: PlayerMissionsDto = { ...locked, ranks: { B: completedRank('B'), A: nine('A'), S: nine('S') } }
    const { container, root, onLoad } = await mount(vi.fn(async () => projection))
    expect(container.querySelector('[data-mission-rank="A"]')).not.toBeNull()
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('.missions-rank-tabs button')).find(button => button.textContent === 'B')!.click() })
    expect(container.querySelector('[data-mission-rank="B"]')).not.toBeNull()
    await act(async () => { root.render(<MissionsScreen onLoad={onLoad} />); await Promise.resolve() })
    expect(container.querySelector('[data-mission-rank="B"]')).not.toBeNull()
    expect(onLoad).toHaveBeenCalledOnce()
  })

  it('switches B/A/S/Z locally without another GET and exposes the generic locked Z copy only', async () => {
    const { container, onLoad } = await mount()
    for (const rank of ['A', 'S', 'Z'] as const) {
      await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('.missions-rank-tabs button')).find((button) => button.textContent === rank)!.click() })
    }
    expect(onLoad).toHaveBeenCalledOnce()
    expect(container.textContent).toContain(lockedZMessage)
    expect(container.textContent).not.toContain('Mission Z1')
    for (const secret of ['Couronne des constellations', 'Amitié parfaite', 'Sommet de l’aventure', 'Maître du combat', '160000']) expect(container.textContent).not.toContain(secret)
    expect(container.querySelectorAll('[data-mission-key]')).toHaveLength(0)
  })

  it('shows the four Z missions after unlock', async () => {
    const { container } = await mount(vi.fn(async () => unlocked))
    await act(async () => { Array.from(container.querySelectorAll<HTMLButtonElement>('.missions-rank-tabs button')).find((button) => button.textContent === 'Z')!.click() })
    expect(container.querySelectorAll('[data-mission-rank="Z"] .mission-card')).toHaveLength(4)
    expect(container.textContent).toContain('Mission Z4')
    expect(container.textContent).not.toContain(lockedZMessage)
  })

  it('offers an explicit retry after a load error', async () => {
    const onLoad = vi.fn<() => Promise<PlayerMissionsDto>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(locked)
    const { container } = await mount(onLoad)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Missions indisponibles')
    await act(async () => { container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(onLoad).toHaveBeenCalledTimes(2)
    expect(container.querySelectorAll('[data-mission-rank="B"] .mission-card')).toHaveLength(6)
  })

  it('performs a fresh read on each screen entry', async () => {
    const onLoad = vi.fn(async () => locked)
    const first = await mount(onLoad)
    act(() => first.root.unmount())
    roots.splice(roots.indexOf(first.root), 1)
    await mount(onLoad)
    expect(onLoad).toHaveBeenCalledTimes(2)
  })

  it('rereads external progression while retaining the chosen rank', async () => {
    const { container, root, onLoad } = await mount()
    await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('.missions-rank-tabs button')).find(button => button.textContent === 'S')!.click())
    onLoad.mockResolvedValueOnce({ ...locked, ranks: { ...locked.ranks, S: locked.ranks.S.map(row => ({ ...row, progress: '8' })) } })
    await act(async () => root.render(<MissionsScreen onLoad={onLoad} refreshToken={1} />))
    expect(onLoad).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[data-mission-rank="S"]')).not.toBeNull()
    expect(container.textContent).toContain('8 / 10')
  })

  it('computes lossless, clamped progress percentages', () => {
    expect(progressPercent('5', '10')).toBe(50)
    expect(progressPercent('9007199254740993', '9007199254740994')).toBe(99.99)
    expect(progressPercent('20', '10')).toBe(100)
  })
})
