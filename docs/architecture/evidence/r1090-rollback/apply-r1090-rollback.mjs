// Apply one independently qualified R1090 withdrawal from a clean checkout.
// This command stages a patch; it never commits, pushes or deploys.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const directory = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
const lot = manifest.results.find(entry => entry.name === process.argv[2]);
if (!lot) throw Error(`Choose one lot: ${manifest.results.map(entry => entry.name).join(', ')}`);
if (Object.values(lot.gates).some(value => value !== 0)) throw Error('This recipe has not passed every recorded gate');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
git('diff', '--quiet');
git('diff', '--cached', '--quiet');
// Documentation checkpoints may follow qualification; runtime deltas may not.
const laterFiles = git('diff', '--name-only', manifest.base, 'HEAD').trim().split(/\r?\n/).filter(Boolean);
if (laterFiles.some(file => !file.startsWith('docs/') && file !== 'AGENTS.md')) throw Error('Runtime changed since qualification: requalify before applying');
const patch = join(directory, lot.patch);
if (createHash('sha256').update(readFileSync(patch)).digest('hex') !== lot.patchSha256) throw Error('Rollback patch checksum mismatch');
git('apply', '--check', '--index', patch);
git('apply', '--index', patch);
console.log(`${lot.name} withdrawal staged. Inspect changes, run the manifest tests and compilation, then follow the review/main deployment workflow. Do not also revert its commits.`);
