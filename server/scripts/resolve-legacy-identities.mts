import { loadHistoricalOwnerPopulation } from '../src/application/migration/owner-approved-population.js';
import { loadLocalOperatorSnapshot } from '../src/application/migration/local-operator-snapshot.js';
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { loadLegacySnapshotDirectory } from '../src/application/migration/legacy-snapshot-directory.js';
import { resolveLegacyTwitchLogins } from '../src/application/migration/twitch-identity-resolver.js';
import { createVerifiedTwitchReport, identityResolutionLogins, parseIdentityResolutionArguments, loadHistoricalTwitchReport, type IdentityResolutionScope } from '../src/application/migration/verified-twitch-report.js';
import { checkedIdentityFile } from '../src/application/migration/local-identity-file.js';
import { collectHistoricalIdentityCandidates, readHistoricalChatEvidence, scanHistoricalTwitchReports } from '../src/application/migration/historical-twitch-evidence.js';

async function main() {
const { directory, output, prior: priorPath, canaryLogin, population, historicalIdentities, historicalSnapshot } = parseIdentityResolutionArguments(process.argv.slice(2));
const target = await checkedIdentityFile(output, true);
const clientId = process.env.TWITCH_CLIENT_ID ?? '', clientSecret = process.env.TWITCH_CLIENT_SECRET ?? '';
if (!clientId || !clientSecret) throw new Error('TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET required; no Twitch request sent.');
const snapshot = await loadLegacySnapshotDirectory(resolve(directory));
const scope: IdentityResolutionScope = population ? { kind: 'FINAL_POPULATION', population: await loadHistoricalOwnerPopulation(population, historicalIdentities!, await loadLocalOperatorSnapshot(historicalSnapshot!)) }
  : canaryLogin ? { kind: 'CANARY', legacyLogin: canaryLogin } : { kind: 'HISTORICAL_ELEMENT_REHEARSAL' };
const logins = identityResolutionLogins(snapshot, scope);
const prior = priorPath ? await loadHistoricalTwitchReport(priorPath) : null;
const reports = await scanHistoricalTwitchReports();
if (prior) reports.push(prior);
const direct = await resolveLegacyTwitchLogins(logins, { clientId, clientSecret });
let receipts = [] as Awaited<ReturnType<typeof readHistoricalChatEvidence>>;
if (direct.missing.length) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try { await client.connect(); receipts = await readHistoricalChatEvidence(client, direct.missing); }
  finally { await client.end(); }
}
// Also retain historical ID protection for logins that still resolve: a recycled login must not switch accounts.
const candidates = collectHistoricalIdentityCandidates(logins, reports, receipts);
const resolution = Object.keys(candidates.knownIds).length || candidates.conflicts.length
  ? await resolveLegacyTwitchLogins(logins, { clientId, clientSecret }, fetch, candidates.knownIds, candidates.conflicts)
  : direct;
const report = createVerifiedTwitchReport(snapshot, resolution, new Date(), scope);
await checkedIdentityFile(target, true);
await writeFile(target, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
process.stdout.write(JSON.stringify({ scope: scope.kind, resolved: report.users.length, missing: report.missing.length,
  conflicts: report.conflicts.length, duplicates: report.duplicates }) + '\n');

}
await main().catch(() => { process.stderr.write('TWITCH_RESOLUTION_FAILED; credentials and private details withheld.\n'); process.exitCode = 1; });
