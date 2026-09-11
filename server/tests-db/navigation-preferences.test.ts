import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config/environment.js'
import { createDatabase } from '../src/infrastructure/database/prisma-database.js'
import { PrismaNavigationPreferenceStore } from '../src/infrastructure/database/prisma-navigation-preference-store.js'
import { mergeNavigationMenuPreference, navigationMenuPreferenceKey } from '../src/application/navigation/navigation-preferences.js'

const config = loadConfig()
if (!config.databaseUrl) throw new Error('DATABASE_URL is required for navigation preference database tests.')
const database = createDatabase(config.databaseUrl)
const players = new Set<string>()
afterAll(async () => { await database.player.deleteMany({ where: { id: { in: [...players] } } }); await database.$disconnect() })

describe('navigation preference persistence', () => {
  it('isolates two players and replaces only the stable preference key', async () => {
    const first = await database.player.create({ data: { displayName: `Nav ${randomUUID().slice(0, 8)}` } }); const second = await database.player.create({ data: { displayName: `Nav ${randomUUID().slice(0, 8)}` } }); players.add(first.id); players.add(second.id)
    const store = new PrismaNavigationPreferenceStore(database)
    const firstValue = mergeNavigationMenuPreference({ order: ['shop'], hidden: ['bank'] }); const secondValue = mergeNavigationMenuPreference({ order: ['box'], hidden: [] })
    await store.write(first.id, firstValue); await store.write(second.id, secondValue)
    const firstStored = await store.read(first.id) as { order: string[]; hidden: string[] }; const secondStored = await store.read(second.id) as { order: string[]; hidden: string[] }
    expect(firstStored.order[0]).toBe('shop'); expect(firstStored.hidden).toEqual(['bank'])
    expect(secondStored.order[0]).toBe('box'); expect(secondStored.hidden).toEqual([])
    expect(await database.playerPreference.count({ where: { preferenceKey: navigationMenuPreferenceKey, playerId: { in: [first.id, second.id] } } })).toBe(2)
  })
})
