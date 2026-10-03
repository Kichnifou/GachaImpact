import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import type { PrismaClient } from '../generated/prisma/client.js'
import { AppearanceService } from '../src/application/appearance/appearance-service.js'
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js'

it('projects the five PLAYER_LEVEL kind rules physically stored by migration 059', async () => {
  const sql = readFileSync('prisma/migrations/20261003160000_059_add_profile_level_titles/migration.sql', 'utf8')
  const rules = Array.from(sql.matchAll(/'(\{"kind":"PLAYER_LEVEL","level":\d+\})'/g), match => JSON.parse(match[1]!))
  expect(rules.map(rule => rule.level)).toEqual([10, 25, 50, 75, 100])
  const player = { id: crypto.randomUUID(), displayName: 'Projection', status: 'ACTIVE' as const, elementKey: 'hydro' as const, equippedAvatarCosmetic: null, equippedTitleCosmetic: null }
  const database = { player: { findUniqueOrThrow: vi.fn().mockResolvedValue(player) }, cosmeticDefinition: { findMany: vi.fn().mockResolvedValue(rules.map(rule => ({ id: String(rule.level), type: 'TITLE', visibility: 'VISIBLE', isActive: true, unlockRule: rule, displayName: String(rule.level), assetPath: null, sourceCharacterId: null, conditionText: 'Niveau' }))) }, playerCosmetic: { findMany: vi.fn().mockResolvedValue([]) }, playerCharacter: { findMany: vi.fn().mockResolvedValue([]) } } as unknown as PrismaClient
  const actor = new GetCurrentPlayer({ findByIdentity: async () => player, provision: vi.fn() })
  const result = await new AppearanceService(database, actor).get({ subject: 'projection' })
  expect(result.catalog.map(row => row.levelRequirement)).toEqual([10, 25, 50, 75, 100])
})
