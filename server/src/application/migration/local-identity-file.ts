import { execFileSync } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import { dirname, parse, resolve, sep } from 'node:path';

export const identityReportDirectory = () => resolve('..', 'local-data', 'identity-resolutions');

/** Local operator evidence only. Reject links at every ancestor, traversal and tracked/nonignored files. */
export async function checkedIdentityFile(file: string, newFile = false): Promise<string> {
  try {
    const parts = file.split(/[\\/]+/);
    while (parts[0] === '.') parts.shift();
    // The documented command from server/ uses ../local-data; no other traversal is accepted.
    if (parts.includes('..') && !(parts[0] === '..' && parts[1] === 'local-data' && parts[2] === 'identity-resolutions'
      && parts.filter(part => part === '..').length === 1)) throw new Error();
    const root = identityReportDirectory(), target = resolve(file);
    if (!target.startsWith(root + sep) || !target.endsWith('.json')) throw new Error();
    let ancestor = dirname(target);
    for (;;) {
      const stat = await lstat(ancestor);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error();
      if (ancestor === parse(ancestor).root) break;
      ancestor = dirname(ancestor);
    }
    try {
      const stat = await lstat(target);
      if (newFile || stat.isSymbolicLink() || !stat.isFile()) throw new Error();
    } catch (error) {
      if (!(newFile && error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    execFileSync('git', ['check-ignore', '--quiet', '--', target], { stdio: 'ignore' });
    return target;
  } catch { throw new Error('TWITCH_REPORT_UNUSABLE'); }
}

export async function readLocalIdentityJson(file: string): Promise<unknown> {
  try { return JSON.parse(await readFile(await checkedIdentityFile(file), 'utf8')); }
  catch { throw new Error('TWITCH_REPORT_UNUSABLE'); }
}
