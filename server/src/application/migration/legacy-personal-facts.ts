import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';
import { parseLegacyParisInstant } from './legacy-box-mapping.js';
import { projectLegacyFavorPeriod } from './legacy-favor-calendar.js';
import { mapLegacyXpProvenance } from './legacy-xp-provenance.js';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
import { parseLegacyElement } from './legacy-element.js';

export function legacyInstant(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const paris = parseLegacyParisInstant(value);
  if (paris) return paris;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) throw new Error('Invalid present legacy instant.');
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid present legacy instant.');
  return parsed;
}

export function legacyBusinessDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid present legacy business date.');
  const parsed = businessDateToDatabaseDate(value);
  if (parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid present legacy business date.');
  return parsed;
}

export function mapLegacyPersonalFacts(viewer: Record<string, unknown>, snapshotHash: string, cutoverAt: Date) {
  const { elementKey } = parseLegacyElement(viewer.element);
  const dates = object(viewer.dates);
  const firstSeenAt = legacyInstant(dates.firstSeen);
  const lastMessageAt = legacyInstant(dates.lastSeen);
  const xpProvenance = mapLegacyXpProvenance(dates.lastXpDate, legacyInstant(dates.lastMessageTime));
  const gachaLegacy = object(viewer.stats).lastPullWasFiveStar;
  const legacyLastPullWasFiveStar = typeof gachaLegacy === 'boolean' ? gachaLegacy : null;
  const options = object(viewer.options);
  const sortKey = ({ a: 'alphabetical', d: 'obtainedAt', c: 'constellation', e: 'element' } as Record<string, string>)[String(options.boxSort)] ?? 'alphabetical';
  const boxSort = { sortKey, direction: options.boxSortDescending === true ? 'desc' : 'asc' };
  const cutoverDate = getBusinessDate(cutoverAt);
  const favorSource = viewer.favor == null ? null : object(viewer.favor);
  let favor: { state: {
    activeFromDate: Date | null; activeUntilDate: Date | null; legacyObtainedDate: Date | null;
    legacyLastClaimDate: Date | null; legacyProvenance: { source: string; snapshotHash: string;
      cutoverBusinessDate: string; initialDaysRemaining: number; intervalBounds: 'inclusive' };
  }; claimDate: Date | null; daysRemaining: number } | null = null;
  if (favorSource) {
    const daysRemaining = favorSource.daysRemaining;
    if (typeof daysRemaining !== 'number' || !Number.isSafeInteger(daysRemaining)) throw new Error('Invalid legacy Faveur balance.');
    const obtainedDate = legacyBusinessDate(favorSource.obtainedDate);
    const lastClaimDate = legacyBusinessDate(favorSource.lastClaimDate);
    const period = projectLegacyFavorPeriod(daysRemaining, cutoverDate,
      obtainedDate?.toISOString().slice(0, 10) ?? null, lastClaimDate?.toISOString().slice(0, 10) ?? null);
    favor = { state: { ...period, legacyObtainedDate: obtainedDate, legacyLastClaimDate: lastClaimDate,
      legacyProvenance: { source: 'viewers_data.json.favor', snapshotHash, cutoverBusinessDate: cutoverDate,
        initialDaysRemaining: daysRemaining, intervalBounds: 'inclusive' } }, claimDate: lastClaimDate, daysRemaining };
  }
  return { elementKey, firstSeenAt, lastMessageAt, xpProvenance, legacyLastPullWasFiveStar, boxSort, favor };
}
