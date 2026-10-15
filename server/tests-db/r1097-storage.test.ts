import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { expect, it } from 'vitest';
import { encodeIntentReads, decodeIntentReads } from '../src/application/twitch/twitch-intent-storage.js';
import { freezeCommandValue } from '../src/application/twitch/twitch-command-intent.js';
import { deriveActiveTeamGachaEffects } from '../src/domain/team/team-passives.js';
import type { ElementKey } from '../src/domain/economy/resources.js';
import type { Prisma } from '../generated/prisma/client.js';

it('measures synthetic before/after JSON, stored JSONB, physical tables and codec cost in a private schema', async () => {
  const isolated = isolatedBatchDatabase(), client = isolated.admin;
  try {
    await isolated.setup();
    await client.query('CREATE TABLE before_payloads (kind text, payload jsonb); CREATE TABLE after_payloads (kind text, payload jsonb)');
    await client.query('ALTER TABLE before_payloads ENABLE ROW LEVEL SECURITY; ALTER TABLE after_payloads ENABLE ROW LEVEL SECURITY; REVOKE ALL ON before_payloads, after_payloads FROM PUBLIC, anon, authenticated');
    const characters = Array.from({ length: 150 }, (_, i) => ({ id: `synthetic-character-${i}`, name: `Personnage ${i} Étoile`, rarity: i % 2 ? 4 : 5, elementKey: 'hydro', constellation: i % 7, copies: BigInt(i), firstObtainedAt: new Date('2026-10-01T00:00:00Z'), favorite: false }));
    const box = freezeCommandValue({ characters, summary: { totalOwned: 150, c6: 20 } });
    const samples: { name: string; reads: Record<string, Prisma.JsonValue[]>; responses: string[] }[] = [
      { name: 'short', reads: { 'socialService.actor': [freezeCommandValue({ id: 'synthetic', displayName: 'Exemple' })] }, responses: ['Bonjour'] },
      { name: 'box-large', reads: { 'getCurrentPlayerBox.execute': [box] }, responses: ['Box'] },
      { name: 'multiple-reads', reads: { 'getCurrentPlayerBox.execute': [box], 'getCharacters.execute': [box] }, responses: ['Équipe'] },
      { name: 'mutation', reads: { 'getCurrentPlayerBox.execute': [box] }, responses: ['Invocation'] },
      { name: 'no-extra-response', reads: {}, responses: [] },
      { name: 'segmented', reads: { 'getCurrentPlayerBox.execute': [box] }, responses: Array.from({ length: 12 }, (_, i) => `Segment ${i} ${'Étoile '.repeat(45)}`) },
    ];
    const measurements: object[] = [];
    for (const sample of samples) {
      const intent = { now: '2026-10-15T00:00:00Z', reads: sample.reads, memory: {}, ...(sample.name === 'mutation' ? { mutation: { path: 'performGachaPullChat.execute', args: [] } } : {}) };
      const envelope = { commandPilot: { version: 1, stage: 'RESPONSES', senderId: '123', replyParentMessageId: 'synthetic', responses: sample.responses.map(text => ({ text, status: 'SENT', messageId: randomUUID() })), intent } };
      const start = performance.now(); const encoded = encodeIntentReads(sample.reads);
      const encodeMs = performance.now() - start, decodeAt = performance.now();
      const decoded = decodeIntentReads(encoded);
      const decodedAt = performance.now();
      const decodeMs = decodedAt - decodeAt;
      expect(decoded).toEqual(sample.reads);
      const after = { ...envelope, commandPilot: { ...envelope.commandPilot, intent: { ...intent, reads: encoded } } };
      const beforeText = JSON.stringify(envelope), afterText = JSON.stringify(after);
      await client.query('INSERT INTO before_payloads SELECT $1, $2::jsonb FROM generate_series(1,100)', [sample.name, beforeText]);
      await client.query('INSERT INTO after_payloads SELECT $1, $2::jsonb FROM generate_series(1,100)', [sample.name, afterText]);
      const stored = (await client.query('SELECT (SELECT pg_column_size(payload) FROM before_payloads WHERE kind=$1 LIMIT 1) AS before, (SELECT pg_column_size(payload) FROM after_payloads WHERE kind=$1 LIMIT 1) AS after', [sample.name])).rows[0];
      const readBytes = Buffer.from(JSON.stringify(sample.reads));
      measurements.push({ name: `twitch-${sample.name}`, jsonBefore: Buffer.byteLength(beforeText), jsonAfter: Buffer.byteLength(afterText), storedJsonbBefore: stored.before, storedJsonbAfter: stored.after, encodeMs, decodeMs,
        algorithmsRawBase64Bytes: { gzip: gzipSync(readBytes).toString('base64').length, brotliQuality4: brotliCompressSync(readBytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }).toString('base64').length }, writesBefore: 1, writesAfter: 1, rowsBefore: 1, rowsAfter: 1 });
    }
    for (const elements of [[], ['hydro'], ['pyro', 'hydro', 'electro', 'dendro']] as ElementKey[][]) for (const count of [1, 10]) {
      const team = { teamId: elements.length ? 'synthetic-team' : null, elements, effects: deriveActiveTeamGachaEffects(elements) };
      const summary = { pullOperationId: 'synthetic-operation', pullCount: count, primogemCost: String(count * 160) };
      const snapshots = Array.from({ length: count }, (_, i) => ({ stateBefore: { pity5: i }, stateAfter: { pity5: i + 1 }, passiveEffects: [], bonusRewards: [], activeTeam: team }));
      const afterSnapshots = snapshots.map(({ activeTeam: _team, ...row }) => ({ ...row, snapshotVersion: 2, activeTeamRef: 'operation' }));
      const name = `gacha-x${count}-team${elements.length}`;
      const beforeParts = [summary, ...snapshots], afterParts = count === 1 ? beforeParts : [{ ...summary, gachaSnapshotVersion: 2, activeTeam: team }, ...afterSnapshots];
      for (let i = 0; i < beforeParts.length; i++) {
        await client.query('INSERT INTO before_payloads SELECT $1, $2::jsonb FROM generate_series(1,100)', [name, JSON.stringify(beforeParts[i])]);
        await client.query('INSERT INTO after_payloads SELECT $1, $2::jsonb FROM generate_series(1,100)', [name, JSON.stringify(afterParts[i])]);
      }
      const stored = (await client.query('SELECT (SELECT sum(pg_column_size(payload))/100 FROM before_payloads WHERE kind=$1) AS before, (SELECT sum(pg_column_size(payload))/100 FROM after_payloads WHERE kind=$1) AS after', [name])).rows[0];
      measurements.push({ name, jsonBefore: beforeParts.reduce((n, row) => n + Buffer.byteLength(JSON.stringify(row)), 0), jsonAfter: afterParts.reduce((n, row) => n + Buffer.byteLength(JSON.stringify(row)), 0), storedJsonbBefore: Number(stored.before), storedJsonbAfter: Number(stored.after), writesBefore: count + 1, writesAfter: count + 1, rowsBefore: count + 1, rowsAfter: count + 1 });
    }
    const physical = (await client.query("SELECT pg_total_relation_size('before_payloads')::int AS before, pg_total_relation_size('after_payloads')::int AS after")).rows[0];
    mkdirSync('../local-data/r1097', { recursive: true });
    writeFileSync('../local-data/r1097/storage-measures.json', JSON.stringify({ syntheticOnly: true, samples: measurements, physicalTables100Copies: physical }, null, 2));
    expect(physical.after).toBeLessThan(physical.before);
  } finally {
    await isolated.cleanup();
  }
}, 120_000);
