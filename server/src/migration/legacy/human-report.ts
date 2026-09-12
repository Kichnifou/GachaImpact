import type { LegacyMigrationDryRunReport } from './contracts.js'

export function formatLegacyMigrationDryRun(report: LegacyMigrationDryRunReport): string {
  const lines = [
    'Migration pilot dry-run',
    `Target Player UUID: ${report.targetPlayerId}`,
    `Legacy username: ${report.legacyUsername}`,
    `Source fingerprint: ${report.sourceFingerprint}`,
    `Source files: ${report.sourceFiles.discovered.join(', ')}`,
    `Missing expected files: ${report.sourceFiles.missingExpected.join(', ') || 'none'}`,
    '',
  ]
  for (const [domainName, domain] of Object.entries(report.domains)) {
    lines.push(`${domainName} [${domain.status}]`)
    for (const [fieldName, field] of Object.entries(domain.fields)) {
      lines.push(`  ${fieldName}: ${field.status}`)
      lines.push(`    legacy: ${render(field.legacyValue)}`)
      lines.push(`    standalone: ${render(field.standaloneValue)}`)
      lines.push(`    proposed: ${render(field.proposedValue)}`)
      if (field.reason) lines.push(`    reason: ${field.reason}`)
    }
    lines.push('')
  }
  if (report.warnings.length > 0) lines.push('Warnings', ...report.warnings.map((warning) => `  - ${warning}`))
  return lines.join('\n')
}

function render(value: unknown): string { return value === null ? '—' : typeof value === 'string' ? value : JSON.stringify(value) }
