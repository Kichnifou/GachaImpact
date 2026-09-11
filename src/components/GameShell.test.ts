import { describe, expect, it } from 'vitest'

import gameShellSource from './GameShell.tsx?raw'

describe('GameShell shared particle conversion overlay', () => {
  it('owns one conversion modal and exposes its opener to Activities', () => {
    expect(gameShellSource.match(/<ParticleConversionModal/g)).toHaveLength(1)
    expect(gameShellSource).toContain('onOpenParticleConversion={() => setIsParticleConversionOpen(true)}')
    expect(gameShellSource).toContain('{isParticleConversionOpen && player.elementKey && <ParticleConversionModal')
  })
})
