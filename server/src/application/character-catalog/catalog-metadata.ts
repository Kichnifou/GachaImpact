import { AppError } from '../../api/errors.js';
import type { Prisma } from '../../../generated/prisma/client.js';

export const catalogWeapons = ['Épée', 'Claymore', 'Lance', 'Arc', 'Catalyseur'] as const;
export function normalizeWeapon(value: string): string {
  const aliases: Record<string, string> = { sword: 'Épée', épée: 'Épée', claymore: 'Claymore', 'épée à deux mains': 'Claymore', polearm: 'Lance', lance: 'Lance', bow: 'Arc', arc: 'Arc', catalyst: 'Catalyseur', catalyseur: 'Catalyseur' };
  const normalized = aliases[value.normalize('NFKC').trim().toLocaleLowerCase('fr')];
  if (!normalized) throw new AppError('Choisir une arme du catalogue.', 400, 'CHARACTER_INVALID');
  return normalized;
}
export function optionalWeapon(value: unknown): string | null {
  if(typeof value!=='string')return null;
  try{return normalizeWeapon(value);}catch{return null;}
}
export function normalizeRegion(value: string): string {
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (!normalized || normalized.length > 100 || /[\p{Cc}\p{Cf}<>]/u.test(normalized)) throw new AppError('Région invalide.', 400, 'CHARACTER_INVALID');
  return normalized;
}
export async function catalogRegions(tx: Pick<Prisma.TransactionClient, '$queryRaw'>): Promise<string[]> {
  const rows = await tx.$queryRaw<{ value: string }[]>`SELECT region AS value FROM characters WHERE region IS NOT NULL UNION SELECT fields->'region'->>'value' AS value FROM catalog_candidates WHERE jsonb_typeof(fields->'region'->'value') = 'string'`;
  const values = new Map<string, string>();
  for (const row of rows.sort((a,b)=>a.value.localeCompare(b.value,'fr'))) {
    const value = row.value.normalize('NFKC').replace(/\s+/gu,' ').trim();
    if (value && !values.has(value.toLocaleLowerCase('fr'))) values.set(value.toLocaleLowerCase('fr'), value);
  }
  return [...values.values()].sort((a,b)=>a.localeCompare(b,'fr'));
}
export async function canonicalRegion(tx: Prisma.TransactionClient, value: string): Promise<string> {
  const normalized = normalizeRegion(value);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(10661011)`;
  return (await catalogRegions(tx)).find(region=>region.toLocaleLowerCase('fr')===normalized.toLocaleLowerCase('fr')) ?? normalized;
}
