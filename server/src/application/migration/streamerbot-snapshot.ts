import { createHash } from 'node:crypto';

export const snapshotFileNames = [
  'banner_votes.json', 'c6_characters.json', 'combat_config.json', 'combat_data.json',
  'contests_data.json', 'element_passives.json', 'friendships_data.json',
  'genshin_characters.json', 'gift_codes.json', 'giveaway.json', 'long_missions.json',
  'missions_pool.json', 'monthly_boss.json', 'monthly_events.json',
  'monthly_events_data.json', 'shop_items.json', 'viewers_data.json',
] as const;

export type SnapshotFiles = Readonly<Record<string, string>>;
export type SnapshotIssue = Readonly<{ source: string; code: string; message: string }>;
export type Snapshot = Readonly<{ hash: string; sources: Readonly<Record<string, unknown>>; files: number }>;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export const normalizeLegacyName = (value: string) => value.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR');

export function parseStreamerbotSnapshot(files: SnapshotFiles): Snapshot {
  const actual = Object.keys(files).sort();
  const expected = [...snapshotFileNames].sort();
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) throw new SnapshotParseError([{ source: 'bundle', code: 'FILES', message: 'Les 17 noms de fichiers attendus doivent être fournis exactement une fois.' }]);
  const sources: Record<string, unknown> = {};
  const issues: SnapshotIssue[] = [];
  const digest = createHash('sha256');
  let totalBytes = 0;
  for (const name of expected) {
    const value = files[name];
    if (typeof value !== 'string') { issues.push({ source: name, code: 'FILE_TYPE', message: 'Contenu texte requis.' }); continue; }
    const bytes = Buffer.from(value, 'utf8');
    totalBytes += bytes.length;
    if (bytes.length > 4_000_000 || totalBytes > 8_000_000) throw new SnapshotParseError([{ source: 'bundle', code: 'SIZE', message: 'Snapshot trop volumineux.' }]);
    digest.update(name).update('\0').update(String(bytes.length)).update('\0').update(bytes);
    if (name === 'monthly_events.json' && !value.trim()) { sources[name] = null; continue; }
    try {
      const parsed: unknown = JSON.parse(value.replace(/^\uFEFF/, ''));
      if (!object(parsed)) issues.push({ source: name, code: 'STRUCTURE', message: 'Objet JSON attendu.' });
      else sources[name] = parsed;
    } catch { issues.push({ source: name, code: 'JSON', message: 'JSON invalide.' }); }
  }
  if (issues.length) throw new SnapshotParseError(issues);
  const viewers = sources['viewers_data.json'];
  if (!object(viewers)) throw new SnapshotParseError([{ source: 'viewers_data.json', code: 'STRUCTURE', message: 'Index des viewers invalide.' }]);
  return { hash: digest.digest('hex'), sources, files: expected.length };
}

export function resolveSnapshotViewer(snapshot: Snapshot, login: string) {
  const viewers = snapshot.sources['viewers_data.json'] as Record<string, unknown>;
  const candidates = Object.entries(viewers).filter(([name]) => normalizeLegacyName(name) === normalizeLegacyName(login));
  if (candidates.length !== 1 || !object(candidates[0]![1])) throw new SnapshotParseError([{
    source: 'viewers_data.json', code: candidates.length ? 'VIEWER_AMBIGUOUS' : 'VIEWER_MISSING', message: 'Viewer pilote absent ou ambigu.',
  }]);
  return { name: candidates[0]![0], data: candidates[0]![1] as Record<string, unknown> };
}

export class SnapshotParseError extends Error {
  constructor(readonly issues: readonly SnapshotIssue[]) { super(issues.map(issue => `${issue.source}: ${issue.message}`).join(' ')); this.name = 'SnapshotParseError'; }
}
