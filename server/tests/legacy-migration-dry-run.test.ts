import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { JsonValue, LegacySourceBundle, MigrationTargetReader, StandaloneMigrationTarget } from '../src/migration/legacy/contracts.js'
import { runLegacyMigrationDryRun } from '../src/migration/legacy/dry-run.js'
import { loadLegacySourceBundle } from '../src/migration/legacy/source-bundle.js'

const readerSource = readFileSync('src/migration/legacy/prisma-target-reader.ts', 'utf8')
const contractsSource = readFileSync('src/migration/legacy/contracts.ts', 'utf8')
const cliSource = readFileSync('src/cli/legacy-migration-dry-run.ts', 'utf8')

const targetPlayerId = '11111111-1111-4111-8111-111111111111'
const legacyUsername = 'SyntheticPilot'
const temporaryDirectories: string[] = []

const completeProfile: Record<string, JsonValue> = {
  level: 100,
  xp: '900719925474099312345',
  element: 'Hydro',
  primogems: '1000',
  moras: '2500',
  particles: { pyro: '1', hydro: '2', cryo: '3', electro: '4', anemo: '5', geo: '6', dendro: '7' },
  stats: {
    totalMessages: '50', countedMessages: '40', totalPrimosEarned: '5000', totalPrimosSpent: '4000', totalMorasEarned: '7000', totalMorasSpent: '6000', totalMainElementParticlesEarned: '200',
    totalPulls: '30', totalFiveStars: '2', totalFourStars: '5', fiftyFiftyWon: '1', fiftyFiftyLost: '1', fiftyFiftyLostStreak: '4', totalWheelSpins: '9', totalWheelJackpots: '1',
    totalCombatFights: '6', totalCombatWins: '4', totalCombatLosses: '2', totalManualCombatWins: '3', totalExpeditionsCompleted: '8',
  },
  bank: { moras: '900', lastInterestDate: '2026-09-10' },
  pity: { pity5: 12, pity4: 3 },
  guarantee: { guaranteedFeatured5: true },
  fiftyFiftyLostStreak: 4,
  selectedBannerCharacterId: 'legacy-character-1',
  box: { legacyCharacter1: { characterId: 'legacy-character-1', constellation: 2, copies: 1, firstObtainedAt: '2025-01-01T10:00:00' } },
  boxFavorites: ['legacyCharacter1'],
  team: ['legacy-character-1'],
  savedTeams: [{ name: 'Pilot team', characters: ['legacy-character-1'], savedAt: '2025-02-01T10:00:00' }],
  masterlessStellaFortuna: '3',
  dates: { lastDailyFirstMessageReward: '2026-09-10', lastWheelDate: '2026-09-10', lastFightDate: '2026-09-10', lastWinDate: '2026-09-10' },
  missions: { daily: { missionId: 'daily_pulls_5', progress: 2, target: 5, completed: false, startedAt: '2026-09-10' } },
  expedition: { active: true, characterId: 'legacy-character-1', startedAt: '2026-09-10T10:00:00', readyAt: '2026-09-11T06:00:00' },
}

const target = (domains: StandaloneMigrationTarget['domains'] = {}): StandaloneMigrationTarget => ({
  playerId: targetPlayerId, displayName: 'Standalone Pilot', legacyUsername: null, elementKey: null, domains,
})
const bundle = (profile: Record<string, JsonValue> = completeProfile): LegacySourceBundle => ({
  sourceDirectory: 'C:/external/synthetic', fingerprint: 'sha256:synthetic', files: { 'viewers_data.json': { [legacyUsername]: profile } }, missingExpectedFiles: [],
})
const reader = (value: StandaloneMigrationTarget | null = target()): MigrationTargetReader => ({ readTarget: vi.fn(async () => value) })

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('legacy migration pilot dry-run', () => {
  it('analyzes a complete synthetic player, preserves big integers, and never infers identity from displayName', async () => {
    const migrationReader = reader()
    const report = await runLegacyMigrationDryRun({ targetPlayerId, legacyUsername, bundle: bundle(), reader: migrationReader, generatedAt: '2026-09-12T20:00:00.000Z' })
    expect(migrationReader.readTarget).toHaveBeenCalledExactlyOnceWith(targetPlayerId)
    expect(report.mode).toBe('DRY_RUN')
    expect(report.targetPlayerId).toBe(targetPlayerId)
    expect(report.legacyUsername).toBe(legacyUsername)
    expect(report.sourceFiles).toEqual({ discovered: ['viewers_data.json'], missingExpected: [] })
    expect(report.domains.progression!.fields.xp?.proposedValue).toBe('900719925474099312345')
    expect(report.domains.gacha!.fields.pity5?.proposedValue).toBe('12')
    expect(report.domains.gacha!.fields.guaranteedFeatured5?.proposedValue).toBe(true)
    expect(report.domains.box?.fields.possessions?.provenance.legacyUsername).toBe(legacyUsername)
    expect(report.domains.teams?.fields.teams?.provenance.transformation).toContain('ten base positions')
    expect(report.warnings).toContain('CUTOVER_BOUNDARY_UNRESOLVED: daily and active temporal states require a reviewed Europe/Paris cutover boundary.')
  })

  it('emits NOOP, CREATE, UPDATE and CONFLICT without applying any choice', async () => {
    const current = target({
      progression: { xp: '0', totalMessages: '0', countedMessages: '0' },
      resources: { primogems: '1000', moras: '999', particles_pyro: '0' },
      items: {},
    })
    const report = await runLegacyMigrationDryRun({ targetPlayerId, legacyUsername, bundle: bundle(), reader: reader(current) })
    expect(report.domains.resources?.fields.primogems?.status).toBe('NOOP')
    expect(report.domains.items?.fields.masterless_stella_fortuna?.status).toBe('CREATE')
    expect(report.domains.progression?.fields.xp?.status).toBe('UPDATE')
    expect(report.domains.resources?.fields.moras?.status).toBe('CONFLICT')
    expect(report.domains.resources?.fields.moras?.standaloneValue).toBe('999')
  })

  it('marks missing and malformed source values INVALID_SOURCE instead of inventing defaults', async () => {
    const report = await runLegacyMigrationDryRun({ targetPlayerId, legacyUsername, bundle: bundle({ element: 'Light', primogems: -1, box: { broken: 'not-a-possession' } }), reader: reader() })
    expect(report.domains.player?.fields.elementKey?.status).toBe('INVALID_SOURCE')
    expect(report.domains.resources?.fields.primogems?.status).toBe('INVALID_SOURCE')
    expect(report.domains.progression?.fields.xp?.proposedValue).toBeNull()
    expect(report.domains.box?.fields.possessions?.status).toBe('INVALID_SOURCE')
    expect(report.domains.box?.fields.possessions?.proposedValue).toBeNull()
  })

  it('reports nonphysical domains as DEFERRED and impossible histories as NOT_RECONSTRUCTIBLE', async () => {
    const report = await runLegacyMigrationDryRun({ targetPlayerId, legacyUsername, bundle: bundle(), reader: reader() })
    expect(report.domains.social?.status).toBe('DEFERRED')
    expect(report.domains.events?.status).toBe('DEFERRED')
    expect(report.domains.boss?.status).toBe('DEFERRED')
    expect(report.domains.gacha?.fields.capturesTriggered?.proposedValue).toBe('0')
    expect(report.domains.pullHistory?.status).toBe('NOT_RECONSTRUCTIBLE')
    expect(report.domains.bankHistory?.status).toBe('NOT_RECONSTRUCTIBLE')
  })

  it('rejects an absent explicit target or absent explicit legacy username', async () => {
    await expect(runLegacyMigrationDryRun({ targetPlayerId, legacyUsername, bundle: bundle(), reader: reader(null) })).rejects.toThrow('TARGET_PLAYER_NOT_FOUND')
    await expect(runLegacyMigrationDryRun({ targetPlayerId, legacyUsername: 'MissingSynthetic', bundle: bundle(), reader: reader() })).rejects.toThrow('INVALID_SOURCE')
    await expect(runLegacyMigrationDryRun({ targetPlayerId, legacyUsername: legacyUsername.toLowerCase(), bundle: bundle(), reader: reader() })).rejects.toThrow('INVALID_SOURCE')
  })

  it('fingerprints the exact discovered bytes stably and rejects invalid source bundles', async () => {
    const first = await createSourceDirectory({ 'viewers_data.json': JSON.stringify({ [legacyUsername]: completeProfile }), 'combat_data.json': '{"date":"2026-09-12"}' })
    const second = await createSourceDirectory({ 'combat_data.json': '{"date":"2026-09-12"}', 'viewers_data.json': JSON.stringify({ [legacyUsername]: completeProfile }) })
    expect((await loadLegacySourceBundle(first)).fingerprint).toBe((await loadLegacySourceBundle(second)).fingerprint)
    const malformed = await createSourceDirectory({ 'viewers_data.json': '{invalid' })
    await expect(loadLegacySourceBundle(malformed)).rejects.toThrow('INVALID_SOURCE')
    const absentViewer = await createSourceDirectory({ 'combat_data.json': '{}' })
    await expect(loadLegacySourceBundle(absentViewer)).rejects.toThrow('viewers_data.json is required')
  })

  it('keeps the read boundary and CLI structurally free of write capabilities or mutation modes', () => {
    expect(contractsSource).toMatch(/interface MigrationTargetReader\s*{\s*readTarget\(/)
    expect(readerSource).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw)\s*\(/)
    expect(cliSource).not.toContain('--apply')
    expect(cliSource).not.toContain('--write')
    expect(cliSource).not.toMatch(/BusinessOperation|EconomyService|ResourceMovement/)
  })
})

async function createSourceDirectory(files: Readonly<Record<string, string>>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'gachaimpact-legacy-dry-run-'))
  temporaryDirectories.push(directory)
  await Promise.all(Object.entries(files).map(([name, content]) => writeFile(join(directory, name), content, 'utf8')))
  return directory
}
