import { describe, expect, it } from 'vitest'

import appBootstrapSource from '../AppBootstrap.tsx?raw'
import profileScreenSource from '../screens/ProfileScreen.tsx?raw'
import gameShellSource from './GameShell.tsx?raw'

describe('GameShell shared particle conversion overlay', () => {
  it('owns one conversion modal and exposes its opener to Activities', () => {
    expect(gameShellSource.match(/<ParticleConversionModal/g)).toHaveLength(1)
    expect(gameShellSource).toContain('onOpenParticleConversion={() => setIsParticleConversionOpen(true)}')
    expect(gameShellSource).toContain("{(isParticleConversionOpen || presentationStep?.panel === 'conversion') && player.elementKey && <ParticleConversionModal")
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
    expect(gameShellSource).toContain('setBoxOpenIntent({ characterId: intent.targetId, token: crypto.randomUUID() })')
    expect(gameShellSource).toContain("else { setBoxOpenIntent(null); navigate('characters-box') }")
  })

  it('routes a received friend request notification to the Requests tab', () => {
    expect(gameShellSource).toContain("case 'social-requests':")
    expect(gameShellSource).toContain("void friendship.refresh(true); setSocialTab('requests'); navigate('social')")
    expect(gameShellSource).toContain("setSocialTab('requests'); navigate('social')")
  })

  it('routes an accepted friendship notification to Amis', () => {
    expect(gameShellSource).toContain("case 'social-friends':")
    expect(gameShellSource).toContain("void friendship.refresh(true); setSocialTab('friends'); navigate('social')")
  })

  it('routes a Mission intent to the existing Activities Missions screen', () => {
    expect(gameShellSource).toContain("case 'missions': navigate('activities-missions')")
  })

  it('routes Profile messages through the same persistent Community panel intent as Chat', () => {
    expect(profileScreenSource).toContain("onClick={() => onMessage({ id: playerId, displayName: value.player.displayName, elementKey: value.player.elementKey, presence: value.presence })}")
    expect(profileScreenSource).toContain('>Message privé</AppButton>')
    expect(profileScreenSource).not.toContain('Envoyer un message privé')
    expect(gameShellSource).toContain('onMessage={openDirectMessage}')
    expect(gameShellSource).toContain('directMessageIntent={directMessageIntent}')
    expect(gameShellSource).toContain('onDirectMessageIntentConsumed={token => setDirectMessageIntent(current => current?.token === token ? null : current)}')
  })

  it('uses the faster friendship rhythm while a Social surface or daily friendship summary is active', () => {
    expect(gameShellSource).toContain("useFriendships(socialActions, activeScreen === 'social' || activeScreen === 'profile' || activeScreen === 'activities-dailies' || isPlayersOpen)")
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

  it('keeps paginated and automatic loaders stable across Expedition ticks', () => {
    for (const callback of ['loadMonthlyBossHistory', 'loadGachaHistory', 'loadInventory', 'loadInventoryItemDetail', 'loadBankHistory']) {
      expect(appBootstrapSource).toContain(`const ${callback} = useCallback(`)
    }
    expect(appBootstrapSource).toContain('onLoadMonthlyBossHistory={loadMonthlyBossHistory}')
    expect(appBootstrapSource).toContain('onGetGachaHistory={loadGachaHistory}')
    expect(appBootstrapSource).toContain('onLoadInventory={loadInventory}')
    expect(appBootstrapSource).toContain('onLoadInventoryItemDetail={loadInventoryItemDetail}')
    expect(appBootstrapSource).toContain('onLoadBankHistory={loadBankHistory}')
    expect(appBootstrapSource).not.toMatch(/on(?:Load|Get)(?:MonthlyBossHistory|GachaHistory|Inventory|InventoryItemDetail|BankHistory)=\{\s*\([^)]*\)\s*=>/)
  })

  it('forces one coordinated Contest refresh after successful Stella and Pull mutations', () => {
    expect(appBootstrapSource).toContain('const refreshContest = useCallback(() => contestRequests.refresh(')
    expect(appBootstrapSource).toMatch(/const useStella = useCallback\(async[\s\S]*?await refreshContest\(\)[\s\S]*?return result/)
    expect(appBootstrapSource).toContain('Promise.all([getGameApiClient().getDailyChallenge(), loadMonthlyBoss(), refreshContest()])')
  })
})
