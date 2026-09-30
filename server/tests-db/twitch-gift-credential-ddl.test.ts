import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { giftKey } from '../tests/helpers/twitch-gift-fixture.js';
import { TwitchGiftCredentialCipher } from '../src/infrastructure/twitch/twitch-gift-credential-cipher.js';
const fixture = isolatedBatchDatabase(), { admin, schema } = fixture;
const folders = readdirSync('prisma/migrations', { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
beforeAll(() => fixture.setup({ prismaMigrations: true }), 180_000);
afterAll(() => fixture.cleanup(), 60_000);
describe('055 private Prisma migration and backend-only credential DDL', () => {
  it('records all versioned migrations and preserves the unmodified 055 checksum', async () => {
    const rows = (await admin.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;
    expect(rows).toHaveLength(folders.length); expect(rows.every(row => row.finished_at && !row.rolled_back_at)).toBe(true);
    const giftFolder = folders.find(name => name.includes('_055_'))!;
    expect(rows.find(row => row.migration_name === giftFolder)?.checksum).toBe(createHash('sha256').update(readFileSync(path.join('prisma/migrations', giftFolder, 'migration.sql'))).digest('hex'));
    expect(fixture.migrationStatus).toContain('Database schema is up to date');
  });
  it('has RLS, no policies or browser privileges, exact minimal columns and PK/unique/FK RESTRICT', async () => {
    const table = 'twitch_gift_supreme_credentials';
    expect((await admin.query('SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass', [`${schema}.${table}`])).rows[0].relrowsecurity).toBe(true);
    expect((await admin.query('SELECT * FROM pg_policies WHERE schemaname=$1 AND tablename=$2', [schema, table])).rows).toHaveLength(0);
    for (const role of ['anon', 'authenticated']) for (const permission of ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
      expect((await admin.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, `${schema}.${table}`, permission])).rows[0].allowed).toBe(false);
    const columns = (await admin.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position', [schema, table])).rows.map(row => row.column_name);
    expect(columns).toEqual(['player_id', 'twitch_user_id', 'encrypted_refresh_token', 'reward_id', 'scopes', 'revision', 'authorized_at', 'updated_at']);
    const constraints = (await admin.query('SELECT contype, confdeltype FROM pg_constraint WHERE conrelid=$1::regclass', [`${schema}.${table}`])).rows;
    expect(constraints.some(row => row.contype === 'p')).toBe(true); expect(constraints.some(row => row.contype === 'f' && row.confdeltype === 'r')).toBe(true);
    expect((await admin.query('SELECT count(*)::int AS count FROM pg_index WHERE indrelid=$1::regclass AND indisunique', [`${schema}.${table}`])).rows[0].count).toBe(2);
  });
  it('enforces cipher, scope, positive revision, bounded ID, unique identities and restricts player deletion', async () => {
    const id = randomUUID(); await admin.query('INSERT INTO players (id,display_name) VALUES ($1,$2)', [id, 'Private DDL Gift']);
    const cipher = new TwitchGiftCredentialCipher(giftKey).encrypt('private-refresh', id, '12345');
    const insert = (token: string, scopes: string, revision = 1, twitch = '12345', reward: string | null = null) => admin.query('INSERT INTO twitch_gift_supreme_credentials (player_id,twitch_user_id,encrypted_refresh_token,scopes,revision,reward_id) VALUES ($1,$2,$3,$4::jsonb,$5,$6)', [id, twitch, token, scopes, revision, reward]);
    const scopes = '["openid","channel:manage:redemptions","user:write:chat"]';
    for (const token of ['', 'plaintext-refresh', 'v1.bad.bad.bad']) await expect(insert(token, scopes)).rejects.toMatchObject({ code: '23514' });
    await expect(insert(cipher, '[]')).rejects.toMatchObject({ code: '23514' }); await expect(insert(cipher, '{}')).rejects.toMatchObject({ code: '23514' });
    await expect(insert(cipher, scopes, 0)).rejects.toMatchObject({ code: '23514' }); await expect(insert(cipher, scopes, 1, 'bad')).rejects.toMatchObject({ code: '23514' });
    await expect(insert(cipher, scopes, 1, '12345', '')).rejects.toMatchObject({ code: '23514' }); await insert(cipher, scopes);
    await expect(insert(cipher, scopes)).rejects.toMatchObject({ code: '23505' }); await expect(admin.query('DELETE FROM players WHERE id=$1', [id])).rejects.toMatchObject({ code: '23503' });
    const otherId = randomUUID(); await admin.query('INSERT INTO players (id,display_name) VALUES ($1,$2)', [otherId, 'Private DDL duplicate Twitch']);
    await expect(admin.query('INSERT INTO twitch_gift_supreme_credentials (player_id,twitch_user_id,encrypted_refresh_token,scopes) VALUES ($1,$2,$3,$4::jsonb)',
      [otherId, '12345', new TwitchGiftCredentialCipher(giftKey).encrypt('private-refresh', otherId, '12345'), scopes])).rejects.toMatchObject({ code: '23505' });
  });
});
