import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { readFields } from './catalog-policy.js';

const date = z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value && value >= '2020-09-28';
});
export const releaseDatePlan = z.object({ version: z.literal(1), operation: z.literal('R1051_RELEASE_DATE_NULL_ONLY'),
  sourceUrl: z.literal('https://game8.co/games/Genshin-Impact/archives/307054'), fetchedAt: z.iso.datetime(), sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  entries: z.array(z.object({ id: z.uuid(), externalKey: z.string().min(1), name: z.string().min(1), rarity: z.union([z.literal(4),z.literal(5)]),
    element: z.enum(['pyro','hydro','cryo','electro','anemo','geo','dendro']), releaseDate: date })).max(150),
}).refine(plan => new Set(plan.entries.map(entry => entry.id)).size === plan.entries.length, 'Duplicate character');

/** One reviewed plan, one atomic NULL-only exception. No general follow-up unlock. */
export async function applyReleaseDatePlan(db: PrismaClient, input: unknown) {
  const plan = releaseDatePlan.parse(input);
  return db.$transaction(async tx => {
    let updated = 0, alreadyDated = 0;
    for (const entry of [...plan.entries].sort((a,b)=>a.id.localeCompare(b.id))) {
      const candidate = await tx.catalogCandidate.findUniqueOrThrow({ where: { characterId: entry.id } });
      await tx.$queryRaw`SELECT id FROM catalog_candidates WHERE id = ${candidate.id}::uuid FOR UPDATE`;
      const current = await tx.catalogCandidate.findUniqueOrThrow({ where: { id: candidate.id } });
      if (current.trackingState !== 'PROTECTED' || current.trackingElements.length) throw new Error('BACKFILL_REQUIRES_PROTECTED_CHARACTER');
      await tx.$queryRaw`SELECT id FROM characters WHERE id = ${entry.id}::uuid FOR UPDATE`;
      const character = await tx.character.findUniqueOrThrow({ where: { id: entry.id } });
      if (character.name !== entry.name || character.externalKey !== entry.externalKey || character.rarity !== entry.rarity || character.elementKey !== entry.element) throw new Error('BACKFILL_IDENTITY_CHANGED');
      if (character.releaseDate) { alreadyDated++; continue; }
      await tx.character.update({ where: { id: entry.id }, data: { releaseDate: new Date(`${entry.releaseDate}T00:00:00Z`) } });
      const fields = { ...readFields(current.fields), releaseDate: { value: entry.releaseDate, provider:'game8', url:plan.sourceUrl, fetchedAt:plan.fetchedAt,
        reliability:'STRUCTURED' as const, editorialStatus:'VALIDATED' as const, locked:true,
        reason:`Exception ponctuelle NULL-only R1051 : première disponibilité jouable. Plan examiné ; source SHA256 ${plan.sourceSha256}. Ne constitue pas une annonce officielle.` } };
      await tx.catalogCandidate.update({ where:{id:current.id}, data:{ fields:fields as Prisma.InputJsonValue,revision:{increment:1} } });
      updated++;
    }
    return { updated, alreadyDated, planned:plan.entries.length, characterFieldsChanged:['releaseDate','updatedAt'], trackingReopened:0 };
  }, {timeout:60_000});
}
