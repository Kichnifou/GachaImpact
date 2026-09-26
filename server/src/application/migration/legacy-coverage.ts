import { snapshotFileNames, type Snapshot } from './streamerbot-snapshot.js';
import { approvedLegacyPaths } from './legacy-coverage-paths.js';

export type CoverageDisposition = 'MIGRATED' | 'DERIVED' | 'V1_CONFIG_AUTHORITY' | 'CONDITIONAL_CUTOVER' |
  'INTENTIONALLY_DROPPED' | 'QUARANTINED' | 'RESIDUAL_NO_MECHANIC';
export type CoverageUnknown = { file: string; path: string };
export type CoverageReport = {
  files: number; observedPaths: number; classifiedPaths: number;
  byDisposition: Record<CoverageDisposition, number>; unknown: CoverageUnknown[];
  totalProfiles: number; selectedProfiles: number; excludedProfiles: number;
};

const validElements = new Set(['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']);
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

/** Only identity and catalog indexes known to be maps may use arbitrary keys. */
export function normalizeCoverageKey(file: string, parent: string, key: string): string {
  const dynamic =
    (file === 'viewers_data.json' && (parent === '' || [
      '*.box', '*.combat.characterWins', '*.combat.characterLosses', '*.combat.lostCharacters',
      '*.coffre', '*.longMissions.categories', '*.longMissions.z', '*.savedTeams',
    ].includes(parent))) ||
    (file === 'c6_characters.json' && (parent === '' || parent === '*.characters')) ||
    (file === 'friendships_data.json' && ['friendships', 'requests', 'friendships.*.lastHeartSent'].includes(parent)) ||
    (file === 'contests_data.json' && parent === 'dailyLocks') ||
    (file === 'banner_votes.json' && ['voters', 'votes'].includes(parent)) ||
    (file === 'monthly_boss.json' && ['players', 'participants', 'attacks', 'currentBoss.participants', 'history[].participants'].includes(parent)) ||
    (file === 'monthly_events_data.json' && (['participants', 'participants.*.daily', 'dailyWindows', 'messages'].includes(parent) || parent === 'collectionPurchases.*')) ||
    (file === 'giveaway.json' && ['participants', 'messageCounts'].includes(parent)) ||
    (file === 'shop_items.json' && parent === 'items') ||
    (file === 'element_passives.json' && /^elements\.(pyro|hydro|cryo|electro|anemo|geo|dendro)\.effects$/.test(parent) && /^\d+$/.test(key)) ||
    (file === 'monthly_events_data.json' && ((parent === 'gameB' || parent === 'dailyWindows.*') && /^\d{4}-\d{2}-\d{2}$/.test(key)
      || parent === 'collectionPurchases' && /^\d+$/.test(key)));
  return dynamic ? '*' : key;
}

/** Inspect object keys and array element shapes, including excluded R930 profiles. Values never enter the report. */
export function scanLegacyCoverage(snapshot: Snapshot): CoverageReport {
  const viewers = snapshot.sources['viewers_data.json'];
  if (!isRecord(viewers)) throw new Error('Index des profils invalide.');
  const approved = approvedLegacyPaths as Readonly<Record<string, Readonly<Record<string, CoverageDisposition>>>>;
  const byDisposition: CoverageReport['byDisposition'] = {
    MIGRATED: 0, DERIVED: 0, V1_CONFIG_AUTHORITY: 0, CONDITIONAL_CUTOVER: 0,
    INTENTIONALLY_DROPPED: 0, QUARANTINED: 0, RESIDUAL_NO_MECHANIC: 0,
  };
  const unknown = new Map<string, CoverageUnknown>();
  let observedPaths = 0;
  let classifiedPaths = 0;
  const observe = (file: string, path: string) => {
    observedPaths++;
    const disposition = approved[file]?.[path];
    if (disposition) { classifiedPaths++; byDisposition[disposition]++; }
    else unknown.set(`${file}\0${path}`, { file, path });
  };
  const visit = (file: string, value: unknown, parent: string, depth: number) => {
    if (depth > 32) throw new Error(`Structure trop profonde : ${file}.`);
    if (Array.isArray(value)) {
      observe(file, `${parent}[]`);
      for (const child of value) visit(file, child, `${parent}[]`, depth + 1);
    } else if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) {
        const normalized = normalizeCoverageKey(file, parent, key);
        const path = parent ? `${parent}.${normalized}` : normalized;
        observe(file, path);
        visit(file, child, path, depth + 1);
      }
    }
  };
  for (const file of snapshotFileNames) {
    if (!(file in snapshot.sources)) unknown.set(`${file}\0<missing>`, { file, path: '<missing>' });
    else if (snapshot.sources[file] === null) observe(file, '<empty>');
    else visit(file, snapshot.sources[file], '', 0);
  }
  const selectedProfiles = Object.values(viewers).filter(value => isRecord(value) && typeof value.element === 'string' && validElements.has(value.element.toLowerCase())).length;
  return { files: snapshot.files, observedPaths, classifiedPaths, byDisposition,
    unknown: [...unknown.values()].sort((a, b) => a.file.localeCompare(b.file) || a.path.localeCompare(b.path)),
    totalProfiles: Object.keys(viewers).length, selectedProfiles, excludedProfiles: Object.keys(viewers).length - selectedProfiles };
}
