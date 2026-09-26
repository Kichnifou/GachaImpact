import { parseLegacyParisInstant } from './legacy-box-mapping.js';

const categoryPrefixes: Record<string, string> = {
  messages: 'messages', pulls: 'pulls', characters4: 'characters4', characters5: 'characters5',
  morasEarned: 'moras', mainParticlesEarned: 'main_particles', expeditions: 'expeditions',
  combatWins: 'combat_wins', friendHeartsSent: 'friend_hearts',
};
const ranks = ['B', 'A', 'S'] as const;
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
type MissionDefinition = Readonly<{ id: string; externalKey: string; metric: string; target: bigint; rank: 'B' | 'A' | 'S' | 'Z' }>;
type MissionRow = Readonly<{ definitionId: string; status: 'LOCKED' | 'ACTIVE' | 'COMPLETED'; progress: bigint;
  baselineValue: bigint; carriedProgress: bigint; startedAt: Date | null; completedAt: null; rewardedAt: null;
  legacyProvenance: { source: string; historicalCompletionAtKnown: false; historicalRewardOperationKnown: false } }>;
const nonnegative = (value: unknown): bigint | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
const min = (a: bigint, b: bigint) => a < b ? a : b;

export function mapLegacyPermanentMissions(viewer: Record<string, unknown>, definitions: readonly MissionDefinition[],
  authoritative: Readonly<Record<string, bigint>>, cutoverAt: Date) {
  const source = record(viewer.longMissions);
  const categories = record(source?.categories);
  const z = record(source?.z);
  const blockers: string[] = [];
  const anomalies: string[] = [];
  if (!source || !categories || !z || definitions.length !== 31) blockers.push('Structure ou catalogue des missions permanentes incomplet.');
  const byKey = new Map(definitions.map(definition => [definition.externalKey, definition]));
  const rows: MissionRow[] = [];
  for (const [category, prefix] of Object.entries(categoryPrefixes)) {
    const state = record(categories?.[category]);
    if (!state) { blockers.push(`Chaîne ${category} absente.`); continue; }
    const completed = Array.isArray(state.completedRanks) ? state.completedRanks.map(String) : null;
    const activeProgress = nonnegative(state.progress);
    if (!completed || activeProgress == null || typeof state.active !== 'boolean') { blockers.push(`Chaîne ${category} illisible.`); continue; }
    for (const rank of ranks) {
      const definition = byKey.get(`${prefix}_${rank.toLowerCase()}`);
      if (!definition) { blockers.push(`Définition ${category}/${rank} absente.`); continue; }
      const baselineValue = authoritative[definition.metric];
      if (baselineValue == null) { blockers.push(`Métrique ${definition.metric} indisponible.`); continue; }
      const done = completed.includes(rank);
      const active = !done && state.active === true && state.activeRank === rank;
      const progress = done ? definition.target : active ? min(definition.target, activeProgress) : 0n;
      rows.push({ definitionId: definition.id, status: done ? 'COMPLETED' : active ? 'ACTIVE' : 'LOCKED',
        progress, baselineValue, carriedProgress: progress, startedAt: active ? parseLegacyParisInstant(state.startedAt) ?? cutoverAt : null,
        completedAt: null, rewardedAt: null, legacyProvenance: { source: 'viewers_data.json.longMissions', historicalCompletionAtKnown: false, historicalRewardOperationKnown: false } });
    }
  }
  const unlocked = source?.unlockedZ === true;
  if (source && typeof source.unlockedZ !== 'boolean') blockers.push('État de déblocage Z illisible.');
  const zAcceptedAt: Date[] = [];
  for (const definition of definitions.filter(item => item.rank === 'Z')) {
    const state = record(z?.[definition.externalKey]);
    if (!state) { blockers.push(`Mission Z ${definition.externalKey} absente.`); continue; }
    const baselineValue = authoritative[definition.metric];
    const sourceProgress = nonnegative(state.progress);
    if (baselineValue == null || sourceProgress == null || typeof state.completed !== 'boolean' || typeof state.active !== 'boolean') {
      blockers.push(`Mission Z ${definition.externalKey} illisible.`); continue;
    }
    const acceptedAt = parseLegacyParisInstant(state.acceptedAt);
    if (acceptedAt) zAcceptedAt.push(acceptedAt);
    const done = unlocked && state.completed;
    const active = unlocked && !done && state.active;
    const progress = done ? definition.target : active ? min(definition.target, sourceProgress) : 0n;
    rows.push({ definitionId: definition.id, status: done ? 'COMPLETED' : active ? 'ACTIVE' : 'LOCKED',
      progress, baselineValue, carriedProgress: progress, startedAt: active ? acceptedAt ?? cutoverAt : null,
      completedAt: null, rewardedAt: null, legacyProvenance: { source: 'viewers_data.json.longMissions.z', historicalCompletionAtKnown: false, historicalRewardOperationKnown: false } });
  }
  if (rows.length !== 31) blockers.push('Toutes les 31 progressions physiques ne sont pas mappées.');
  if (unlocked && zAcceptedAt.length === 0) anomalies.push('Date de déblocage Z inconnue : cutover utilisé comme approximation technique.');
  return { rows, zUnlockedAt: unlocked ? zAcceptedAt.sort((a, b) => a.getTime() - b.getTime())[0] ?? cutoverAt : null,
    standaloneCatchupCompletedAt: cutoverAt, blockers, anomalies };
}
