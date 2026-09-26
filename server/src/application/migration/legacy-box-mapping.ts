type CatalogCharacter = Readonly<{ id: string; externalKey: string }>;
type LegacyBoxRow = Readonly<{
  characterId: string; constellation: number; copies: number; firstObtainedAt: Date; favorite: boolean;
  provenance: { source: string; legacyKey: string; firstObtainedAtFallback: boolean };
}>;
export type LegacyBoxMapping = Readonly<{ rows: readonly LegacyBoxRow[]; anomalies: readonly string[]; blockers: readonly string[] }>;
const parisTimestamp = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function parseLegacyParisInstant(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null;
  const [year, month, day, hour, minute, second] = value.match(/\d+/g)!.map(Number);
  const naive = Date.UTC(year!, month! - 1, day!, hour!, minute!, second!);
  const candidates = [1, 2].map(offset => new Date(naive - offset * 3_600_000))
    .filter(date => parisTimestamp.format(date).replace(',', '') === value);
  return candidates.length === 1 ? candidates[0]! : null;
}

export function mapLegacyBox(viewer: Record<string, unknown>, catalog: readonly CatalogCharacter[], cutoverAt: Date): LegacyBoxMapping {
  const source = record(viewer.box);
  if (!source) return { rows: [], anomalies: [], blockers: ['Box legacy absente ou illisible.'] };
  const characters = new Map(catalog.map(character => [character.externalKey, character.id]));
  const favorites = Array.isArray(viewer.boxFavorites) ? viewer.boxFavorites.map(String) : [];
  const favoriteSet = new Set(favorites);
  const rows: LegacyBoxRow[] = [];
  const anomalies: string[] = [];
  const blockers: string[] = [];
  for (const [key, raw] of Object.entries(source)) {
    const entry = record(raw);
    if (!entry || !/^\d+$/.test(key)) { blockers.push('Entrée Box ou clé legacy illisible.'); continue; }
    const candidateId = entry.characterId;
    if (candidateId != null && (!Number.isSafeInteger(candidateId) || Number(candidateId) < 0 || String(candidateId) !== key)) {
      blockers.push('Clé Box et characterId contradictoires.'); continue;
    }
    if (candidateId == null) anomalies.push('characterId récupéré depuis la clé Box.');
    const characterId = characters.get(`legacy:${key}`);
    if (!characterId) { blockers.push('Possession sans personnage catalogue : cible non matérialisable.'); continue; }
    if (typeof entry.constellation !== 'number' || !Number.isSafeInteger(entry.constellation) ||
        typeof entry.copies !== 'number' || !Number.isSafeInteger(entry.copies) || entry.copies < 0) {
      blockers.push('Constellation ou copies illisibles dans la Box.'); continue;
    }
    const constellation = Math.max(0, Math.min(6, entry.constellation));
    const copies = Math.max(entry.copies, constellation + 1);
    if (constellation !== entry.constellation || copies !== entry.copies) anomalies.push('Constellation ou copies corrigées selon R132/R145.');
    const firstObtainedAt = parseLegacyParisInstant(entry.firstObtainedAt);
    if (!firstObtainedAt) anomalies.push('Date de première obtention remplacée par la date de cutover (R135).');
    rows.push({ characterId, constellation, copies, firstObtainedAt: firstObtainedAt ?? cutoverAt,
      favorite: favoriteSet.has(key), provenance: { source: 'viewers_data.json', legacyKey: key, firstObtainedAtFallback: !firstObtainedAt } });
  }
  const orphans = favorites.filter(key => !(key in source));
  if (orphans.length) anomalies.push(`${orphans.length} favori(s) Box orphelin(s), sans possession créée.`);
  return { rows, anomalies, blockers };
}
