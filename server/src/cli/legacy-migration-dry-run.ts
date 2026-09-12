import 'dotenv/config'

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { createDatabase } from '../infrastructure/database/prisma-database.js'
import { runLegacyMigrationDryRun } from '../migration/legacy/dry-run.js'
import { formatLegacyMigrationDryRun } from '../migration/legacy/human-report.js'
import { PrismaMigrationTargetReader } from '../migration/legacy/prisma-target-reader.js'
import { loadLegacySourceBundle } from '../migration/legacy/source-bundle.js'

const argumentsByName = parseArguments(process.argv.slice(2))
const source = required(argumentsByName, 'source')
const targetPlayerId = required(argumentsByName, 'target-player-id')
const legacyUsername = required(argumentsByName, 'legacy-username')
const output = resolve(required(argumentsByName, 'output'))
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetPlayerId)) throw new Error('target-player-id must be an explicit UUID')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required for the read-only target comparison')
const database = createDatabase(databaseUrl)
try {
  const bundle = await loadLegacySourceBundle(source)
  const report = await runLegacyMigrationDryRun({ targetPlayerId, legacyUsername, bundle, reader: new PrismaMigrationTargetReader(database) })
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  process.stdout.write(`${formatLegacyMigrationDryRun(report)}\n\nJSON report: ${output}\n`)
} finally {
  await database.$disconnect()
}

function parseArguments(values: readonly string[]): Map<string, string> {
  const allowed = new Set(['source', 'target-player-id', 'legacy-username', 'output'])
  const parsed = new Map<string, string>()
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index]
    const value = values[index + 1]
    if (!name?.startsWith('--') || value === undefined || value.startsWith('--')) throw new Error(`Invalid argument near ${name ?? '(end)'}`)
    const key = name.slice(2)
    if (!allowed.has(key)) throw new Error(`Unsupported argument: ${name}`)
    parsed.set(key, value)
  }
  return parsed
}
function required(values: ReadonlyMap<string, string>, name: string): string { const value = values.get(name); if (!value) throw new Error(`--${name} is required`); return value }
