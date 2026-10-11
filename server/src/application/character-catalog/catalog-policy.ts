import { addBusinessDays, getBusinessDate } from '../../domain/time/business-date.js';

export const assetRoles = ['icon', 'splash', 'wish', 'fullbody', 'promotion'] as const;
export type AssetRole = typeof assetRoles[number];
export type Evidence = Readonly<{ value: string | number; provider: string; url: string; fetchedAt: string;
  reliability: 'OFFICIAL' | 'STRUCTURED' | 'ADMIN' | 'PROVISIONAL'; override?: boolean; conflict?: boolean;
  editorialStatus?: 'PROVISIONAL' | 'VALIDATED'; locked?: boolean; adminValidated?: boolean; reason?: string; alternatives?: readonly Evidence[] }>;
export type CatalogFields = Partial<Record<'name' | 'originalName' | 'rarity' | 'element' | 'weapon' | 'region' |
  'numericId' | 'technicalName' | 'releaseDate' | 'title' | 'constellation' | 'classKey' | 'displayOrder', Evidence>>;
export type CatalogStatus = 'DETECTED' | 'INCOMPLETE' | 'OUT_OF_WINDOW' | 'CONFLICT' | 'ELIGIBLE' | 'PUBLISHED' | 'TEMPORARY_ERROR' | 'INTERVENTION';

export function readFields(value: unknown): CatalogFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as CatalogFields;
}
export function normalizedIdentity(value: string): string { return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' '); }

/** Higher-priority/ADMIN values survive provider outages and discrepancies. */
export function mergeEvidence(fields: CatalogFields, key: keyof CatalogFields, evidence: Evidence): CatalogFields {
  const previous = fields[key];
  if (previous?.override || previous?.locked) return fields;
  if (previous && previous.value !== evidence.value) {
    if (previous.reliability === 'PROVISIONAL' && evidence.reliability !== 'PROVISIONAL') return { ...fields, [key]: { ...evidence, conflict:true, alternatives:[previous,...(previous.alternatives??[])].slice(0,5) } };
    // Localised name and original name are separate fields, never fuzzy reconciled.
    return { ...fields, [key]: { ...previous, conflict: true, alternatives: [...(previous.alternatives ?? []).filter(item => item.provider !== evidence.provider || item.value !== evidence.value), evidence].slice(-5) } };
  }
  const promoted = previous?.reliability === 'PROVISIONAL' && evidence.reliability !== 'PROVISIONAL';
  if (previous && !promoted && (previous.provider !== evidence.provider || previous.url !== evidence.url || previous.reliability !== evidence.reliability)) {
    return { ...fields, [key]: {...previous,alternatives:[...(previous.alternatives??[]).filter(item=>item.provider!==evidence.provider||item.url!==evidence.url||item.value!==evidence.value),evidence].slice(-5)} };
  }
  return { ...fields, [key]: previous && !promoted ? { ...previous, fetchedAt: evidence.fetchedAt } : evidence };
}

export function eligibility(fields: CatalogFields, available: readonly string[], now: Date, overrideWindow = false) {
  const missing: string[] = [];
  if (!fields.originalName?.value && !fields.name?.value) missing.push('name');
  if (![4, 5].includes(Number(fields.rarity?.value))) missing.push('rarity');
  if (!['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].includes(String(fields.element?.value))) missing.push('element');
  // Every actual card/reveal needs an icon and a validated wide illustration;
  // the wish strip and distinct fullbody remain enrichable, with existing fallbacks.
  for (const role of ['icon', 'splash']) if (!available.includes(role)) missing.push(role);
  if (!/^1\d{7}$/.test(String(fields.numericId?.value))) missing.push('numericId');
  for (const field of ['name', 'originalName', 'rarity', 'element', 'numericId'] as const) {
    if (fields[field]?.reliability === 'PROVISIONAL') missing.push(`${field}Confirmation`);
  }
  const dateValue = String(fields.releaseDate?.value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? new Date(`${dateValue}T00:00:00Z`) : null;
  const officialDate = fields.releaseDate?.reliability === 'OFFICIAL' && date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateValue ? dateValue : null;
  if (!officialDate) missing.push('officialReleaseDate');
  const conflict = Object.values(fields).some(value => value?.conflict);
  const outOfWindow = officialDate !== null && officialDate > addBusinessDays(getBusinessDate(now), 7);
  const status: CatalogStatus = conflict ? 'CONFLICT' : missing.length ? 'INCOMPLETE' : outOfWindow && !overrideWindow ? 'OUT_OF_WINDOW' : 'ELIGIBLE';
  return { status, missing, officialDate };
}
