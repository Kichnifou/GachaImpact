import { createHash } from 'node:crypto'
import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'

import type { JsonValue, LegacySourceBundle } from './contracts.js'

export const expectedLegacySourceFiles = [
  'banner_votes.json', 'c6_characters.json', 'combat_config.json', 'combat_data.json', 'contests_data.json',
  'element_passives.json', 'friendships_data.json', 'genshin_characters.json', 'gift_codes.json', 'giveaway.json',
  'long_missions.json', 'missions_pool.json', 'monthly_boss.json', 'monthly_events.json',
  'monthly_events_data.json', 'shop_items.json', 'viewers_data.json',
] as const

export async function loadLegacySourceBundle(sourcePath: string): Promise<LegacySourceBundle> {
  const sourceDirectory = resolve(sourcePath)
  if (!(await stat(sourceDirectory).catch(() => null))?.isDirectory()) {
    throw new Error(`INVALID_SOURCE: source directory does not exist: ${sourceDirectory}`)
  }

  const entries = (await readdir(sourceDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'))
  if (!entries.includes('viewers_data.json')) throw new Error('INVALID_SOURCE: viewers_data.json is required')

  const hash = createHash('sha256')
  const files: Record<string, JsonValue> = {}
  for (const fileName of entries) {
    const absolutePath = resolve(sourceDirectory, fileName)
    const relativePath = relative(sourceDirectory, absolutePath).replaceAll('\\', '/')
    const bytes = await readFile(absolutePath)
    hash.update(`${Buffer.byteLength(relativePath)}:${relativePath}:${bytes.length}:`)
    hash.update(bytes)
    try {
      files[basename(fileName)] = JSON.parse(bytes.toString('utf8')) as JsonValue
    } catch {
      throw new Error(`INVALID_SOURCE: invalid JSON in ${fileName}`)
    }
  }

  return {
    sourceDirectory,
    fingerprint: `sha256:${hash.digest('hex')}`,
    files,
    missingExpectedFiles: expectedLegacySourceFiles.filter((fileName) => !entries.includes(fileName)),
  }
}
