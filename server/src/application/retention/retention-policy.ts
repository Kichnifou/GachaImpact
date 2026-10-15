import { addBusinessDays, getBusinessDate, getBusinessMinuteAt } from '../../domain/time/business-date.js';

export type RetentionMode = 'DISABLED' | 'DRY_RUN';
export const retentionPolicies = {
  twitch_terminal: '30 days', twitch_passive: '24 hours', chat: '1 month', bank: '1 month', shop: '3 months',
  trades: '3 months', gift_codes: '1 month', event: '1 year', boss: '1 year', combat: '1 year', contest: '1 year',
  notifications: '1 year', gacha: '1 year', direct_messages: '1 year', arcade: '1 year', catalog: '3 months',
} as const;
export type RetentionDomain = keyof typeof retentionPolicies;
export type ExclusionReason = 'DURABLE_ECONOMIC_PROOF' | 'RECOVERY_EVENT_MIGRATION_PROOF' | 'ORIGINAL_GACHA_PROOF'
  | 'MODERATION_RELATION_PROOF' | 'DEDUPLICATION_PROOF' | 'CATALOG_PROVENANCE' | 'EXISTING_TTL_OWNER'
  | 'TERMINATION_NOT_PROVEN' | 'UNKNOWN_DATE' | 'EQUIVALENT_PROOF_NOT_QUALIFIED' | 'NO_AGE_POLICY';

export function cycleDue(now: Date): string | undefined {
  const day = getBusinessDate(now);
  return now.getTime() >= getBusinessMinuteAt(day, 240).getTime() ? day : undefined;
}
export function nextCycleAt(now: Date): Date {
  const day = getBusinessDate(now);
  const today = getBusinessMinuteAt(day, 240);
  return today > now ? today : getBusinessMinuteAt(addBusinessDays(day, 1), 240);
}
/** Expiration uses PostgreSQL calendar arithmetic on Paris wall time; equality is retained.
 * Passive TTL alone is elapsed hours. Missing dates never acquire an invented age. */
export function expirationSql(column: string, policy: typeof retentionPolicies[RetentionDomain]): string {
  return policy === '24 hours' ? `${column} + interval '24 hours' < $1::timestamptz`
    : `((${column} AT TIME ZONE 'Europe/Paris') + interval '${policy}') AT TIME ZONE 'Europe/Paris' < $1::timestamptz`;
}
export function capacityLevel(bytes: number): 0 | 250 | 350 | 400 {
  return bytes >= 400_000_000 ? 400 : bytes >= 350_000_000 ? 350 : bytes >= 250_000_000 ? 250 : 0;
}
export function classify(input: { hasPolicy: boolean; knownDate: boolean; expired: boolean; terminal: boolean; protected: boolean }) {
  if (!input.hasPolicy) return 'NO_POLICY';
  if (!input.terminal) return 'PROTECTED';
  if (!input.knownDate) return 'UNKNOWN';
  if (!input.expired) return 'WITHIN_RETENTION';
  return input.protected ? 'EXPIRED_PROTECTED' : 'EXPIRED_UNQUALIFIED';
}
