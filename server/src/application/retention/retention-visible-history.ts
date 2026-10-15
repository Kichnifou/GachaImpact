import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import { retentionRules } from './retention-inventory.js';
import { retentionPolicies, type RetentionDomain } from './retention-policy.js';

export function retentionVisibilitySql(domain:RetentionDomain,now:Date):Prisma.Sql {
  const rule=retentionRules.find(value=>value.domain===domain)!;
  const date=rule.date.includes('(')?rule.date:`r.${rule.date}`;
  const expiry=Prisma.raw(retentionPolicies[domain]==='24 hours'?`${date} + interval '24 hours'`:`((${date} AT TIME ZONE 'Europe/Paris') + interval '${retentionPolicies[domain]}') AT TIME ZONE 'Europe/Paris'`);
  return Prisma.sql`(${Prisma.raw(date)} IS NULL OR NOT COALESCE(${Prisma.raw(rule.terminal??'TRUE')},FALSE) OR ${expiry} >= ${now}::timestamptz)`;
}

/** Ordinary consultation only. Replay, moderation and economic readers must keep the original tables. */
export async function retentionVisiblePage(
  database: PrismaClient | Prisma.TransactionClient, domain: RetentionDomain, where: Prisma.Sql,
  order: Prisma.Sql, skip: number, take: number, now: Date, includeTotal = true,
): Promise<{ ids: string[]; total: number }> {
  if (!Number.isInteger(skip) || skip < 0 || !Number.isInteger(take) || take < 1 || take > 1000)
    throw new RangeError('Invalid history window');
  const rule = retentionRules.find(value => value.domain === domain);
  if (!rule || rule.order) throw new Error('Unsupported history key');
  if (!includeTotal) {
    const rows = await database.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT r.id FROM ${Prisma.raw(rule.table)} r WHERE (${where})
        AND ${retentionVisibilitySql(domain,now)} ORDER BY ${order} OFFSET ${skip} LIMIT ${take}`);
    return { ids: rows.map(row => row.id), total: 0 };
  }
  const [result] = await database.$queryRaw<{ ids: string[]; total: bigint }[]>(Prisma.sql`
    WITH visible AS NOT MATERIALIZED (
      SELECT r.* FROM ${Prisma.raw(rule.table)} r WHERE (${where})
        AND ${retentionVisibilitySql(domain,now)}
    ), page AS (SELECT r.id FROM visible r ORDER BY ${order} OFFSET ${skip} LIMIT ${take})
    SELECT (SELECT count(*) FROM visible) AS total, COALESCE((SELECT array_agg(id::text) FROM page),'{}'::text[]) AS ids`);
  return { ids: result!.ids, total: Number(result!.total) };
}
