// Run from a clean checkout: node <this-file> <LotName>
// Applies exactly one qualified rollback into the index; does not commit or push.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const directory = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(directory, 'independent-rollback-final.json'), 'utf8'));
const lot = manifest.results.find(entry => entry.name === process.argv[2]);
if (!lot) throw Error(`Choose one lot: ${manifest.results.map(entry => entry.name).join(', ')}`);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
git('diff', '--quiet');
git('diff', '--cached', '--quiet');
// Later documentation-only checkpoints are allowed. Runtime changes require requalification.
git('diff', '--quiet', manifest.base, 'HEAD', '--', 'src', 'server', 'package.json', 'package-lock.json', 'vite.config.ts');
const patch = join(directory, `rollback-${lot.name}-final.patch`);
const actual = createHash('sha256').update(readFileSync(patch)).digest('hex');
if (actual !== lot.patchSha256) throw Error('Rollback patch checksum mismatch');
git('apply', '--check', '--index', patch);
git('apply', '--index', patch);
console.log(`${lot.name} withdrawal staged. Inspect the diff, run its checks, commit and follow review/main deployment workflow. Do not also revert its commits.`);
