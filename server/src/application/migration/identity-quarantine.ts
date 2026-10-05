import { z } from 'zod';
import { normalizeLegacyName } from './streamerbot-snapshot.js';
import { readLocalIdentityJson } from './local-identity-file.js';
import type { VerifiedTwitchReport } from './verified-twitch-report.js';

const schema = z.object({ version: z.literal(1), decision: z.literal('OWNER_APPROVED_IDENTITY_QUARANTINE'),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/), createdAt: z.iso.datetime(),
  legacyLogins: z.array(z.string().regex(/^[a-zA-Z0-9_]{1,25}$/)).min(1), reason: z.literal('TWITCH_IDENTITY_NOT_FOUND'),
}).strict().brand<'OwnerApprovedIdentityQuarantine'>();
export type IdentityQuarantine = z.infer<typeof schema>;

/** An explicit operator authorization, bound to the exact unresolved set; never a resolved identity. */
export function validateIdentityQuarantine(raw: unknown, snapshotHash: string,
  report: Pick<VerifiedTwitchReport, 'snapshotHash' | 'missing' | 'conflicts' | 'duplicates'>): IdentityQuarantine {
  const parsed = schema.safeParse(raw);
  if (!parsed.success || parsed.data.snapshotHash !== snapshotHash || report.snapshotHash !== snapshotHash ||
    report.conflicts.length || report.duplicates) throw new Error('IDENTITY_QUARANTINE_INVALID');
  const keys = parsed.data.legacyLogins.map(normalizeLegacyName), missing = report.missing.map(normalizeLegacyName);
  if (new Set(keys).size !== keys.length || new Set(missing).size !== missing.length ||
    keys.length !== missing.length || keys.some(key => !missing.includes(key))) throw new Error('IDENTITY_QUARANTINE_INVALID');
  return parsed.data;
}

export async function loadIdentityQuarantine(file: string, snapshotHash: string, report: VerifiedTwitchReport): Promise<IdentityQuarantine> {
  try { return validateIdentityQuarantine(await readLocalIdentityJson(file), snapshotHash, report); }
  catch { throw new Error('IDENTITY_QUARANTINE_UNUSABLE'); }
}
