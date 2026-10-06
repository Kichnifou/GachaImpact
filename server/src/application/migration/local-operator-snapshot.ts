import { lstat } from 'node:fs/promises';
import { resolve, dirname, parse } from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshotFileNames } from './streamerbot-snapshot.js';
import { loadLegacySnapshotDirectory } from './legacy-snapshot-directory.js';

/** Frozen, ignored operator directory only; no links or tracked/raw source publication. */
export async function loadLocalOperatorSnapshot(directory: string) {
  const target = resolve(directory);
  for (let current = target; ; current = dirname(current)) {
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('SNAPSHOT_LOCAL_ONLY');
    if (current === parse(current).root) break;
  }
  for (const name of ['manifest.json', ...snapshotFileNames]) {
    const file = resolve(target, name), stat = await lstat(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('SNAPSHOT_LOCAL_ONLY');
    execFileSync('git', ['check-ignore', '--quiet', '--', file], { stdio: 'ignore' });
  }
  return loadLegacySnapshotDirectory(target);
}
