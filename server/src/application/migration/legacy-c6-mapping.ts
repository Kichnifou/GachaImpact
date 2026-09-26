import { normalizeLegacyName } from './streamerbot-snapshot.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';

const themes = ['strength', 'intelligence', 'beauty', 'charisma', 'popularity'] as const;
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const count = (value: unknown): bigint | null => value == null ? 0n : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
function titleFloor(value: unknown): number | null {
  if (value == null || value === '') return 0;
  if (typeof value !== 'string') return null;
  const text = normalizeLegacyName(value);
  if (text.includes('platine')) return 4;
  if (text.includes('argent')) return 2;
  if (text.includes('bronze')) return 1;
  if (/(^|\W)or(\W|$)/.test(text)) return 3;
  return null;
}
type BoxPossession = Readonly<{ characterId: string; constellation: number; provenance: { legacyKey: string } }>;
type Character = Readonly<{ id: string; rarity: number }>;
export function mapLegacyC6(rawSource: unknown, login: string, box: readonly BoxPossession[], catalog: readonly Character[]) {
  const source = record(rawSource);
  const candidates = Object.entries(source ?? {}).filter(([name]) => normalizeLegacyName(name) === normalizeLegacyName(login));
  const blockers: string[] = [];
  const anomalies: string[] = [];
  if (candidates.length !== 1) blockers.push('Entrée C6 du viewer absente ou ambiguë.');
  const entries = record(record(candidates[0]?.[1])?.characters) ?? {};
  const rarity = new Map(catalog.map(character => [character.id, character.rarity]));
  const rows: Record<string, bigint | number | string | Date>[] = [];
  for (const possession of box) {
    if (possession.constellation !== 6 || rarity.get(possession.characterId) !== 5) continue;
    const entry = record(entries[possession.provenance.legacyKey]);
    if (!entry) { blockers.push('Possession 5★ C6 sans progression spécialisée ; date de déblocage inconnue.'); continue; }
    if (entry.characterId != null && String(entry.characterId) !== possession.provenance.legacyKey) {
      blockers.push('Identifiant C6 contradictoire avec la Box.'); continue;
    }
    const unlockedAt = parseLegacyParisInstant(entry.createdAt);
    if (!unlockedAt) { blockers.push('Date de déblocage C6 absente ou ambiguë ; colonne physique non nullable.'); continue; }
    const stats = record(entry.stats) ?? {};
    const contestStats = record(entry.contestStats) ?? {};
    const titles = record(entry.titles) ?? {};
    const row: Record<string, bigint | number | string | Date> = { characterId: possession.characterId, unlockedAt };
    let valid = true;
    for (const theme of themes) {
      const value = stats[theme];
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) { blockers.push('Statistique C6 illisible.'); valid = false; break; }
      const corrected = Math.max(1, Math.min(20, value));
      if (corrected !== value) anomalies.push('Statistique C6 bornée à 1..20.');
      row[theme] = corrected;
      const participations = count(contestStats[`${theme}Contests`]);
      const wins = count(contestStats[`${theme}Wins`]);
      const floor = titleFloor(titles[theme]);
      if (participations == null || wins == null || floor == null) { blockers.push('Compteur ou titre C6 ambigu.'); valid = false; break; }
      row[`${theme}Participations`] = participations;
      row[`${theme}Wins`] = wins;
      row[`${theme}TitleFloor`] = floor;
    }
    const totalContests = count(contestStats.totalContests);
    const totalWins = count(contestStats.totalWins);
    if (totalContests == null || totalWins == null) { blockers.push('Total Concours C6 illisible.'); valid = false; }
    if (valid) rows.push({ ...row, totalContests: totalContests!, totalWins: totalWins! });
  }
  const known = new Set(box.map(possession => possession.provenance.legacyKey));
  const orphans = Object.keys(entries).filter(key => !known.has(key));
  if (orphans.length) anomalies.push(`${orphans.length} entrée(s) C6 sans possession Box certaine, mises en quarantaine.`);
  return { rows, blockers, anomalies };
}
