import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type pg from 'pg';
import { z } from 'zod';
import { identityReportDirectory } from './local-identity-file.js';
import { loadHistoricalTwitchReport, type VerifiedTwitchReport } from './verified-twitch-report.js';
import { normalizeLegacyName } from './streamerbot-snapshot.js';

export type IdentityEvidence = { legacyLogin: string; twitchUserId: string };

/** Invalid discovered files are not evidence. An explicitly supplied prior file must pass the loader. */
export async function scanHistoricalTwitchReports(): Promise<VerifiedTwitchReport[]> {
  const root = identityReportDirectory();
  const reports: VerifiedTwitchReport[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.name.endsWith('.json')) continue;
    try { reports.push(await loadHistoricalTwitchReport(resolve(root, entry.name))); }
    catch { /* No path, JSON or identity details in logs. */ }
  }
  return reports;
}

export function collectHistoricalIdentityCandidates(
  logins: readonly string[], reports: readonly VerifiedTwitchReport[], receipts: readonly IdentityEvidence[] = [],
) {
  const knownIds = new Map<string, string>();
  const conflicts: string[] = [];
  for (const login of logins) {
    const key = normalizeLegacyName(login);
    const ids = new Set([...reports.flatMap(report => report.users), ...receipts]
      .filter(row => normalizeLegacyName(row.legacyLogin) === key).map(row => row.twitchUserId));
    if (ids.size === 1) knownIds.set(key, [...ids][0]!);
    else if (ids.size > 1) conflicts.push(login);
  }
  return { knownIds: Object.fromEntries(knownIds), conflicts };
}

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const observedChat = z.object({
  externalEventId: z.string().trim().min(1).max(256), eventType: z.literal('channel.chat.message'),
  twitchUserId: z.string().regex(/^[1-9][0-9]*$/),
  login: z.string().regex(/^[a-zA-Z0-9_]{1,25}$/), displayName: z.string().trim().min(1).max(128).nullable(),
  sourceTimestamp: z.iso.datetime(), contentHash: digest, transportPayloadHash: digest,
}).strict();
export type HistoricalChatReceipt = {
  externalEventId: string; eventType: string; twitchUserId: string | null;
  payloadHash: string | null; payloadMinimal: unknown;
};

/** The sole production Chat writer is the observer reached after EventSub HMAC validation.
 * Require its complete normalized transport observation and hash, not an arbitrary login/ID row.
 * These hashes check stored integrity; the reviewed writer/DB boundary supplies webhook authenticity.
 */
export function verifiedChatReceiptEvidence(receipts: readonly HistoricalChatReceipt[]): IdentityEvidence[] {
  return receipts.flatMap(receipt => {
    if (receipt.eventType !== 'channel.chat.message' || !receipt.twitchUserId) return [];
    const parsed = observedChat.safeParse(receipt.payloadMinimal);
    if (!parsed.success) return [];
    const event = parsed.data;
    // Reconstruct observer property order: PostgreSQL JSONB does not retain it.
    const normalized = { externalEventId: event.externalEventId, eventType: event.eventType,
      twitchUserId: event.twitchUserId, login: event.login, displayName: event.displayName,
      sourceTimestamp: event.sourceTimestamp, contentHash: event.contentHash, transportPayloadHash: event.transportPayloadHash };
    if (event.externalEventId !== receipt.externalEventId || event.twitchUserId !== receipt.twitchUserId ||
      createHash('sha256').update(JSON.stringify(normalized)).digest('hex') !== receipt.payloadHash) return [];
    return [{ legacyLogin: event.login, twitchUserId: event.twitchUserId }];
  });
}

/** Read existing evidence only. Never invokes the observer, retention, consumers or other Twitch APIs. */
export async function readHistoricalChatEvidence(client: pg.Client, logins: readonly string[]): Promise<IdentityEvidence[]> {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const rows = (await client.query<HistoricalChatReceipt>(`SELECT external_event_id AS "externalEventId",
      event_type AS "eventType", twitch_user_id AS "twitchUserId", payload_hash AS "payloadHash", payload_minimal AS "payloadMinimal"
      FROM public.twitch_event_receipts WHERE event_type = 'channel.chat.message' AND twitch_user_id IS NOT NULL
        AND lower(btrim(payload_minimal->>'login')) = ANY($1::text[])`, [logins.map(normalizeLegacyName)])).rows;
    const evidence = verifiedChatReceiptEvidence(rows);
    await client.query('COMMIT');
    return evidence;
  } catch { await client.query('ROLLBACK'); throw new Error('TWITCH_RECEIPT_READ_FAILED'); }
}
