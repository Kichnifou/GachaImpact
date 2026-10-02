import 'dotenv/config'
import { beforeAll, afterAll, expect, it } from 'vitest'
import { isolatedBatchDatabase } from './isolated-batch-database.js'
import { PrismaTutorialPreferenceStore } from '../src/infrastructure/database/prisma-tutorial-preference-store.js'
import { PrismaNavigationPreferenceStore } from '../src/infrastructure/database/prisma-navigation-preference-store.js'
import { mergeNavigationMenuPreference } from '../src/application/navigation/navigation-preferences.js'

const isolated = isolatedBatchDatabase(), database = isolated.database
beforeAll(() => isolated.setup(), 60_000)
afterAll(() => isolated.cleanup(), 60_000)
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
  expect((await database.playerPreference.findMany({ select: { preferenceKey: true } })).map(row => row.preferenceKey).sort()).toEqual(['navigation_menu_v1', 'tutorial_v1', 'tutorial_v1'])
  expect((await database.$queryRaw<{ current_schema: string }[]>`SELECT current_schema()`)[0]?.current_schema).toBe(isolated.schema)
})
