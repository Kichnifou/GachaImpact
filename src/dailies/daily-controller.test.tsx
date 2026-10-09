// @vitest-environment happy-dom
import { act, useEffect, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { projectDailies, dailyIds, type DailyItem } from './daily-summary'
import { useDailyTracker, dailyMaskKey, readDailyMasks } from './use-daily-tracker'
import { useDailyClaim } from './use-daily-claim'
import { dailySources, day } from './daily-test-fixtures'
import DailyTrackerCard from './DailyTrackerCard'
import HomeDailySummary from './HomeDailySummary'
import DailyRewardCard from '../components/DailyRewardCard'
import HomeScreen from '../screens/HomeScreen'
import { createDailyReadCoordinator } from './daily-read-coordinator'
import { nextParisMidnight, parisBusinessDate } from './daily-clock'
import { useDailyRevalidation } from './use-daily-revalidation'
import type { DailyRewardClaimDto } from '../api/types'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root, container: HTMLDivElement
const opening = vi.fn(), overview = vi.fn()
const reward = dailySources().reward!
const claimed: DailyRewardClaimDto = { ...reward, alreadyClaimed: false }
type HarnessProps = { items?: readonly DailyItem[]; player?: string; date?: string; claim?: () => Promise<DailyRewardClaimDto>; refreshing?: boolean }
let control: ReturnType<typeof useDailyTracker>, claimControl: ReturnType<typeof useDailyClaim>
function Harness({ items = projectDailies(dailySources()), player = 'player-A', date = day, claim = async () => claimed, refreshing = false }: HarnessProps) {
  const tracker = useDailyTracker(items, player, date, 'test'), controller = useDailyClaim(claim, player)
  useEffect(() => { control = tracker; claimControl = controller })
  const props = { items, tracker, claim: controller, onOpen: opening, onOverview: overview, refreshing }
  return <><DailyTrackerCard {...props} /><HomeDailySummary {...props} /><DailyRewardCard variant="overview" today={reward} elementKey="electro" onClaim={controller.run} controller={controller} summary={items.find(item => item.id === 'reward')} /></>
}
beforeEach(() => { localStorage.clear(); opening.mockClear(); overview.mockClear(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); vi.useFakeTimers() })
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks() })
const render = async (props: HarnessProps = {}) => act(async () => { root.render(<Harness {...props} />) })
const click = async (selector: string) => act(async () => { container.querySelector<HTMLButtonElement>(selector)!.click() })

describe('daily navigation titles A/B', () => {
  const six = () => projectDailies(dailySources()).filter(item => ['reward', 'wheel', 'challenge', 'combat', 'boss', 'event'].includes(item.id))
  const sidebarTitle = () => container.querySelector('.daily-tracker h2')?.textContent
  const homeTitle = () => container.querySelector('.home-daily-summary h2')?.textContent
  it('tracks selection, mask totals and LIFO restoration without permanent second lines', async () => {
    await render({ items: six() }); expect(sidebarTitle()).toBe('Quotidiennes [1/6]'); expect(homeTitle()).toBe('Quotidiennes')
    expect(container.querySelector('.daily-tracker-heading small')).toBeNull(); expect(container.querySelector('.home-daily-summary header p')).toBeNull()
    await click('[aria-label="Activité suivante"]'); expect(sidebarTitle()).toBe('Quotidiennes [2/6]')
    await click('.daily-tracker-hide'); expect(sidebarTitle()).toBe('Quotidiennes [1/5]'); expect(homeTitle()).toBe('Quotidiennes')
    await click('.daily-tracker-restore button'); expect(sidebarTitle()).toBe('Quotidiennes [2/6]'); expect(homeTitle()).toBe('Quotidiennes')
  })
  it.each([0, 1, 2, 3, 6])('keeps a simple Home title for %s suggestions with ongoing', async count => {
    const items: DailyItem[] = six().map((item, index) => ({ ...item, actionable: index < count, state: index < count ? 'available' as const : 'completed' as const }))
    items.push({ ...projectDailies(dailySources()).find(item => item.id === 'expedition')!, actionable: false, state: 'in_progress' })
    await render({ items })
    expect(homeTitle()).toBe('Quotidiennes')
    expect(container.querySelectorAll('.home-daily-suggestion')).toHaveLength(Math.min(3, count))
  })
  it('has no zero ratio when suggestions are empty', async () => {
    await render({ items: [] }); expect(sidebarTitle()).toBe('Quotidiennes'); expect(homeTitle()).toBe('Quotidiennes'); expect(container.textContent).not.toContain('[0/0]')
  })
  it('freezes Home cards during pending and success feedback with a constant title', async () => {
    let resolve!: (value: DailyRewardClaimDto) => void
    const items = six(), claim = () => new Promise<DailyRewardClaimDto>(done => { resolve = done })
    const cards = () => Array.from(container.querySelectorAll('.home-daily-suggestion')).map(card => card.getAttribute('data-daily-id'))
    await render({ items, claim }); await click('.home-daily-suggestion[data-daily-id="reward"]')
    const after = items.map(item => item.id === 'reward' ? { ...item, actionable: false, state: 'completed' as const } : item)
    await render({ items: after, claim }); expect(homeTitle()).toBe('Quotidiennes')
    expect(cards()).toEqual(['reward', 'wheel', 'challenge'])
    await act(async () => resolve(claimed)); expect(homeTitle()).toBe('Quotidiennes')
    expect(cards()).toEqual(['reward', 'wheel', 'challenge'])
    await act(async () => vi.advanceTimersByTime(901)); expect(homeTitle()).toBe('Quotidiennes')
    expect(cards()).toEqual(['wheel', 'challenge', 'combat'])
  })
})

describe('tracker card hit target and compact Home footer', () => {
  it('opens the selected destination through one accessible sibling button without visible action text', async () => {
    await render(); await click('[aria-label="Activité suivante"]')
    const target = container.querySelector<HTMLButtonElement>('.daily-tracker-hit-target')!
    expect(target.getAttribute('aria-label')).toBe('Accéder à Roue'); expect(target.disabled).toBe(false)
    expect(target.textContent).toBe(''); expect(container.querySelector('.daily-tracker-primary')).toBeNull()
    expect(container.querySelectorAll('button button')).toHaveLength(0)
    target.focus(); expect(document.activeElement).toBe(target)
    await click('.daily-tracker-hit-target'); expect(opening).toHaveBeenCalledWith(expect.objectContaining({ id: 'wheel' }))
  })
  it('keeps mask, restore, previous, next and Overview independent of the card action', async () => {
    const claim = vi.fn(async () => claimed); await render({ claim })
    await click('.daily-tracker-hide'); expect(control.hidden).toEqual(['reward'])
    await click('.daily-tracker-restore button'); expect(control.hidden).toEqual([])
    await click('[aria-label="Activité suivante"]'); expect(control.selected?.id).toBe('wheel')
    await click('[aria-label="Activité précédente"]'); expect(control.selected?.id).toBe('reward')
    await click('.daily-tracker-navigation .daily-tracker-all'); expect(overview).toHaveBeenCalledOnce()
    expect(opening).not.toHaveBeenCalled(); expect(claim).not.toHaveBeenCalled()
  })
  it.each(['unknown', 'error', 'no-destination'] as const)('does not activate the card in %s state', async state => {
    const item = projectDailies(dailySources()).find(item => item.id === 'wheel')!
    const claim = vi.fn(async () => claimed)
    await render({ items: [{ ...item, ...(state === 'no-destination' ? { destination: undefined } : { state }) }], claim })
    expect(container.querySelector<HTMLButtonElement>('.daily-tracker-hit-target')!.disabled).toBe(true)
    await click('.daily-tracker-hit-target'); expect(opening).not.toHaveBeenCalled(); expect(claim).not.toHaveBeenCalled()
  })
  it('omits an empty Home footer and exposes only useful feedback or restore controls', async () => {
    await render(); expect(container.querySelector('.home-daily-summary footer')).toBeNull()
    await click('.daily-tracker-hide'); expect(container.querySelector('.home-daily-summary footer p')).toBeNull()
    await click('.home-daily-summary footer button'); expect(control.hidden).toEqual([])
    expect(container.querySelector('.home-daily-summary footer')).toBeNull()
    const rewardOnly = [projectDailies(dailySources()).find(item => item.id === 'reward')!]
    await render({ items: rewardOnly }); await click('.daily-tracker-hit-target'); expect(container.querySelector('.home-daily-summary footer [role="status"]')?.textContent).toBe('Récompense récupérée.')
    await act(async () => vi.advanceTimersByTime(901)); expect(container.querySelector('.home-daily-summary footer')).toBeNull()
    await render({ items: rewardOnly, claim: async () => { throw Error('offline') } }); await click('.daily-tracker-hit-target')
    expect(container.querySelector('.home-daily-summary footer .error')?.textContent).toBeTruthy()
  })
})

describe('Shared daily consultation and claim', () => {
  it('retains completion and its Paris countdown across F5 with known nonapplicable owners', async () => {
    vi.setSystemTime(new Date('2026-10-02T21:30:00Z'))
    const source = dailySources()
    const projected = projectDailies({ ...source, favor: { ...source.favor!, active: false, claimStatus: 'UNAVAILABLE' }, friendship: { ...source.friendship!, activeFriends: 0, available: 0, alreadySent: 0 } })
    const items = projected.map(row => row.id === 'favor' || row.id === 'friendship' ? row : { ...row, state: 'completed' as const, actionable: false })
    await render({ items })
    expect(control.message).toBe('Terminé ✅')
    expect(container.querySelector('.daily-tracker-status')?.textContent).toBe('Réinitialisation dans 30 min')
    await act(async () => root.unmount()); root = createRoot(container)
    await render({ items })
    expect(control.message).toBe('Terminé ✅')
    expect(container.querySelector('.daily-tracker-status')?.textContent).toBe('Réinitialisation dans 30 min')
  })
  it('shows the Paris reset instead of a completed Expedition deadline and waits for the next server date', async () => {
    vi.setSystemTime(new Date('2026-10-03T21:33:00Z'))
    const items = projectDailies(dailySources()).map(item => ({ ...item, state: 'completed' as const, actionable: false, deadline: item.id === 'expedition' ? '2026-10-04T10:33:00Z' : undefined }))
    await render({ items, date: '2026-10-03' })
    const status = () => container.querySelector('.daily-tracker-status')?.textContent
    expect(status()).toBe('Réinitialisation dans 27 min')
    expect(container.querySelector('.daily-tracker')?.textContent).not.toContain('Prochaine échéance')
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(status()).toBe('Réinitialisation dans 26 min')
    await act(async () => { await vi.advanceTimersByTimeAsync(26 * 60_000) })
    expect(status()).toBe('Réinitialisation dans 0 min')
    expect(control.message).toBe('Terminé ✅')
    await render({ items, date: '2026-10-04' })
    expect(status()).toBe('Réinitialisation dans 24 h 0 min')
    await render({ items: items.map(item => item.id === 'expedition' ? { ...item, state: 'in_progress', detail: 'Skirk · 12:33:00', deadline: '2026-10-04T10:33:00Z' } : item), date: '2026-10-04' })
    expect(status()).toBe('Skirk · 12:33:00')
  })
  it('retains a pertinent selection across rereads, rotates manually and ignores hidden items', async () => {
    await render()
    expect(control.selected?.id).toBe('reward')
    await click('[aria-label="Activité suivante"]')
    expect(control.selected?.id).toBe('wheel')
    await render({ items: projectDailies({ ...dailySources(), reward: { ...reward, claimed: true } }) })
    expect(control.selected?.id).toBe('wheel')
    await click('.daily-tracker-hide')
    expect(control.hidden).toEqual(['wheel'])
    expect(control.selected?.id).toBe('challenge')
    expect(readDailyMasks(dailyMaskKey('test', 'player-A', day))).toEqual(['wheel'])
    expect(localStorage.getItem(dailyMaskKey('test', 'player-A', day))).toBe('["wheel"]')
    expect(container.querySelectorAll('.home-daily-suggestion')).toHaveLength(3)
    expect(container.querySelector('.home-daily-suggestion[data-daily-id="wheel"]')).toBeNull()
  })
  it('restores preferences after remount, isolates environment/player, expires on confirmed day and can restore all', async () => {
    localStorage.setItem(dailyMaskKey('test', 'player-A', day), '["reward","wheel","secret","arcade"]')
    await render(); expect(control.hidden).toEqual(['reward', 'wheel']); expect(control.selected?.id).toBe('challenge')
    await render({ player: 'player-B' }); expect(control.hidden).toEqual([])
    await render({ player: 'player-A' }); expect(control.hidden).toEqual(['reward', 'wheel'])
    await render({ date: '2026-10-03' }); expect(control.hidden).toEqual([])
    await render(); await act(async () => control.restoreAll()); expect(control.hidden).toEqual([])
    expect(readDailyMasks(dailyMaskKey('other-env', 'player-A', day))).toEqual([])
  })
  it('continues in memory when localStorage is blocked and does not hide before a server date', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    await render(); await act(async () => control.hide('reward')); expect(control.hidden).toEqual(['reward'])
    await render({ date: '' }); await act(async () => control.hide('wheel')); expect(control.hidden).toEqual([])
  })
  it('retains the initially selected activity as a missing source is filled, without resetting to the new highest priority', async () => {
    await render({ items: projectDailies({ ...dailySources(), reward: null }) })
    expect(control.selected?.id).toBe('wheel')
    await render(); expect(control.selected?.id).toBe('wheel')
  })
  it('does not send a queued claim after its owning surface has unmounted', async () => {
    const claim = vi.fn(async () => claimed)
    await render({ claim })
    let request!: Promise<DailyRewardClaimDto>
    act(() => { request = claimControl.run(); root.render(null) })
    await expect(request).rejects.toThrow('Session remplacée.')
    expect(claim).not.toHaveBeenCalled()
  })
  it('releases yesterday local claim feedback when the server confirms a new unclaimed day in Overview', async () => {
    const claim = vi.fn(async () => claimed)
    await act(async () => root.render(<DailyRewardCard variant="overview" today={reward} elementKey="electro" onClaim={claim} />))
    await click('.daily-reward-overview-card button')
    expect(container.textContent).toContain('✅ Terminé')
    await act(async () => root.render(<DailyRewardCard variant="overview" today={{ ...reward, businessDate: '2026-10-03' }} elementKey="electro" onClaim={claim} />))
    expect(container.textContent).not.toContain('✅ Terminé')
    expect(container.querySelector<HTMLButtonElement>('.daily-reward-overview-card button')!.disabled).toBe(false)
  })
  it('freezes the same activity and shares one in-flight claim across all three entries, then advances after reserved feedback', async () => {
    let resolve!: (value: DailyRewardClaimDto) => void
    const claim = vi.fn(() => new Promise<DailyRewardClaimDto>(done => { resolve = done }))
    await render({ claim })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.daily-tracker-hit-target')!.click()
      container.querySelector<HTMLButtonElement>('.home-daily-suggestion[data-daily-id="reward"]')!.click()
      container.querySelector<HTMLButtonElement>('.daily-reward-overview-card button')!.click()
    })
    expect(claim).toHaveBeenCalledOnce(); expect(claimControl.pending).toBe(true)
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Activité suivante"]')!.disabled).toBe(true)
    const after = projectDailies({ ...dailySources(), reward: { ...reward, claimed: true } })
    await render({ claim, items: after })
    expect(container.querySelector('.daily-tracker h3')?.textContent).toBe('Récompense quotidienne')
    const homeCards = () => Array.from(container.querySelectorAll('.home-daily-suggestion')).map(card => card.getAttribute('data-daily-id'))
    expect(homeCards()).toEqual(['reward', 'wheel', 'challenge'])
    await act(async () => resolve(claimed))
    expect(container.querySelector('.daily-tracker-status')?.textContent).toBe('Récompense récupérée.')
    expect(homeCards()).toEqual(['reward', 'wheel', 'challenge'])
    await act(async () => { await claimControl.run() }); expect(claim).toHaveBeenCalledOnce()
    await act(async () => vi.advanceTimersByTime(901))
    expect(container.querySelector('.daily-tracker h3')?.textContent).toBe('Roue')
    expect(homeCards()).toEqual(['wheel', 'challenge', 'combat'])
    expect(opening).not.toHaveBeenCalled()
  })
  it('keeps a failed claim on the same activity, exposes the error, and never fabricates completion', async () => {
    await render({ claim: async () => { throw new Error('Réseau indisponible') } })
    await click('.daily-tracker-hit-target')
    expect(control.selected?.id).toBe('reward'); expect(claimControl.pending).toBe(false)
    expect(container.querySelector('.daily-tracker-status')?.textContent).toBe('Une erreur inattendue est survenue.')
    expect(container.querySelectorAll('.daily-tracker-status')).toHaveLength(1)
  })
  it('keeps completion, waiting, hidden and unknown empty states honest, with explicit Overview access', async () => {
    const items = projectDailies(dailySources()).map(item => ({ ...item, state: 'completed' as const, actionable: false }))
    await render({ items }); expect(control.message).toBe('Terminé ✅')
    expect(container.querySelector('.daily-tracker-content h3')?.textContent).toBe('Terminé ✅')
    expect(container.querySelector('.daily-tracker-content h3')?.classList.contains('daily-tracker-summary')).toBe(true)
    await click('.daily-tracker-all'); expect(overview).toHaveBeenCalledOnce()
    await render({ items: items.map(item => item.id === 'expedition' ? { ...item, state: 'in_progress', deadline: '2026-10-02T12:00:00Z' } : item) })
    expect(control.message).toBe('Rien à faire pour le moment')
    for (const id of dailyIds) await act(async () => control.hide(id))
    expect(control.message).toBe('Aucune activité affichée')
    expect(container.querySelector('.daily-tracker-restore button')).not.toBeNull()
    await act(async () => control.restoreAll()); await render({ items: projectDailies({}) })
    expect(control.message).toBe('État du jour incomplet')
  })
  it.each([0, 1, 3])('limits Home to %s suggestions with a compact banner and no redundant shortcuts', async count => {
    const items = projectDailies(dailySources()).map((item, index) => ({ ...item, state: index < count ? 'available' as const : 'completed' as const, actionable: index < count }))
    function HomeHarness() {
      const tracker = useDailyTracker(items, 'home', day, 'test'), claim = useDailyClaim(async () => claimed, 'home')
      const gacha: ComponentProps<typeof HomeScreen>['gacha'] = { banner: { id: 'banner', startsAt: '', endsAt: '', featuredFiveStars: [], featuredFourStars: [] }, playerState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' } }
      return <HomeScreen gacha={gacha} onSetGachaTarget={vi.fn()} onNavigate={opening} dailySummary={<HomeDailySummary items={items} tracker={tracker} claim={claim} onOpen={opening} onOverview={overview} />} />
    }
    await act(async () => root.render(<HomeHarness />))
    expect(container.querySelectorAll('.home-daily-suggestion')).toHaveLength(count)
    expect(container.querySelector('.home-shortcuts')).toBeNull()
    expect(container.querySelectorAll('.shortcut-card')).toHaveLength(0)
    expect(container.querySelector('.home-banner-preview')).not.toBeNull()
    await click('.home-banner-hit-area')
    expect(opening).toHaveBeenCalledWith('invocation')
    expect(container.querySelector('[data-daily-id="arcade"]')).toBeNull()
  })
})

describe('Home daily actions and ongoing information', () => {
  const homeItems = (actions: readonly string[], ongoing: Partial<Record<DailyItem['id'], 'waiting' | 'in_progress'>> = {}) => projectDailies(dailySources()).map(item => ({
    ...item, state: ongoing[item.id] ?? (actions.includes(item.id) ? 'available' : item.id === 'expedition' ? 'unavailable' : 'completed'), actionable: actions.includes(item.id),
  } as DailyItem))
  const home = () => container.querySelector('.home-daily-summary')!
  const cards = () => Array.from(home().querySelectorAll('.home-daily-suggestion')).map(card => card.getAttribute('data-daily-id'))
  const ongoing = () => Array.from(home().querySelectorAll('.home-daily-ongoing [data-daily-id]')).map(row => row.getAttribute('data-daily-id'))
  it.each([0, 1, 2])('keeps RUNNING Expedition out of %s action cards and shows it once in En cours', async count => {
    await render({ items: homeItems(['reward', 'wheel'].slice(0, count), { expedition: 'in_progress' }) })
    expect(cards()).toHaveLength(count); expect(cards()).not.toContain('expedition')
    expect(ongoing()).toEqual(['expedition'])
    expect(home().textContent?.match(/Expédition/g)).toHaveLength(1)
    if (!count) expect(home().textContent).toContain('Rien à faire pour le moment')
  })
  it('applies the shared Expedition mask to both compact Home areas and retains restoration', async () => {
    await render({ items: homeItems(['reward'], { expedition: 'in_progress' }) })
    await act(async () => control.hide('expedition'))
    expect(cards()).toEqual(['reward']); expect(ongoing()).toEqual([])
    expect(home().textContent).not.toContain('Expédition')
    expect(home().querySelector('footer button')?.textContent).toContain('Réafficher')
    await act(async () => control.restoreAll()); expect(ongoing()).toEqual(['expedition'])
  })
  it('retains exactly three real actions while RUNNING Expedition appears only in En cours', async () => {
    await render({ items: homeItems(['reward', 'wheel', 'challenge', 'combat'], { expedition: 'in_progress' }) })
    expect(cards()).toEqual(['reward', 'wheel', 'challenge']); expect(ongoing()).toEqual(['expedition'])
  })
  it('shows WAITING Event only in En cours, and keeps unknown/error out of action cards', async () => {
    const items = homeItems([], { event: 'waiting' }).map(item => item.id === 'reward' ? { ...item, state: 'unknown' as const } : item.id === 'wheel' ? { ...item, state: 'error' as const } : item)
    await render({ items })
    expect(cards()).toEqual([]); expect(ongoing()).toEqual(['event'])
    expect(home().textContent).toContain('État du jour incomplet')
  })
  it('prioritizes READY Expedition as an action after reward, without an ongoing duplicate', async () => {
    const items = homeItems(['reward', 'wheel', 'challenge', 'expedition']).map(item => item.id === 'expedition' ? { ...item, status: 'À récupérer' } : item)
    await render({ items })
    expect(cards()).toEqual(['reward', 'expedition', 'wheel']); expect(ongoing()).toEqual([])
  })
  it('retains the existing empty state when there is no action or ongoing activity', async () => {
    await render({ items: homeItems([]) })
    expect(cards()).toEqual([]); expect(ongoing()).toEqual([])
    expect(home().querySelector('.home-daily-empty')?.textContent).toBe('Aucune activité disponible pour le moment. L’Aperçu reste disponible pour consulter les détails.')
  })
  it('limits ongoing information to two unmasked activities and keeps an actionable progress item in actions only', async () => {
    const items = homeItems(['challenge'], { favor: 'waiting', challenge: 'in_progress', expedition: 'in_progress', event: 'waiting' })
    await render({ items })
    expect(cards()).toEqual(['challenge']); expect(ongoing()).toEqual(['expedition', 'favor'])
    await act(async () => control.hide('favor')); expect(ongoing()).toEqual(['expedition', 'event'])
    for (const id of ['expedition', 'event', 'challenge'] as const) await act(async () => control.hide(id))
    expect(cards()).toEqual([]); expect(ongoing()).toEqual([])
    expect(home().textContent).toContain('Aucune activité affichée')
  })
})

describe('Compact daily presentation', () => {
  it('keeps revalidation silent and suppresses sidebar details without losing Home details', async () => {
    const items = projectDailies(dailySources()).map(item => item.id === 'reward' ? { ...item, detail: 'Objectif révélé après achat.' } : item)
    await render({ items, refreshing: true })
    const tracker = container.querySelector('.daily-tracker')!, home = container.querySelector('.home-daily-summary')!
    expect(tracker.getAttribute('aria-busy')).toBe('true'); expect(home.getAttribute('aria-busy')).toBe('true')
    expect(tracker.textContent).not.toContain('Actualisation…'); expect(home.textContent).not.toContain('Actualisation…')
    expect(tracker.textContent).not.toContain('Objectif révélé après achat.')
    expect(home.textContent).toContain('Objectif révélé après achat.')
    expect(tracker.querySelector('.daily-tracker-feedback')).toBeNull()
    expect(tracker.querySelector('.daily-tracker-status')).toBeNull()
  })
  it('undoes masks in persisted LIFO order after reload and focuses the restored title', async () => {
    await render()
    for (const id of ['combat', 'wheel', 'challenge'] as const) await act(async () => control.hide(id))
    expect(readDailyMasks(dailyMaskKey('test', 'player-A', day))).toEqual(['combat', 'wheel', 'challenge'])
    await act(async () => root.render(null)); await render()
    for (const [id, title, remaining] of [['challenge', 'Défi', ['combat', 'wheel']], ['wheel', 'Roue', ['combat']], ['combat', 'Combat', []]] as const) {
      expect(container.querySelector('.daily-tracker-restore button')?.getAttribute('aria-label')).toBe(`Réafficher ${title}`)
      await click('.daily-tracker-restore button')
      expect(control.selected?.id).toBe(id); expect(control.hidden).toEqual(remaining)
      expect(readDailyMasks(dailyMaskKey('test', 'player-A', day))).toEqual(remaining)
      expect(document.activeElement).toBe(container.querySelector('.daily-tracker h3'))
    }
    expect(container.querySelector<HTMLButtonElement>('.daily-tracker-restore button')!.disabled).toBe(true)
  })
  it('restores every mask through the plural Home action and filters invalid stored IDs without sorting', async () => {
    localStorage.setItem(dailyMaskKey('test', 'player-A', day), '["wheel","bad",null,"challenge","wheel"]')
    await render(); expect(control.hidden).toEqual(['wheel', 'challenge'])
    await click('.home-daily-summary footer button'); expect(control.hidden).toEqual([])
    expect(container.querySelector('.home-daily-suggestion[data-daily-id="wheel"]')).not.toBeNull()
    expect(container.querySelector('.home-daily-suggestion[data-daily-id="challenge"]')).not.toBeNull()
  })
  it('presents the real RUNNING expedition in one compact status on both surfaces', async () => {
    const items = projectDailies(dailySources()).map(item => ({ ...item, state: item.id === 'expedition' ? 'in_progress' : 'completed', actionable: false, status: item.id === 'expedition' ? 'En cours' : item.status, detail: item.id === 'expedition' ? 'Skirk · 14:29:56' : undefined } as DailyItem))
    await render({ items })
    expect(container.querySelector('.daily-tracker-status')?.textContent).toBe('Skirk · 14:29:56')
    expect(container.querySelector('.home-daily-ongoing li')?.textContent).toBe('Expédition · Skirk · 14:29:56')
    expect(container.querySelector('.daily-tracker')?.textContent).not.toContain('En cours')
    expect(container.querySelectorAll('.daily-tracker-status')).toHaveLength(1)
  })
  it('replaces status with pending, success or error without a separate feedback row', async () => {
    let resolve!: (value: DailyRewardClaimDto) => void
    await render({ claim: () => new Promise(done => { resolve = done }) })
    await click('.daily-tracker-hit-target')
    expect(container.querySelector('.daily-tracker-status')?.textContent).toBe('Récupération…')
    await act(async () => resolve(claimed))
    expect(container.querySelector('.daily-tracker-status')?.textContent).toBe('Récompense récupérée.')
    expect(container.querySelectorAll('.daily-tracker-status')).toHaveLength(1)
    expect(container.querySelector('.daily-tracker-feedback')).toBeNull()
  })
  it('removes the icon, generic status and fallback, with a reserved restore control in the header', async () => {
    const items = projectDailies(dailySources()).map(item => ({ ...item, detail: undefined }))
    await render({ items })
    const tracker = container.querySelector('.daily-tracker')!
    expect(tracker.querySelector('.daily-tracker-icon')).toBeNull()
    expect(tracker.querySelector('.daily-tracker-status')).toBeNull()
    expect(tracker.querySelector('.daily-tracker-detail')).toBeNull()
    expect(tracker.textContent).not.toContain('Consultez le détail de cette activité')
    const restore = tracker.querySelector<HTMLButtonElement>('header .daily-tracker-restore button')!
    expect(restore).not.toBeNull(); expect(restore.disabled).toBe(true)
    await click('.daily-tracker-hide')
    expect(tracker.querySelector('header .daily-tracker-restore button')).toBe(restore)
    expect(restore.disabled).toBe(false)
    await act(async () => restore.click())
    expect(control.hidden).toEqual([])
    expect(tracker.querySelector('footer .daily-tracker-restore')).toBeNull()
  })
  it('makes the whole Home card the only control and keeps overview as a micro action', async () => {
    await render()
    const home = container.querySelector('.home-daily-summary')!
    expect(home.querySelector('h2')?.textContent).toBe('Quotidiennes')
    expect(home.querySelector('.home-daily-actions > h3')).toBeNull()
    expect(home.querySelector('.home-daily-ongoing > h3')).toBeNull()
    const wheel = home.querySelector<HTMLButtonElement>('[data-daily-id="wheel"]')!
    expect(wheel.tagName).toBe('BUTTON'); expect(wheel.querySelector('button,a')).toBeNull()
    expect(wheel.querySelector('.home-daily-action-label')?.textContent).toBe('Accéder →')
    await act(async () => wheel.click())
    expect(opening).toHaveBeenCalledWith(expect.objectContaining({ id: 'wheel' }))
    const link = home.querySelector<HTMLButtonElement>('.home-daily-overview')!
    expect(link.classList.contains('app-button')).toBe(false)
    await act(async () => link.click()); expect(overview).toHaveBeenCalledOnce()
  })
  it('claims through the Home card, marks it busy and disables every duplicate entry', async () => {
    const claim = vi.fn(() => new Promise<DailyRewardClaimDto>(() => undefined))
    await render({ claim })
    const card = container.querySelector<HTMLButtonElement>('.home-daily-suggestion[data-daily-id="reward"]')!
    expect(card.querySelector('.home-daily-action-label')?.textContent).toBe('Récupérer →')
    await act(async () => card.click())
    expect(card.disabled).toBe(true); expect(card.getAttribute('aria-busy')).toBe('true')
    await click('.daily-tracker-hit-target'); await click('.daily-reward-overview-card button')
    expect(claim).toHaveBeenCalledOnce(); expect(opening).not.toHaveBeenCalled()
  })
  it.each(['in_progress', 'waiting', 'completed', 'unknown', 'error'] as const)('presents Expedition %s honestly, without inventing a character', async state => {
    const items = projectDailies(dailySources()).map(item => ({ ...item, state: item.id === 'expedition' ? state : 'completed', actionable: false, detail: item.id === 'expedition' ? 'Skirk · 16:22:19' : undefined } as DailyItem))
    await render({ items })
    const home = container.querySelector('.home-daily-summary')!
    const line = home.querySelector('.home-daily-ongoing [data-daily-id="expedition"]')
    if (state === 'unknown' || state === 'error') expect(line).toBeNull()
    else {
      if (state !== 'in_progress') expect(line?.textContent).toContain(state === 'completed' ? 'Terminé' : items.find(item => item.id === 'expedition')!.status)
      expect(line?.textContent).toContain('Skirk · 16:22:19')
      await act(async () => control.hide('expedition')); expect(home.textContent).not.toContain('Expédition')
      await act(async () => control.restoreAll()); expect(home.querySelector('[data-daily-id="expedition"]')).not.toBeNull()
    }
  })
})

describe('Read coordination and Paris boundaries', () => {
  it('deduplicates overlapping reads, rejects obsolete reads after mutation and isolates a reset session', async () => {
    const coordinator = createDailyReadCoordinator(), publish = vi.fn(), load = vi.fn()
    let resolve!: (value: string) => void
    load.mockImplementation(() => new Promise<string>(done => { resolve = done }))
    const first = coordinator.read('reward', load, publish), second = coordinator.read('reward', load, publish)
    expect(first).toBe(second); await Promise.resolve(); expect(load).toHaveBeenCalledOnce()
    coordinator.accept('reward', 'claimed', publish); resolve('available'); await first
    expect(publish.mock.calls).toEqual([['claimed']])
    const old = coordinator.read('wheel', load, publish); await Promise.resolve(); coordinator.reset(); resolve('player-A'); await old
    expect(publish).toHaveBeenCalledOnce()
    let finish!: (value: string) => void
    const mutation = coordinator.mutate('boss', () => new Promise<string>(done => { finish = done }), publish)
    await Promise.resolve()
    coordinator.reset(); finish('player-A'); await mutation; expect(publish).toHaveBeenCalledOnce()
  })
  it('waits for a domain mutation before a requested reread and refuses yesterday snapshots after confirmed midnight', async () => {
    const coordinator = createDailyReadCoordinator(), publish = vi.fn(), load = vi.fn(async () => ({ businessDate: '2026-10-03', claimed: false }))
    let finish!: () => void
    const mutation = coordinator.mutate('reward', () => new Promise<void>(done => { finish = done }), () => coordinator.accept('reward', { businessDate: day, claimed: true }, publish))
    const read = coordinator.read('reward', load, publish)
    await Promise.resolve(); expect(load).not.toHaveBeenCalled(); finish(); await mutation; await read
    expect(publish).toHaveBeenLastCalledWith({ businessDate: '2026-10-03', claimed: false })
    coordinator.accept('reward', { businessDate: day, claimed: true }, publish)
    await coordinator.read('reward', async () => ({ businessDate: day, claimed: true }), publish)
    expect(publish).toHaveBeenCalledTimes(2)
  })
  it.each([
    ['2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z', 23],
    ['2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z', 25],
    ['2026-10-01T22:00:00Z', '2026-10-02T22:00:00Z', 24],
  ])('schedules the next Paris midnight from %s across a %sh day', (start, end, hours) => {
    expect(nextParisMidnight(Date.parse(start))).toBe(Date.parse(end))
    expect((Date.parse(end) - Date.parse(start)) / 3600000).toBe(hours)
    expect(parisBusinessDate(Date.parse(start))).not.toBe(parisBusinessDate(Date.parse(end)))
  })
  it('refreshes once on focus+visible return without overlap, and reads again at Paris midnight', async () => {
    vi.setSystemTime(new Date('2026-10-02T21:59:59Z'))
    let resolve!: () => void
    const refresh = vi.fn(() => new Promise<void>(done => { resolve = done })), friend = vi.fn(async () => undefined)
    function Revalidation() { useDailyRevalidation('player', refresh, friend); return null }
    await act(async () => root.render(<Revalidation />))
    expect(refresh).not.toHaveBeenCalled()
    await act(async () => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) })
    expect(refresh).toHaveBeenCalledOnce(); expect(friend).toHaveBeenCalledOnce()
    await act(async () => resolve())
    await act(async () => vi.advanceTimersByTime(1101))
    expect(refresh).toHaveBeenCalledTimes(2)
    await act(async () => resolve())
    await act(async () => vi.advanceTimersByTime(5000))
    expect(refresh).toHaveBeenCalledTimes(2)
  })
  it('queues a midnight read behind an unfinished focus refresh without overlapping it', async () => {
    vi.setSystemTime(new Date('2026-10-02T21:59:59Z'))
    let resolve!: () => void
    const refresh = vi.fn(() => new Promise<void>(done => { resolve = done }))
    function Revalidation() { useDailyRevalidation('player', refresh); return null }
    await act(async () => root.render(<Revalidation />))
    await act(async () => window.dispatchEvent(new Event('focus')))
    await act(async () => vi.advanceTimersByTime(1101))
    expect(refresh).toHaveBeenCalledOnce()
    await act(async () => resolve())
    expect(refresh).toHaveBeenCalledTimes(2)
    await act(async () => resolve())
    await act(async () => vi.advanceTimersByTime(5000))
    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
