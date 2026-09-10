// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ModerationStateDto } from '../api/types'
import ModerationScreen from './ModerationScreen'
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const state = (superTools = false): ModerationStateDto => ({ player: { id: 'self', displayName: 'Kichnifou', elementKey: 'hydro', level: 2, tester: true }, permissions: { roles: superTools ? ['ADMIN', 'TESTER'] : ['TESTER'], capabilities: { moderationAccess: true, selfResourceTools: true, superTools, canSelectPlayers: superTools, canManageTesters: superTools } }, resources: { primogems: '1000', moras: '1000', particles: { pyro: '0', hydro: '0', cryo: '0', electro: '0', anemo: '0', geo: '0', dendro: '0' } }, progression: { totalXp: '89', level: 2, xpIntoCurrentStep: '29', xpPerStep: '30', isMaxLevel: false, level100OverflowRewardsClaimed: 0, totalMessages: '0', countedMessages: '0' }, gachaState: { pity5: 0, pity4: 0, guaranteedFeatured5: false, captureProgress: 0, fiftyFiftyLostStreak: 0, selectedBannerCharacterId: null, totalPulls: '0', totalFiveStars: '0', totalFourStars: '0', fiftyFiftyWon: '0', fiftyFiftyLost: '0', capturesTriggered: '0' }, stella: { quantity: '0' } })
const roots: Root[] = []
afterEach(() => { act(() => roots.splice(0).forEach((root) => root.unmount())); document.body.replaceChildren() })
async function mount(superTools = false) {
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container); roots.push(root)
  await act(async () => { root.render(<ModerationScreen actorPlayerId="self" capabilities={state(superTools).permissions.capabilities} onLoad={vi.fn(async () => state(superTools))} onSearchPlayers={vi.fn(async () => [])} onResource={vi.fn(async () => state(superTools))} onXp={vi.fn(async () => state(superTools))} onGacha={vi.fn(async () => state(superTools))} onStella={vi.fn(async () => state(superTools))} onTester={vi.fn(async () => state(superTools))} onApplied={vi.fn()} />); await Promise.resolve(); await Promise.resolve() })
  return container
}
describe('ModerationScreen', () => {
  it('limits a Testeur to resources without native numeric spinners', async () => { const container = await mount(); expect(container.textContent).toContain('Rang : Testeur'); expect(container.textContent).toContain('Ressources'); for (const label of ['Progression', 'Gacha', 'Objets', 'Joueur ciblé']) expect(container.textContent).not.toContain(label); expect(container.querySelectorAll('input[type="number"]')).toHaveLength(0) })
  it('shows Super targeting and all privileged tools', async () => { const container = await mount(true); expect(container.textContent).toContain('Rang : Super'); for (const label of ['Joueur ciblé', 'Progression', 'Gacha', 'Objets']) expect(container.textContent).toContain(label); expect(container.textContent).not.toContain('État de test mis à jour.') })
})
