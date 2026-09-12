import type { JsonValue, LegacyMigrationDryRunReport, LegacySourceBundle, MigrationDomainReport, MigrationProposal, MigrationProposalStatus, MigrationTargetReader, StandaloneMigrationTarget } from './contracts.js'
import { migrationProposalStatuses } from './contracts.js'

type ObjectValue = Record<string, JsonValue>
type ProposalOptions = Readonly<{ baseline?: JsonValue | null; status?: MigrationProposalStatus; reason?: string }>

const elements = new Map([
  ['pyro', 'pyro'], ['hydro', 'hydro'], ['cryo', 'cryo'], ['electro', 'electro'], ['électro', 'electro'],
  ['anemo', 'anemo'], ['anémo', 'anemo'], ['geo', 'geo'], ['géo', 'geo'], ['dendro', 'dendro'],
])

export async function runLegacyMigrationDryRun(input: Readonly<{
  targetPlayerId: string
  legacyUsername: string
  bundle: LegacySourceBundle
  reader: MigrationTargetReader
  generatedAt?: string
}>): Promise<LegacyMigrationDryRunReport> {
  const target = await input.reader.readTarget(input.targetPlayerId)
  if (!target || target.playerId !== input.targetPlayerId) throw new Error(`TARGET_PLAYER_NOT_FOUND: ${input.targetPlayerId}`)
  const profile = findLegacyProfile(input.bundle.files['viewers_data.json'], input.legacyUsername)
  if (!profile) throw new Error(`INVALID_SOURCE: legacy username not found: ${input.legacyUsername}`)

  const warnings = [
    'CUTOVER_BOUNDARY_UNRESOLVED: daily and active temporal states require a reviewed Europe/Paris cutover boundary.',
    ...(input.bundle.missingExpectedFiles.length > 0 ? [`LEGACY_SOURCE_FILES_MISSING: ${input.bundle.missingExpectedFiles.join(', ')}`] : []),
  ]
  const context = { legacyUsername: input.legacyUsername, target }
  const domains: Record<string, MigrationDomainReport> = {
    player: playerDomain(profile, context),
    progression: progressionDomain(profile, context),
    resources: resourcesDomain(profile, context),
    bank: bankDomain(profile, context),
    gacha: gachaDomain(profile, context),
    box: boxDomain(profile, context),
    teams: teamsDomain(profile, context),
    items: itemsDomain(profile, context),
    dailyReward: temporalDomain(profile, context, 'dates.lastDailyFirstMessageReward', 'dailyReward', 'legacy/04-xp-audit.md — Récompense quotidienne', 'Only the last certain claim date is proposed; first historical claim is not reconstructed.'),
    wheel: wheelDomain(profile, context),
    dailyChallenge: temporalDomain(profile, context, 'missions.daily', 'dailyChallenge', 'legacy/11-missions-daily-audit.md — Missions daily', 'Preserve only a cutover-relevant current state after human review.'),
    combat: combatDomain(profile, context),
    expedition: expeditionDomain(profile, context),
    social: fixedDomain('DEFERRED', input.legacyUsername, 'friendships_data.json', '$', 'legacy Social audits', 'Standalone Social is not physical yet.'),
    events: fixedDomain('DEFERRED', input.legacyUsername, 'monthly_events_data.json', '$', 'legacy Event audits', 'Standalone Event is not physical yet.'),
    permanentMissions: fixedDomain('DEFERRED', input.legacyUsername, 'viewers_data.json', '$.missions', 'legacy/11-missions-daily-audit.md', 'Permanent Missions are not physical yet.'),
    boss: fixedDomain('DEFERRED', input.legacyUsername, 'monthly_boss.json', '$', 'legacy/13-combat-audit.md R435/R441', 'Monthly Boss is not physical yet.'),
    twitchIdentity: fixedDomain('DEFERRED', input.legacyUsername, 'viewers_data.json', `$[${JSON.stringify(input.legacyUsername)}]`, 'v1-data-model.md — Identity', 'Auth IDs, email, passwords, sessions and tokens are never migrated by this pilot.'),
    pullHistory: fixedDomain('NOT_RECONSTRUCTIBLE', input.legacyUsername, 'viewers_data.json', '$.stats', 'legacy/02-current-player-model.md — Historique des Pulls', 'The legacy source cannot reconstruct ordered Pull results.'),
    bankHistory: fixedDomain('NOT_RECONSTRUCTIBLE', input.legacyUsername, 'viewers_data.json', '$.bank', 'legacy/09-banque-audit.md', 'Standalone bank history starts at cutover.'),
    wheelHistory: fixedDomain('NOT_RECONSTRUCTIBLE', input.legacyUsername, 'viewers_data.json', '$.dates.lastWheelDate', 'legacy/17-roue-quotidien-audit.md', 'Only last date and aggregate counters are known.'),
  }

  const summary = Object.fromEntries(migrationProposalStatuses.map((status) => [status, 0])) as Record<MigrationProposalStatus, number>
  for (const domain of Object.values(domains)) for (const field of Object.values(domain.fields)) summary[field.status] += 1
  return {
    mode: 'DRY_RUN',
    targetPlayerId: input.targetPlayerId,
    legacyUsername: input.legacyUsername,
    sourceFingerprint: input.bundle.fingerprint,
    sourceFiles: { discovered: Object.keys(input.bundle.files).sort(), missingExpected: input.bundle.missingExpectedFiles },
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    summary,
    domains,
    warnings,
  }
}

function playerDomain(profile: ObjectValue, context: Context): MigrationDomainReport {
  const element = normalizeElement(profile.element)
  return domain({
    legacyUsername: proposal(context, 'viewers_data.json', '$ key', 'v1-data-model.md §34', 'Bind the explicit legacy key to the explicit Player UUID.', context.legacyUsername, context.target.legacyUsername, { baseline: null }),
    elementKey: proposal(context, 'viewers_data.json', '$.element', 'legacy/02-current-player-model.md — element', 'Normalize the seven documented element labels.', element, context.target.elementKey, { baseline: null, ...(element ? {} : { status: 'INVALID_SOURCE' as const, reason: 'Missing or invalid legacy element.' }) }),
  })
}

function progressionDomain(profile: ObjectValue, context: Context): MigrationDomainReport {
  const standalone = objectAt(context.target.domains, 'progression')
  const xp = integerString(profile.xp)
  const level = integerString(profile.level)
  const derivedLevel = xp === null ? null : String(Math.min(100, Math.floor(Number(BigInt(xp) / 30n)) + 1))
  const mismatch = level !== null && derivedLevel !== null && level !== derivedLevel
  return domain({
    xp: numericProposal(context, '$.xp', 'legacy/04-xp-audit.md Q9', xp, standalone.xp),
    levelCheck: proposal(context, 'viewers_data.json', '$.level', 'legacy/04-xp-audit.md — migration XP', 'Compare stored level with the level derived from cumulative XP; do not repair silently.', level, derivedLevel, mismatch ? { status: 'MANUAL_REVIEW', reason: 'Legacy XP and level are inconsistent.' } : { status: level === null ? 'INVALID_SOURCE' : 'NOOP' }),
    totalMessages: numericProposal(context, '$.stats.totalMessages', 'legacy/04-xp-audit.md Q7', integerString(path(profile, 'stats.totalMessages')), standalone.totalMessages),
    countedMessages: numericProposal(context, '$.stats.countedMessages', 'legacy/04-xp-audit.md Q7', integerString(path(profile, 'stats.countedMessages')), standalone.countedMessages),
  }, mismatch ? ['XP_LEVEL_MISMATCH: requires human review.'] : undefined)
}

function resourcesDomain(profile: ObjectValue, context: Context): MigrationDomainReport {
  const standalone = objectAt(context.target.domains, 'resources')
  const fields: Record<string, MigrationProposal> = {
    primogems: numericProposal(context, '$.primogems', 'legacy/02-current-player-model.md — primogems', integerString(profile.primogems), standalone.primogems),
    moras: numericProposal(context, '$.moras', 'legacy/02-current-player-model.md — moras', integerString(profile.moras), standalone.moras),
  }
  for (const element of ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']) {
    fields[`particles_${element}`] = numericProposal(context, `$.particles.${element}`, 'legacy/05-element-resources-audit.md', integerString(path(profile, `particles.${element}`)), standalone[`particles_${element}`])
  }
  for (const stat of ['totalPrimosEarned', 'totalPrimosSpent', 'totalMorasEarned', 'totalMorasSpent', 'totalMainElementParticlesEarned']) {
    fields[stat] = numericProposal(context, `$.stats.${stat}`, 'legacy/02-current-player-model.md — statistiques économiques', integerString(path(profile, `stats.${stat}`)), standalone[stat])
  }
  return domain(fields)
}

function bankDomain(profile: ObjectValue, context: Context): MigrationDomainReport {
  const standalone = objectAt(context.target.domains, 'bank')
  return domain({
    balance: numericProposal(context, '$.bank.moras', 'legacy/09-banque-audit.md', integerString(path(profile, 'bank.moras')), standalone.balance),
    lastInterestDate: proposal(context, 'viewers_data.json', '$.bank.lastInterestDate', 'legacy/09-banque-audit.md', 'Keep as transition provenance; it is not the future scheduler authority.', jsonOrNull(path(profile, 'bank.lastInterestDate')), jsonOrNull(standalone.lastInterestDate), { status: path(profile, 'bank.lastInterestDate') === undefined ? 'INVALID_SOURCE' : 'MANUAL_REVIEW', reason: 'Cutover boundary must be reviewed.' }),
  })
}

function gachaDomain(profile: ObjectValue, context: Context): MigrationDomainReport {
  const standalone = objectAt(context.target.domains, 'gacha')
  const streak = integerString(first(profile, ['fiftyFiftyLostStreak', 'stats.fiftyFiftyLostStreak']))
  const fields: Record<string, MigrationProposal> = {}
  for (const [targetKey, paths] of Object.entries({ pity5: ['pity.pity5', 'pity5', 'pity5Star', 'fiveStarPity'], pity4: ['pity.pity4', 'pity4', 'pity4Star', 'fourStarPity'], totalPulls: ['stats.totalPulls', 'totalPulls'], totalFiveStars: ['stats.totalFiveStars'], totalFourStars: ['stats.totalFourStars'], fiftyFiftyWon: ['stats.fiftyFiftyWon'], fiftyFiftyLost: ['stats.fiftyFiftyLost'] })) {
    fields[targetKey] = numericProposal(context, `$.${paths.join('|')}`, 'legacy/06-gacha-invocation-audit.md', integerString(first(profile, paths)), standalone[targetKey])
  }
  const guaranteedFeatured5 = first(profile, ['guarantee.guaranteedFeatured5', 'guaranteedFeatured5'])
  fields.guaranteedFeatured5 = proposal(context, 'viewers_data.json', '$.guarantee.guaranteedFeatured5|$.guaranteedFeatured5', 'legacy/06-gacha-invocation-audit.md', 'Preserve the guarantee flag.', booleanOrNull(guaranteedFeatured5), jsonOrNull(standalone.guaranteedFeatured5), guaranteedFeatured5 === undefined ? { status: 'INVALID_SOURCE', reason: 'Missing guarantee flag.' } : { baseline: false })
  fields.fiftyFiftyLostStreak = numericProposal(context, '$.fiftyFiftyLostStreak', 'legacy/06-gacha-invocation-audit.md', streak, standalone.fiftyFiftyLostStreak)
  fields.captureProgress = numericProposal(context, '$.fiftyFiftyLostStreak', 'legacy/02-current-player-model.md — captureProgress', streak === null ? null : String(Math.min(3, Number(streak))), standalone.captureProgress)
  fields.capturesTriggered = proposal(context, 'viewers_data.json', '(no reliable legacy capture history)', 'legacy/02-current-player-model.md — capturesTriggered', 'Initialize the new aggregate to 0; an existing non-zero standalone value becomes a conflict and is never reset silently.', '0', jsonOrNull(standalone.capturesTriggered), { baseline: '0' })
  fields.selectedBannerCharacter = proposal(context, 'viewers_data.json', '$.selectedBannerCharacterId', 'legacy/06-gacha-invocation-audit.md', 'Keep only if it matches the active imported banner; otherwise clear without changing pity.', jsonOrNull(profile.selectedBannerCharacterId), jsonOrNull(standalone.selectedBannerCharacter), { status: profile.selectedBannerCharacterId === undefined ? 'INVALID_SOURCE' : 'MANUAL_REVIEW', reason: 'Active banner compatibility must be checked.' })
  return domain(fields)
}

function boxDomain(profile: ObjectValue, context: Context): MigrationDomainReport {
  const rawBox = profile.box
  const provenance = { sourceFile: 'viewers_data.json', sourcePath: '$.box + $.boxFavorites', legacyUsername: context.legacyUsername, auditRule: 'legacy/07-box-possession-obtention-audit.md R132/R135/R138/R143–R149', transformation: 'Resolve the character key, clamp constellation 0..6, set copies=max(copies,constellation+1), preserve valid firstObtainedAt and owned favorites.' }
  if (!isObject(rawBox)) return domain({ possessions: { status: 'INVALID_SOURCE', legacyValue: jsonOrNull(rawBox), standaloneValue: context.target.domains.box ?? null, proposedValue: null, provenance, reason: 'Missing or malformed legacy Box; no possession is invented.' } })

  const favorites = arrayAt(profile, 'boxFavorites').map(String)
  const normalized: JsonValue[] = []
  const invalidEntries: string[] = []
  for (const [key, raw] of Object.entries(rawBox)) {
    if (!isObject(raw)) { invalidEntries.push(key); continue }
    const characterExternalKey = typeof raw.characterId === 'string' && raw.characterId.trim() ? raw.characterId : key
    const constellationValue = integerNumber(raw.constellation)
    if (!characterExternalKey || constellationValue === null) { invalidEntries.push(key); continue }
    const constellation = clamp(constellationValue, 0, 6)
    const copies = Math.max(integerNumber(raw.copies) ?? 0, constellation + 1)
    normalized.push({ characterExternalKey, constellation, copies, firstObtainedAt: jsonOrNull(raw.firstObtainedAt), favorite: favorites.includes(key) })
  }
  if (invalidEntries.length > 0) return domain({ possessions: { status: 'INVALID_SOURCE', legacyValue: rawBox, standaloneValue: context.target.domains.box ?? null, proposedValue: null, provenance, reason: `Malformed Box entries require quarantine: ${invalidEntries.join(', ')}` } })
  const orphanFavorites = favorites.filter((favorite) => !(favorite in rawBox))
  return domain({ possessions: proposal(context, 'viewers_data.json', '$.box + $.boxFavorites', provenance.auditRule, provenance.transformation, normalized, context.target.domains.box ?? null, { baseline: [] }) }, orphanFavorites.length > 0 ? [`ORPHAN_BOX_FAVORITES: ${orphanFavorites.join(', ')}`] : undefined)
}

function teamsDomain(profile: ObjectValue, context: Context): MigrationDomainReport {
  const proposed = { activeLegacyTeam: jsonOrNull(profile.team), savedTeams: jsonOrNull(profile.savedTeams), baseSlots: 10 }
  return domain({ teams: proposal(context, 'viewers_data.json', '$.team + $.savedTeams', 'legacy/08-team-audit.md §18', 'Create ten base positions, deduplicate compositions conservatively, select the matching active composition, preserve valid savedAt.', proposed, context.target.domains.teams ?? null, { baseline: [] }) }, ['Ambiguous or invalid compositions require quarantine in a future apply lot.'])
}

function itemsDomain(profile: ObjectValue, context: Context): MigrationDomainReport {
  const standalone = objectAt(context.target.domains, 'items')
  const quantity = integerString(first(profile, ['masterlessStellaFortuna', 'stellaFortuna', 'specialItems.masterlessStellaFortuna', 'inventory.masterlessStellaFortuna', 'items.masterless_stella_fortuna']))
  return domain({ masterless_stella_fortuna: numericProposal(context, '$.(masterlessStellaFortuna|stellaFortuna|inventory|items)', 'legacy/10-sac-coffre-shop-audit.md — Stella', quantity, standalone.masterless_stella_fortuna) })
}

function wheelDomain(profile: ObjectValue, context: Context): MigrationDomainReport {
  const standalone = objectAt(context.target.domains, 'wheel')
  return domain({
    totalSpins: numericProposal(context, '$.stats.totalWheelSpins', 'legacy/17-roue-quotidien-audit.md R648/R28', integerString(path(profile, 'stats.totalWheelSpins')), standalone.totalSpins),
    totalJackpots: numericProposal(context, '$.stats.totalWheelJackpots', 'legacy/17-roue-quotidien-audit.md R649/R28', integerString(path(profile, 'stats.totalWheelJackpots')), standalone.totalJackpots),
    lastWheelDate: proposal(context, 'viewers_data.json', '$.dates.lastWheelDate', 'legacy/17-roue-quotidien-audit.md R28', 'Consume the cutover day only when it exactly matches the reviewed business date.', jsonOrNull(path(profile, 'dates.lastWheelDate')), jsonOrNull(standalone.lastWheelDate), { status: path(profile, 'dates.lastWheelDate') === undefined ? 'INVALID_SOURCE' : 'MANUAL_REVIEW', reason: 'Cutover boundary unresolved.' }),
  })
}

function combatDomain(profile: ObjectValue, context: Context): MigrationDomainReport {
  const standalone = objectAt(context.target.domains, 'combat')
  const fields: Record<string, MigrationProposal> = {}
  for (const key of ['totalCombatFights', 'totalCombatWins', 'totalCombatLosses', 'totalManualCombatWins']) fields[key] = numericProposal(context, `$.stats.${key}`, 'legacy/13-combat-audit.md R434', integerString(path(profile, `stats.${key}`)) ?? (key === 'totalManualCombatWins' ? '0' : null), standalone[key])
  fields.dailyState = proposal(context, 'viewers_data.json + combat_data.json', '$.dates.lastFightDate / $.dates.lastWinDate / $.combat', 'legacy/13-combat-audit.md R434', 'Preserve only state that exactly matches the reviewed Europe/Paris cutover day; new slots remain empty.', jsonOrNull({ lastFightDate: jsonOrNull(path(profile, 'dates.lastFightDate')), lastWinDate: jsonOrNull(path(profile, 'dates.lastWinDate')), lastResult: jsonOrNull(profile.lastCombatResult) }), jsonOrNull(standalone.dailyState), { status: 'MANUAL_REVIEW', reason: 'Cutover boundary unresolved.' })
  return domain(fields)
}

function expeditionDomain(profile: ObjectValue, context: Context): MigrationDomainReport {
  const standalone = objectAt(context.target.domains, 'expedition')
  return domain({
    totalCompleted: numericProposal(context, '$.stats.totalExpeditionsCompleted', 'legacy/12-expedition-audit.md R362', integerString(path(profile, 'stats.totalExpeditionsCompleted')), standalone.totalCompleted),
    activeState: proposal(context, 'viewers_data.json', '$.expedition', 'legacy/12-expedition-audit.md R353 + edge cases', 'Preserve a certain active character and timestamps; reconstruct readyAt only from reliable startedAt; never grant a reward.', jsonOrNull(profile.expedition), jsonOrNull(standalone.activeState), { status: profile.expedition === undefined ? 'INVALID_SOURCE' : 'MANUAL_REVIEW', reason: 'Character validity and cutover time require review.' }),
  })
}

function temporalDomain(profile: ObjectValue, context: Context, sourcePath: string, targetDomain: string, rule: string, transformation: string): MigrationDomainReport {
  const legacy = path(profile, sourcePath)
  return domain({ state: proposal(context, 'viewers_data.json', `$.${sourcePath}`, rule, transformation, jsonOrNull(legacy), context.target.domains[targetDomain] ?? null, { status: legacy === undefined ? 'INVALID_SOURCE' : 'MANUAL_REVIEW', reason: 'Cutover boundary unresolved.' }) })
}

function fixedDomain(status: MigrationProposalStatus, legacyUsername: string, sourceFile: string, sourcePath: string, auditRule: string, reason: string): MigrationDomainReport {
  return domain({ state: { status, legacyValue: null, standaloneValue: null, proposedValue: null, provenance: { sourceFile, sourcePath, legacyUsername, auditRule, transformation: 'No value is created in Phase 1.' }, reason } })
}

type Context = Readonly<{ legacyUsername: string; target: StandaloneMigrationTarget }>
function numericProposal(context: Context, sourcePath: string, rule: string, legacy: string | null, standalone: JsonValue | undefined): MigrationProposal {
  return proposal(context, 'viewers_data.json', sourcePath, rule, 'Preserve the exact non-negative integer as a decimal string.', legacy, jsonOrNull(standalone), legacy === null ? { status: 'INVALID_SOURCE', reason: 'Missing or invalid non-negative integer.' } : { baseline: '0' })
}
function proposal(context: Context, sourceFile: string, sourcePath: string, auditRule: string, transformation: string, legacyValue: JsonValue | null, standaloneValue: JsonValue | null, options: ProposalOptions = {}): MigrationProposal {
  let status = options.status
  if (!status) {
    if (equal(legacyValue, standaloneValue)) status = 'NOOP'
    else if (standaloneValue === null) status = 'CREATE'
    else if (options.baseline !== undefined && equal(standaloneValue, options.baseline)) status = 'UPDATE'
    else status = 'CONFLICT'
  }
  return { status, legacyValue, standaloneValue, proposedValue: legacyValue, provenance: { sourceFile, sourcePath, legacyUsername: context.legacyUsername, auditRule, transformation }, ...(options.reason ? { reason: options.reason } : {}) }
}
function domain(fields: Record<string, MigrationProposal>, notes?: readonly string[]): MigrationDomainReport {
  const status = aggregateStatus(Object.values(fields).map((field) => field.status))
  return { status, fields, ...(notes ? { notes } : {}) }
}
function aggregateStatus(statuses: readonly MigrationProposalStatus[]): MigrationProposalStatus {
  const precedence: readonly MigrationProposalStatus[] = ['INVALID_SOURCE', 'CONFLICT', 'MANUAL_REVIEW', 'DEFERRED', 'NOT_RECONSTRUCTIBLE', 'UPDATE', 'CREATE', 'NOOP']
  return precedence.find((status) => statuses.includes(status)) ?? 'NOOP'
}
function findLegacyProfile(root: JsonValue | undefined, username: string): ObjectValue | null {
  if (!isObject(root)) return null
  const viewers = isObject(root.viewers) ? root.viewers : root
  const profile = viewers[username]
  return isObject(profile) ? profile : null
}
function path(root: ObjectValue, dottedPath: string): JsonValue | undefined { let value: JsonValue | undefined = root; for (const key of dottedPath.split('.')) { if (!isObject(value)) return undefined; value = value[key] } return value }
function first(root: ObjectValue, paths: readonly string[]): JsonValue | undefined { for (const candidate of paths) { const value = path(root, candidate); if (value !== undefined && value !== null) return value } return undefined }
function objectAt(root: Readonly<Record<string, JsonValue | null>>, key: string): ObjectValue { const value = root[key]; return isObject(value) ? value : {} }
function arrayAt(root: ObjectValue, key: string): JsonValue[] { const value = path(root, key); return Array.isArray(value) ? value : [] }
function isObject(value: JsonValue | undefined): value is ObjectValue { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function integerString(value: JsonValue | undefined): string | null { if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value).toString(); if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value); return null }
function integerNumber(value: JsonValue | undefined): number | null { const normalized = integerString(value); if (normalized === null) return null; const number = Number(normalized); return Number.isSafeInteger(number) ? number : null }
function booleanOrNull(value: JsonValue | undefined): boolean | null { return typeof value === 'boolean' ? value : null }
function normalizeElement(value: JsonValue | undefined): string | null { return typeof value === 'string' ? elements.get(value.trim().toLocaleLowerCase('fr-FR')) ?? null : null }
function jsonOrNull(value: JsonValue | undefined): JsonValue | null { return value === undefined ? null : value }
function equal(left: JsonValue | null, right: JsonValue | null): boolean { return JSON.stringify(left) === JSON.stringify(right) }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)) }
