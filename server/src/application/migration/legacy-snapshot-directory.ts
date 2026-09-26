import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseStreamerbotSnapshot, snapshotFileNames, type Snapshot } from './streamerbot-snapshot.js';

type Manifest = { files: { name: string; size: number; sha256: string }[] };

/** Reads only an operator-supplied frozen directory. Never opens the live Streamer.bot tree. */
export async function loadLegacySnapshotDirectory(directory: string): Promise<Snapshot> {
  const names = (await readdir(directory)).filter(name => name.endsWith('.json') && name !== 'report.json').sort();
  const expected = [...snapshotFileNames, 'manifest.json'].sort();
  if (names.length !== expected.length || names.some((name, index) => name !== expected[index]))
    throw new Error('Le dossier snapshot doit contenir exactement les 17 JSON et manifest.json.');
  const manifest = JSON.parse((await readFile(join(directory, 'manifest.json'), 'utf8')).replace(/^\uFEFF/, '')) as Manifest;
  if (!Array.isArray(manifest.files) || manifest.files.length !== snapshotFileNames.length)
    throw new Error('Manifest snapshot incomplet.');
  const declared = new Map(manifest.files.map(file => [file.name, file]));
  if (declared.size !== snapshotFileNames.length) throw new Error('Manifest snapshot dupliqué.');
  const files: Record<string, string> = {};
  for (const name of snapshotFileNames) {
    const bytes = await readFile(join(directory, name));
    const entry = declared.get(name);
    if (!entry || entry.size !== bytes.length || entry.sha256 !== createHash('sha256').update(bytes).digest('hex'))
      throw new Error(`Hash ou taille incorrecte : ${name}.`);
    files[name] = bytes.toString('utf8');
  }
  return parseStreamerbotSnapshot(files);
}
