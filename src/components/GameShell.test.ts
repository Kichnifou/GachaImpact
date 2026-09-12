import { describe, expect, it } from 'vitest'

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
  })

  it('consumes Box character deep links once without remounting the Box', () => {
    expect(gameShellSource).not.toContain('key={`${player.id}:${boxOpenIntent?.token ?? 0}`}')
    expect(gameShellSource).toContain('onOpenCharacterIntentConsumed={(token) => setBoxOpenIntent((current) => current?.token === token ? null : current)}')
    expect(gameShellSource).toContain('setBoxOpenIntent({ characterId: expedition.activeCharacter.id, token: crypto.randomUUID() })')
    expect(gameShellSource).toContain('setBoxOpenIntent({ characterId: notification.actionTargetId, token: crypto.randomUUID() })')
    expect(gameShellSource).toContain("else { setBoxOpenIntent(null); navigate('characters-box') }")
  })
})
