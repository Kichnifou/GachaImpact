export const migrationProposalStatuses = [
  'NOOP', 'CREATE', 'UPDATE', 'CONFLICT', 'DEFERRED', 'NOT_RECONSTRUCTIBLE', 'INVALID_SOURCE', 'MANUAL_REVIEW',
] as const

export type MigrationProposalStatus = typeof migrationProposalStatuses[number]
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type MigrationProvenance = Readonly<{
  sourceFile: string
  sourcePath: string
  legacyUsername: string
  auditRule: string
  transformation: string
}>

export type MigrationProposal = Readonly<{
  status: MigrationProposalStatus
  legacyValue: JsonValue | null
  standaloneValue: JsonValue | null
  proposedValue: JsonValue | null
  provenance: MigrationProvenance
  reason?: string
}>

export type MigrationDomainReport = Readonly<{
  status: MigrationProposalStatus
  fields: Readonly<Record<string, MigrationProposal>>
  notes?: readonly string[]
}>

export type LegacyMigrationDryRunReport = Readonly<{
  mode: 'DRY_RUN'
  targetPlayerId: string
  legacyUsername: string
  sourceFingerprint: string
  sourceFiles: Readonly<{ discovered: readonly string[]; missingExpected: readonly string[] }>
  generatedAt: string
  summary: Readonly<Record<MigrationProposalStatus, number>>
  domains: Readonly<Record<string, MigrationDomainReport>>
  warnings: readonly string[]
}>

export type StandaloneMigrationTarget = Readonly<{
  playerId: string
  displayName: string
  legacyUsername: string | null
  elementKey: string | null
  domains: Readonly<Record<string, JsonValue | null>>
}>

/** The only capability available to the dry-run core. */
export interface MigrationTargetReader {
  readTarget(targetPlayerId: string): Promise<StandaloneMigrationTarget | null>
}

export type LegacySourceBundle = Readonly<{
  sourceDirectory: string
  fingerprint: string
  files: Readonly<Record<string, JsonValue>>
  missingExpectedFiles: readonly string[]
}>
