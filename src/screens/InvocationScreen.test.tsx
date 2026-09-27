// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { CurrentGachaDto, GachaHistoryDto, PlayerTeamsDto } from '../api/types'
import InvocationScreen from './InvocationScreen'

const gacha: CurrentGachaDto = {
  banner: {
    id: 'banner', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-08T00:00:00Z',
    featuredFiveStars: [{ id: 'hero', externalKey: 'hero', name: 'Hero', rarity: 5, elementKey: 'hydro', weaponType: 'Sword', region: 'Fontaine', classKey: null, iconPath: '/hero.png', splashPath: '/hero.png', wishPath: '/hero.png', fullbodyPath: '/hero.png' }],
    featuredFourStars: [],
  },
  playerState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: 'hero', totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' },
}
const teams: PlayerTeamsDto = { teams: [], availableCharacters: [], passiveReference: [] }
const history: GachaHistoryDto = { page: 1, pageSize: 10, totalResults: 0, totalPages: 0, hasPrevious: false, hasNext: false, results: [] }
const container = document.createElement('div')
const root = createRoot(container)
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  act(() => root.render(null))
  container.replaceChildren()
})

it('removes the bottom history button while keeping Détail and its Historique tab', async () => {
  const onGetHistory = vi.fn(async () => history)
  document.body.append(container)
  await act(async () => {
    root.render(<InvocationScreen gacha={gacha} teams={teams} onSetTarget={vi.fn()} onPull={vi.fn()} pendingPullCount={null} onPresentationDisclosed={vi.fn()} onGetHistory={onGetHistory} />)
  })

  expect(container.textContent).not.toContain('Historique des invocations')
  expect(container.querySelectorAll('.invocation-screen > button')).toHaveLength(0)
  expect(container.textContent).toContain('Invocation x1')
  expect(container.textContent).toContain('Invocation x10')
  const detail = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Détail')
  expect(detail).toBeDefined()

  await act(async () => { detail!.click(); await Promise.resolve(); await Promise.resolve() })
  expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('Historique')
  expect(onGetHistory).toHaveBeenCalledWith(1)
  expect(container.textContent).toContain('Aucune Invocation enregistrée.')
})
