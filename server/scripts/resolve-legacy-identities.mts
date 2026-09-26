import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { loadLegacySnapshotDirectory } from '../src/application/migration/legacy-snapshot-directory.js';
import { resolveLegacyTwitchLogins } from '../src/application/migration/twitch-identity-resolver.js';
import { normalizeLegacyName } from '../src/application/migration/streamerbot-snapshot.js';

const directory = process.argv[2], output = process.argv[3];
if (!directory || !output) throw new Error('Usage: tsx scripts/resolve-legacy-identities.mts <ignored-snapshot-dir> <ignored-output.json> [prior-verified-ids.json]');
const root = resolve('..', 'local-data', 'identity-resolutions');
const target = resolve(output);
if (!target.startsWith(root + sep) || !target.endsWith('.json')) throw new Error('Identity resolution output must be a new JSON under ignored local-data/identity-resolutions.');
const clientId = process.env.TWITCH_CLIENT_ID ?? '', clientSecret = process.env.TWITCH_CLIENT_SECRET ?? '';
if (!clientId || !clientSecret) throw new Error('TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET required; no Twitch request sent.');
const snapshot = await loadLegacySnapshotDirectory(resolve(directory));
const viewers = snapshot.sources['viewers_data.json'] as Record<string, { element?: unknown }>;
const elements = new Set(['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']);
const logins = Object.entries(viewers).filter(([, row]) => elements.has(String(row?.element).toLowerCase())).map(([login]) => login);
const priorPath = process.argv[4];
let knownIds: Record<string, string> = {};
if (priorPath) {
  const verifiedPath = resolve(priorPath);
  if (!verifiedPath.startsWith(root + sep)) throw new Error('Previous verification must be an ignored local identity-resolution report.');
  const prior = JSON.parse(await readFile(verifiedPath, 'utf8')) as { users?: unknown };
  if (!Array.isArray(prior.users)) throw new Error('Previous verified identity report is invalid.');
  knownIds = Object.fromEntries(prior.users.map(raw => {
    const row = raw as Record<string, unknown>;
    if (typeof row.legacyLogin !== 'string' || typeof row.twitchUserId !== 'string' || !/^[0-9]+$/.test(row.twitchUserId))
      throw new Error('Previous verified identity row is invalid.');
    return [normalizeLegacyName(row.legacyLogin), row.twitchUserId];
  }));
  if (Object.keys(knownIds).length !== prior.users.length) throw new Error('Previous identity report contains duplicate legacy logins.');
}
const resolution = await resolveLegacyTwitchLogins(logins, { clientId, clientSecret }, fetch, knownIds);
await mkdir(root, { recursive: true });
await writeFile(target, JSON.stringify({ snapshotHash: snapshot.hash, resolvedAt: new Date().toISOString(), ...resolution }, null, 2), { flag: 'wx', mode: 0o600 });
process.stdout.write(JSON.stringify({ snapshotHash: snapshot.hash, eligible: logins.length, resolved: resolution.users.length,
  missing: resolution.missing.length, conflicts: resolution.conflicts.length, reportWrittenLocally: true }) + '\n');
