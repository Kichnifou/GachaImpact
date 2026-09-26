import { parseLegacyParisInstant } from './legacy-box-mapping.js';

type Possession = Readonly<{ characterId: string; provenance: { legacyKey: string } }>;
export type TeamSlot = Readonly<{ position: number; name: string | null; isActive: boolean; isBaseSlot: boolean; legacySavedAt: Date | null; members: readonly string[] }>;
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function mapLegacyTeams(viewer: Record<string, unknown>, box: readonly Possession[]) {
  const byLegacyId = new Map(box.map(row => [row.provenance.legacyKey, row.characterId]));
  const anomalies: string[] = [];
  const blockers: string[] = [];
  const resolve = (value: unknown, label: string): string[] | null => {
    if (!Array.isArray(value) || value.length > 4) { blockers.push(`${label} : composition illisible.`); return null; }
    const members: string[] = [];
    for (const legacyId of value) {
      if (typeof legacyId !== 'number' || !Number.isSafeInteger(legacyId)) { blockers.push(`${label} : ID personnage invalide.`); return null; }
      const characterId = byLegacyId.get(String(legacyId));
      if (!characterId || members.includes(characterId)) { blockers.push(`${label} : personnage non possédé ou doublon.`); return null; }
      members.push(characterId);
    }
    return members;
  };
  const slots: TeamSlot[] = Array.from({ length: 10 }, (_, index) => ({ position: index + 1, name: null, isActive: false, isBaseSlot: true, legacySavedAt: null, members: [] }));
  const source = record(viewer.savedTeams);
  if (!source) blockers.push('savedTeams absent ou illisible.');
  const seen = new Set<string>();
  for (const [key, raw] of Object.entries(source ?? {}).sort(([a], [b]) => Number(a) - Number(b))) {
    const position = Number(key);
    const entry = record(raw);
    if (!Number.isSafeInteger(position) || position < 1 || position > 10 || !entry) { blockers.push('Position ou entrée Saved Team invalide.'); continue; }
    const members = resolve(entry.characters, `Saved Team ${position}`);
    if (!members) continue;
    const composition = [...members].sort().join('|');
    if (members.length && seen.has(composition)) { anomalies.push('Saved Teams doublonnées : position historique la plus basse conservée.'); continue; }
    if (members.length) seen.add(composition);
    const savedAt = parseLegacyParisInstant(entry.savedAt);
    if (entry.savedAt && !savedAt) anomalies.push('Date Saved Team invalide, métadonnée écartée.');
    slots[position - 1] = { position, name: typeof entry.name === 'string' ? entry.name.slice(0, 120) : null,
      isActive: false, isBaseSlot: true, legacySavedAt: savedAt, members };
  }
  const activeMembers = resolve(viewer.team, 'Team active');
  if (activeMembers) {
    const same = slots.findIndex(slot => slot.members.length === activeMembers.length &&
      slot.members.length > 0 && [...slot.members].sort().join('|') === [...activeMembers].sort().join('|'));
    let activeIndex = same;
    if (same >= 0) slots[same] = { ...slots[same]!, members: activeMembers };
    else {
      activeIndex = slots.findIndex(slot => slot.members.length === 0);
      if (activeIndex < 0) { activeIndex = slots.length; slots.push({ position: slots.length + 1, name: null, isActive: false, isBaseSlot: false, legacySavedAt: null, members: activeMembers }); }
      else slots[activeIndex] = { ...slots[activeIndex]!, members: activeMembers };
    }
    slots[activeIndex] = { ...slots[activeIndex]!, isActive: true };
  }
  return { slots, anomalies, blockers };
}
