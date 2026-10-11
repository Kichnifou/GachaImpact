import { getBusinessDate } from '../../domain/time/business-date.js';
import { readFields, type CatalogFields, type Evidence } from './catalog-policy.js';

export const trackingElements = ['name', 'originalName', 'rarity', 'element', 'weapon', 'region', 'numericId', 'technicalName',
  'releaseDate', 'title', 'constellation', 'icon', 'splash', 'wish', 'fullbody', 'promotion'] as const;
export type TrackingElement = typeof trackingElements[number];
export type Followup = Readonly<{ trackingState: string; trackingElements: readonly string[]; fields: unknown }>;
export function isTracked(row: Followup) { return row.trackingState === 'ACTIVE' && row.trackingElements.length > 0; }
export function canCollect(row: Followup, element: string) {
  const evidence = readFields(row.fields)[element as keyof CatalogFields];
  return isTracked(row) && row.trackingElements.includes(element) && !evidence?.locked && !evidence?.override;
}
export function shouldStopAtRelease(characterId: string | null, fields: CatalogFields, now: Date, authorized = false) {
  const date = fields.releaseDate;
  const value = String(date?.value), parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  return !authorized && !!characterId && date?.reliability === 'OFFICIAL' && !!parsed && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value && value <= getBusinessDate(now);
}
export function editorialFingerprint(value: unknown): string {
  const stable = (item: unknown): unknown => Array.isArray(item) ? item.map(stable) : item && typeof item === 'object'
    ? Object.fromEntries(Object.entries(item).filter(([key,entry]) => key !== 'fetchedAt' && entry !== undefined).sort(([a],[b]) => a.localeCompare(b,'en')).map(([key,entry]) => [key,stable(entry)])) : item;
  return JSON.stringify(stable(value ?? null));
}
export function sameEditorialValue(left: Evidence | undefined, right: Evidence | undefined) {
  return editorialFingerprint(meaningfulEvidence(left)) === editorialFingerprint(meaningfulEvidence(right));
}
export function meaningfulEvidence(value: Evidence | undefined): unknown {
  if (!value) return null;
  return {value:value.value,reliability:value.reliability,conflict:!!value.conflict,locked:!!value.locked,
    qualification:value.qualification??null,
    adminValidated:!!value.adminValidated,override:!!value.override,editorialStatus:editorialState(value),
    alternatives:[...new Set((value.alternatives??[]).filter(item=>item.value!==value.value).map(item=>JSON.stringify({value:item.value,reliability:item.reliability})))].sort()};
}
export function editorialState(evidence: Evidence) {
  return evidence.editorialStatus ?? (evidence.reliability === 'PROVISIONAL' ? 'PROVISIONAL' : 'VALIDATED');
}
