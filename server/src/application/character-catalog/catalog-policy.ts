import { addBusinessDays, getBusinessDate } from '../../domain/time/business-date.js';
import { evidenceTrail } from './catalog-consensus.js';
import { optionalWeapon } from './catalog-metadata.js';

export const assetRoles = ['icon', 'splash', 'wish', 'fullbody', 'promotion'] as const;
export type AssetRole = typeof assetRoles[number];
export type Evidence = Readonly<{ value: string | number; provider: string; url: string; fetchedAt: string;
  reliability: 'OFFICIAL' | 'STRUCTURED' | 'ADMIN' | 'PROVISIONAL'; override?: boolean; conflict?: boolean;
  editorialStatus?: 'PROVISIONAL' | 'VALIDATED'; locked?: boolean; adminValidated?: boolean; reason?: string; alternatives?: readonly Evidence[];
  qualification?: 'PROVISIONAL' | 'PROVISIONAL_CONSENSUS' | 'CONFLICT'; rawValue?: string | number;
  consensusSource?: Readonly<{ publisher: string; upstream?: string; identity: string; qualified: boolean; observedAt: string; withdrawn?: boolean }>;
  consensus?: Readonly<{ editors: number; supportingEditors: number; evaluatedAt: string }> }>;
export type CatalogFields = Partial<Record<'name' | 'originalName' | 'rarity' | 'element' | 'weapon' | 'region' |
  'numericId' | 'technicalName' | 'releaseDate' | 'playable' | 'title' | 'constellation' | 'classKey' | 'displayOrder', Evidence>>;
export type CatalogStatus = 'DETECTED' | 'INCOMPLETE' | 'OUT_OF_WINDOW' | 'CONFLICT' | 'ELIGIBLE' | 'PUBLISHED' | 'TEMPORARY_ERROR' | 'INTERVENTION';

export function readFields(value: unknown): CatalogFields {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as CatalogFields;
}
export function normalizedIdentity(value: string): string { return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' '); }

/** Higher-priority/ADMIN values survive provider outages and discrepancies. */
export function mergeEvidence(fields: CatalogFields, key: keyof CatalogFields, evidence: Evidence): CatalogFields {
  let previous = fields[key];
  if (previous?.override || previous?.locked) return fields;
  const canonical=(proof:Evidence):Evidence=>{
    const value=optionalWeapon(proof.value);
    return value&&value!==proof.value?{...proof,value,rawValue:proof.value,alternatives:proof.alternatives?.map(canonical)}:proof;
  };
  if(key==='weapon'){evidence=canonical(evidence);if(previous)previous=canonical(previous);}
  if (previous) {
    const trail = [...evidenceTrail(previous), ...evidenceTrail(evidence)];
    const rank = (proof: Evidence) => ({ ADMIN: 4, OFFICIAL: 3, STRUCTURED: 2, PROVISIONAL: 1 })[proof.reliability];
    const refreshed=previous.provider===evidence.provider&&previous.url===evidence.url&&previous.value===evidence.value&&evidence.fetchedAt>=previous.fetchedAt;
    const primary = rank(evidence) > rank(previous) || refreshed ? {...previous,...evidence} : previous;
    const alternatives = trail.filter(proof => !(proof.provider === primary.provider && proof.url === primary.url && proof.value === primary.value))
      .filter((proof, index, rows) => !rows.some((row,other) => row.provider === proof.provider && row.url === proof.url && row.value === proof.value && (row.fetchedAt > proof.fetchedAt || row.fetchedAt === proof.fetchedAt && other > index)));
    return { ...fields, [key]: { ...primary, fetchedAt: primary.provider === evidence.provider && primary.url === evidence.url && primary.value === evidence.value && evidence.fetchedAt>primary.fetchedAt ? evidence.fetchedAt : primary.fetchedAt,
      conflict: trail.some(proof => proof.value !== primary.value), alternatives } };
  }
  return { ...fields, [key]: evidence };
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
