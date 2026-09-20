import { describe, expect, it } from 'vitest'

import appBootstrapSource from '../AppBootstrap.tsx?raw'
import gameShellSource from './GameShell.tsx?raw'

describe('GameShell shared particle conversion overlay', () => {
  it('owns one conversion modal and exposes its opener to Activities', () => {
    expect(gameShellSource.match(/<ParticleConversionModal/g)).toHaveLength(1)
    expect(gameShellSource).toContain('onOpenParticleConversion={() => setIsParticleConversionOpen(true)}')
    expect(gameShellSource).toContain('{isParticleConversionOpen && player.elementKey && <ParticleConversionModal')
  })

  it('uses a transient request token so the sidebar shortcut always forces the Quotidiennes overview', () => {
    expect(gameShellSource).toContain('const [dailiesOverviewRequestToken, setDailiesOverviewRequestToken] = useState(0)')
    expect(gameShellSource).toContain('setDailiesOverviewRequestToken((value) => value + 1); navigate(\'activities-dailies\')')
    expect(gameShellSource).toContain('dailiesOverviewRequestToken={dailiesOverviewRequestToken}')
  })

  it('reuses the shared Box cache and mutations for Combat character details', () => {
    expect(gameShellSource).toContain('dailyCombatBox={{')
    expect(gameShellSource).toContain('initialBox: boxCache.read(player.id)')
    expect(gameShellSource).toContain('onLoadBox: loadBox')
    expect(gameShellSource).toContain('onSetFavorite: setBoxFavorite')
    expect(gameShellSource).toContain('onUseStella: useStella')
    expect(gameShellSource).toContain('onCharacterProgressed: () => Promise.all([onLoadTeams(), onLoadDailyCombat()])')
    expect(gameShellSource).toContain('await refreshMonthlyBoss()')
  })

  it('consumes Box character deep links once without remounting the Box', () => {
    expect(gameShellSource).not.toContain('key={`${player.id}:${boxOpenIntent?.token ?? 0}`}')
    expect(gameShellSource).toContain('onOpenCharacterIntentConsumed={(token) => setBoxOpenIntent((current) => current?.token === token ? null : current)}')
    expect(gameShellSource).toContain('setBoxOpenIntent({ characterId: expedition.value.activeCharacter.id, token: crypto.randomUUID() })')
    expect(gameShellSource).toContain('setBoxOpenIntent({ characterId: notification.actionTargetId, token: crypto.randomUUID() })')
    expect(gameShellSource).toContain("else { setBoxOpenIntent(null); navigate('characters-box') }")
  })

  it('routes a received friend request notification to the Requests tab', () => {
    expect(gameShellSource).toContain("notification.actionKey === 'OPEN_SOCIAL_REQUESTS'")
    expect(gameShellSource).toContain("void friendship.refresh(); setSocialTab('requests'); navigate('social')")
    expect(gameShellSource).toContain("setSocialTab('requests'); navigate('social')")
  })

  it('uses the faster friendship rhythm only while a Social surface is active', () => {
    expect(gameShellSource).toContain("useFriendships(socialActions, activeScreen === 'social' || activeScreen === 'profile' || isPlayersOpen)")
  })

  it('passes the same central Expedition snapshot and monotonic clock to Box and Activities', () => {
    expect(gameShellSource).toContain('expedition={expedition} expeditionMonotonicNow={expeditionMonotonicNow}')
    expect(gameShellSource.match(/expeditionMonotonicNow=\{expeditionMonotonicNow\}/g)).toHaveLength(2)
  })

  it('keeps navigation preference callbacks stable across Expedition ticks and Contest renders', () => {
    expect(appBootstrapSource).toContain('const loadNavigationPreferences = useCallback(')
    expect(appBootstrapSource).toContain('const saveNavigationPreferences = useCallback(')
    expect(appBootstrapSource).toContain('onLoadNavigationPreferences={loadNavigationPreferences}')
    expect(appBootstrapSource).toContain('onSaveNavigationPreferences={saveNavigationPreferences}')
    expect(appBootstrapSource).not.toContain('onLoadNavigationPreferences={() =>')
  })

  it('forces one coordinated Contest refresh after successful Stella and Pull mutations', () => {
    expect(appBootstrapSource).toContain('const refreshContest = useCallback(() => contestRequests.refresh(')
    expect(appBootstrapSource).toMatch(/const useStella = useCallback\(async[\s\S]*?await refreshContest\(\)[\s\S]*?return result/)
    expect(appBootstrapSource).toContain('Promise.all([getGameApiClient().getDailyChallenge(), loadMonthlyBoss(), refreshContest()])')
  })
})
