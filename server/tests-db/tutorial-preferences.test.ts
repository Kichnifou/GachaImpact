import 'dotenv/config'
import { beforeAll, afterAll, expect, it } from 'vitest'
import { isolatedBatchDatabase } from './isolated-batch-database.js'
import { PrismaTutorialPreferenceStore } from '../src/infrastructure/database/prisma-tutorial-preference-store.js'
import { PrismaNavigationPreferenceStore } from '../src/infrastructure/database/prisma-navigation-preference-store.js'
import { mergeNavigationMenuPreference } from '../src/application/navigation/navigation-preferences.js'

const isolated = isolatedBatchDatabase(), database = isolated.database
beforeAll(() => isolated.setup(), 60_000)
afterAll(() => isolated.cleanup(), 60_000)
it.each([
  null, { version: 1, status: 'NOT_STARTED', stepId: null }, { version: 1, status: 'COMPLETED', stepId: null },
  { version: 1, status: 'IN_PROGRESS', stepId: 'arcade-memory' }, { version: 1, status: 'IN_PROGRESS', stepId: 'event-calendar' }, { invalid: true },
])('atomically claims retroactive autostart for %j in a private schema', async saved => {
  const player = await database.player.create({ data: { displayName: 'Autostart' } })
  if (saved) await database.playerPreference.create({ data: { playerId: player.id, preferenceKey: 'tutorial_v1', value: saved } })
  const store = new PrismaTutorialPreferenceStore(database)
  const results = await Promise.all([store.claimAutostart(player.id), store.claimAutostart(player.id)])
  expect(results.filter(result => result.shouldLaunch)).toHaveLength(1)
  const preference = { version: 1, status: 'IN_PROGRESS', stepId: saved?.status === 'IN_PROGRESS' ? 'arcade-memory' : 'profile' }
  expect(results.find(result => result.shouldLaunch)).toEqual({ shouldLaunch: true, preference })
  expect(await store.read(player.id)).toEqual(preference)
  expect((await database.playerPreference.findUniqueOrThrow({ where: { playerId_preferenceKey: { playerId: player.id, preferenceKey: 'tutorial_v1_autostart' } } })).value).toEqual({ version: 1, claimed: true })
  await store.write(player.id, { version: 1, status: 'COMPLETED', stepId: null })
  expect(await store.claimAutostart(player.id)).toEqual({ shouldLaunch: false })
  expect(await store.read(player.id)).toEqual({ version: 1, status: 'COMPLETED', stepId: null })
  const other = await database.player.create({ data: { displayName: 'Independent' } })
  expect((await store.claimAutostart(other.id)).shouldLaunch).toBe(true)
})
it('writes only tutorial_v1, isolates Players and preserves navigation_menu_v1 in a private schema', async () => {
  const first = await database.player.create({ data: { displayName: 'Tutorial First' } })
  const second = await database.player.create({ data: { displayName: 'Tutorial Second' } })
  const store = new PrismaTutorialPreferenceStore(database), navigation = new PrismaNavigationPreferenceStore(database)
  const menu = mergeNavigationMenuPreference({ order: ['shop'], hidden: ['tutorial'] })
  await navigation.write(first.id, menu)
  expect(await store.read(first.id)).toBeNull()
  await store.write(first.id, { version: 1, status: 'IN_PROGRESS', stepId: 'resources' })
  await store.write(second.id, { version: 1, status: 'IN_PROGRESS', stepId: 'community' })
  await store.write(first.id, { version: 1, status: 'COMPLETED', stepId: null })
  await store.write(first.id, { version: 1, status: 'COMPLETED', stepId: null })
  expect(await store.read(first.id)).toEqual({ version: 1, status: 'COMPLETED', stepId: null })
  expect(await store.read(second.id)).toEqual({ version: 1, status: 'IN_PROGRESS', stepId: 'community' })
  expect(await navigation.read(first.id)).toEqual(menu)
  expect((await database.playerPreference.findMany({ where: { playerId: { in: [first.id, second.id] } }, select: { preferenceKey: true } })).map(row => row.preferenceKey).sort()).toEqual(['navigation_menu_v1', 'tutorial_v1', 'tutorial_v1'])
  expect((await database.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0]?.current_schema).toBe(isolated.schema)
})
