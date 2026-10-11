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
export function sameEditorialValue(left: Evidence | undefined, right: Evidence | undefined) {
  const stable = (value: Evidence | undefined) => value ? JSON.stringify({ ...value, fetchedAt: undefined, alternatives: value.alternatives?.map(item => ({ ...item, fetchedAt: undefined })) }) : null;
  return stable(left) === stable(right);
}
export function editorialState(evidence: Evidence) {
  return evidence.editorialStatus ?? (evidence.reliability === 'PROVISIONAL' ? 'PROVISIONAL' : 'VALIDATED');
}
