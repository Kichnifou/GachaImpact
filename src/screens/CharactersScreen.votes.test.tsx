// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BannerVoteDto, GachaCharacterDto } from '../api/types'
import CharactersScreen from './CharactersScreen'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ characters: [] })))) })
afterEach(() => { if (root) act(() => root.unmount()); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const characters: GachaCharacterDto[] = [5, 5, 4, 5].map((rarity, i) => ({ id: `c${i}`, externalKey: `c${i}`, name: `Personnage ${i}`, rarity: rarity as 4 | 5, elementKey: 'pyro', weaponType: null, region: null, classKey: null, iconPath: null, splashPath: null, wishPath: null, fullbodyPath: null }))
const snapshot: BannerVoteDto = { bannerRotationId: 'rotation', startsAt: '2026-09-13T22:00:00Z', endsAt: '2026-09-20T22:00:00Z', canVote: true, ownVote: null, catalogVersion: 'v1', candidates: [{ characterId: 'c0', voteCount: 3 }, { characterId: 'c1', voteCount: 0 }] }
async function mount(onLoadVotes = vi.fn(async () => snapshot), onVote = vi.fn(async (): Promise<BannerVoteDto> => ({ ...snapshot, canVote: false, ownVote: { characterId: 'c0', votedAt: '2026-09-19T12:00:00Z' }, candidates: [{ characterId: 'c0', voteCount: 4 }, { characterId: 'c1', voteCount: 0 }] }))) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  const onReloadCatalog = vi.fn(async () => {})
  await act(async () => root.render(<CharactersScreen characters={characters} onLoadVotes={onLoadVotes} onVote={onVote} onReloadCatalog={onReloadCatalog} />))
  return { container, onLoadVotes, onVote, onReloadCatalog }
}
describe('Catalogue community votes', () => {
  it('sorts eligible candidates by descending votes, reverses counts and keeps ineligible characters last', async () => {
    const { container } = await mount()
    const select = container.querySelector('select')!
    act(() => { select.value = 'votes'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    const names = () => Array.from(container.querySelectorAll('.character-card h3'), e => e.textContent)
    expect(names()).toEqual(['Personnage 0', 'Personnage 1', 'Personnage 2', 'Personnage 3'])
    act(() => (container.querySelector('.sort-direction-button') as HTMLButtonElement).click())
    expect(names()).toEqual(['Personnage 1', 'Personnage 0', 'Personnage 2', 'Personnage 3'])
    act(() => Array.from(container.querySelectorAll('button')).find(b => b.textContent === '5★')!.click())
    expect(names()).toEqual(['Personnage 1', 'Personnage 0', 'Personnage 3'])
    expect(container.textContent).toContain('0 vote')
  })
  it('does not overlap slow reads on repeated focus and preserves filters', async () => {
    vi.useFakeTimers()
    let release!: (value: BannerVoteDto) => void
    const load = vi.fn(() => new Promise<BannerVoteDto>(resolve => { release = resolve }))
    const { container } = await mount(load)
    await act(async () => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(9000) })
    expect(load).toHaveBeenCalledTimes(1)
    await act(async () => release(snapshot))
    act(() => Array.from(container.querySelectorAll('button')).find(b => b.textContent === '4★')!.click())
    expect(container.querySelectorAll('.character-card')).toHaveLength(1)
    expect(container.querySelectorAll('.catalog-character-vote')).toHaveLength(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(load).toHaveBeenCalledTimes(2)
    await act(async () => release(snapshot))
    expect(container.querySelectorAll('.character-card')).toHaveLength(1)
  })
  it('shows only eligible counters/actions and immediately replaces all CTAs after voting', async () => {
    const { container, onVote } = await mount()
    expect(container.querySelectorAll('.catalog-character-vote')).toHaveLength(2)
    expect(container.querySelectorAll('.catalog-character-vote button')).toHaveLength(2)
    expect(container.querySelector('.catalog-character-vote button')?.getAttribute('aria-label')).toContain('définitif')
    expect(container.textContent).not.toContain('Bannière suivante')
    await act(async () => (container.querySelector('.catalog-character-vote button') as HTMLButtonElement).click())
    expect(onVote).toHaveBeenCalledWith('c0', 'rotation')
    expect(container.querySelectorAll('.catalog-character-vote button')).toHaveLength(0)
    expect(container.textContent).toContain('4 votes')
    expect(container.textContent).toContain('Voté')
    expect(container.querySelectorAll('.character-card')).toHaveLength(4)
  })
  it('polls only while visible, reloads catalog only on version change, cleans up', async () => {
    vi.useFakeTimers()
    const mounted = await mount()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(mounted.onLoadVotes).toHaveBeenCalledTimes(2)
    expect(mounted.onReloadCatalog).toHaveBeenCalledTimes(1)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(9000) })
    expect(mounted.onLoadVotes).toHaveBeenCalledTimes(2)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    mounted.onLoadVotes.mockResolvedValue({ ...snapshot, catalogVersion: 'v2' })
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(mounted.onReloadCatalog).toHaveBeenCalledTimes(2)
    act(() => root.unmount())
    await act(async () => { await vi.advanceTimersByTimeAsync(9000) })
    expect(mounted.onLoadVotes).toHaveBeenCalledTimes(3)
  })
});
