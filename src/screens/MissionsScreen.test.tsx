// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PermanentMissionDto, PermanentMissionRankDto, PlayerMissionsDto } from '../api/types'
import { lockedZMessage, progressPercent } from '../missions/mission-presentation'
import MissionsScreen from './MissionsScreen'

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
  it('loads once on entry and opens rank B with its nine authoritative cards', async () => {
    const { container, onLoad } = await mount()
    expect(onLoad).toHaveBeenCalledOnce()
    expect(container.querySelector('[data-mission-rank="B"]')?.children).toHaveLength(9)
    expect(container.textContent).toContain('Mission B1')
    expect(container.textContent).toContain('9 007 199 254 740 993 / 9 007 199 254 740 993')
    expect(container.textContent).toContain('+1 600 Primogemmes')
    expect(container.textContent).toMatch(/Terminée.*En cours.*Verrouillée/s)
    expect(container.querySelector('[data-mission-key] button')).toBeNull()
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
    expect(container.querySelector('[data-mission-rank="Z"]')?.children).toHaveLength(4)
    expect(container.textContent).toContain('Mission Z4')
    expect(container.textContent).not.toContain(lockedZMessage)
  })

  it('offers an explicit retry after a load error', async () => {
    const onLoad = vi.fn<() => Promise<PlayerMissionsDto>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(locked)
    const { container } = await mount(onLoad)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Missions indisponibles')
    await act(async () => { container.querySelector<HTMLButtonElement>('[role="alert"] button')!.click(); await Promise.resolve(); await Promise.resolve() })
    expect(onLoad).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[data-mission-rank="B"]')?.children).toHaveLength(9)
  })

  it('performs a fresh read on each screen entry', async () => {
    const onLoad = vi.fn(async () => locked)
    const first = await mount(onLoad)
    act(() => first.root.unmount())
    roots.splice(roots.indexOf(first.root), 1)
    await mount(onLoad)
    expect(onLoad).toHaveBeenCalledTimes(2)
  })

  it('computes lossless, clamped progress percentages', () => {
    expect(progressPercent('5', '10')).toBe(50)
    expect(progressPercent('9007199254740993', '9007199254740994')).toBe(99.99)
    expect(progressPercent('20', '10')).toBe(100)
  })
})
