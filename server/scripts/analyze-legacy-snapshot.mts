import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadLegacySnapshotDirectory } from '../src/application/migration/legacy-snapshot-directory.js';
import { scanLegacyCoverage } from '../src/application/migration/legacy-coverage.js';
import { buildLegacyGlobalPlan, fixtureTwitchResolution } from '../src/application/migration/legacy-global-plan.js';

const directory = process.argv[2];
if (!directory) throw new Error('Usage: npm run migration:legacy:analyze -- <ignored-snapshot-directory>');
const snapshot = await loadLegacySnapshotDirectory(resolve(directory));
const report = scanLegacyCoverage(snapshot);
const catalog = JSON.parse(await readFile(new URL('../prisma/data/characters.json', import.meta.url), 'utf8')) as { externalKey: string }[];
const fixture = process.argv.includes('--fixture-identities');
const plan = buildLegacyGlobalPlan(snapshot, fixture ? fixtureTwitchResolution(snapshot) : [], [], new Set(catalog.map(row => row.externalKey)));
const issueCounts: Record<string, number> = {};
for (const issue of plan.issues) issueCounts[`${issue.severity}:${issue.code}`] = (issueCounts[`${issue.severity}:${issue.code}`] ?? 0) + 1;
process.stdout.write(`${JSON.stringify({ snapshotHash: snapshot.hash, coverage: report, plan: {
  identityMode: fixture ? 'ISOLATED_FIXTURE' : 'UNRESOLVED', selectedPlayers: plan.players.length,
  excludedProfiles: plan.excludedProfiles, friendshipCount: plan.friendshipCount, friendshipExcluded: plan.friendshipExcluded,
  requestCount: plan.requestCount, requestExcluded: plan.requestExcluded, issueCounts,
} }, null, 2)}\n`);
if (report.unknown.length || plan.issues.some(issue => issue.severity === 'BLOCKER')) process.exitCode = 2;
