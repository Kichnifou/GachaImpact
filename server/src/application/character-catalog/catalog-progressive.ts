import { addBusinessDays, getBusinessDate } from '../../domain/time/business-date.js';
import { type CatalogFields, type Evidence, normalizedIdentity } from './catalog-policy.js';
import { qualifyFields, evidenceTrail } from './catalog-consensus.js';

const elements = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'];
export function trustedEvidence(proof?: Evidence) {
  return !!proof && !proof.consensusSource?.withdrawn && (proof.reliability !== 'PROVISIONAL' || proof.qualification === 'PROVISIONAL_CONSENSUS');
}
export function unresolvedEvidence(proof?: Evidence) {
  if (!proof?.conflict || proof.override || proof.locked || proof.qualification === 'PROVISIONAL_CONSENSUS') return false;
  return proof.reliability === 'PROVISIONAL' || evidenceTrail(proof).some(other => other.value !== proof.value && other.reliability === proof.reliability);
}
export function progressiveEligibility(input: CatalogFields, now: Date) {
  const identity = normalizedIdentity(String(input.originalName?.value ?? input.name?.value ?? ''));
  const fields = qualifyFields(input, identity, now);
  const dateValue = String(fields.releaseDate?.value ?? '');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? new Date(`${dateValue}T00:00:00Z`) : null;
  const officialDate = fields.releaseDate?.reliability === 'OFFICIAL' && !unresolvedEvidence(fields.releaseDate) && date && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateValue ? dateValue : null;
  const playable = fields.playable?.reliability === 'OFFICIAL' && fields.playable.value === 'available' && !unresolvedEvidence(fields.playable);
  const inWindow = !!officialDate && officialDate <= addBusinessDays(getBusinessDate(now), 7);
  const publicVisible = inWindow || playable;
  // Actual availability opens preparation, but conflicting official dates need arbitration before activation.
  const availabilityConflict = !!playable && !!officialDate && officialDate > getBusinessDate(now);
  const missing: string[] = [];
  if (!identity || !trustedEvidence(fields.originalName ?? fields.name)) missing.push('stableIdentity');
  if (![4, 5].includes(Number(fields.rarity?.value))) missing.push('rarity');
  else if (!trustedEvidence(fields.rarity)) missing.push('rarityConfirmation');
  if (!elements.includes(String(fields.element?.value))) missing.push('element');
  else if (!trustedEvidence(fields.element)) missing.push('elementConfirmation');
  if (!officialDate && !playable) missing.push('availabilityEvidence');
  if (availabilityConflict) missing.push('availabilityConflict');
  const conflict = availabilityConflict || ['name', 'originalName', 'rarity', 'element', 'releaseDate', 'playable'].some(key => unresolvedEvidence(fields[key as keyof CatalogFields]));
  const status = conflict ? 'CONFLICT' : missing.length ? 'INCOMPLETE' : !publicVisible ? 'OUT_OF_WINDOW' : 'ELIGIBLE';
  return { fields, status, missing, officialDate, publicVisible, playable, availabilityConflict, identity } as const;
}

export type Preparation = Readonly<{ candidateId: string; name: string; status: 'PREPARATION'; releaseDate: string | null;
  rarity: 4 | 5 | null; elementKey: string | null; provisional: boolean; iconPath: string | null }>;
export function publicPreparation(row: { id: string; name: string; characterId: string | null; progressivePolicy: boolean; fields: unknown;
  assets: readonly { role: string; status: string; url: string | null }[] }, now: Date): Preparation | null {
  if (row.characterId || !row.progressivePolicy) return null;
  const state = progressiveEligibility(row.fields as CatalogFields, now);
  const name = state.fields.originalName ?? state.fields.name;
  // An announcement identity is required even when combat fields remain unknown.
  if (!state.publicVisible || !name || !trustedEvidence(name) || unresolvedEvidence(name)) return null;
  const rarity = trustedEvidence(state.fields.rarity) && !unresolvedEvidence(state.fields.rarity) && [4, 5].includes(Number(state.fields.rarity?.value)) ? Number(state.fields.rarity!.value) as 4 | 5 : null;
  const elementKey = trustedEvidence(state.fields.element) && !unresolvedEvidence(state.fields.element) && elements.includes(String(state.fields.element?.value)) ? String(state.fields.element!.value) : null;
  return { candidateId: row.id, name: String(trustedEvidence(state.fields.name)&&!unresolvedEvidence(state.fields.name)?state.fields.name!.value:name.value), status: 'PREPARATION', releaseDate: state.availabilityConflict ? null : state.officialDate,
    rarity, elementKey, provisional: Object.values(state.fields).some(proof => proof?.reliability === 'PROVISIONAL'),
    iconPath: row.assets.find(asset => asset.role === 'icon' && asset.status === 'AVAILABLE')?.url ?? null };
}

/** Current read-only policy, distinct from the last worker's persisted diagnosis. */
export function adminCandidateProjection<T extends { characterId:string|null; progressivePolicy:boolean; fields:unknown; status:string; missing:string[]; assets:readonly {role:string;status:string}[] }>(row:T,now:Date) {
  if(!row.progressivePolicy)return row;
  const state=progressiveEligibility(row.fields as CatalogFields,now);
  return {...row,fields:state.fields,status:row.characterId?'PUBLISHED':state.status,missing:row.characterId?[]:state.missing,
    lastCycleStatus:row.status,publicationStage:row.characterId?'ACTIVE':state.publicVisible?'PREPARATION':'PRIVATE',
    optionalMissing:[...['weapon','region','numericId'].filter(key=>!state.fields[key as keyof CatalogFields]),...['icon','splash','wish','fullbody'].filter(role=>!row.assets.some(asset=>asset.role===role&&asset.status==='AVAILABLE'))]};
}
