import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('local-only imported canary extension CLI', () => {
  it('exposes a distinct command that calls only the guarded extension owner', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(manifest.scripts['migration:legacy:canary:extend']).toBe('tsx scripts/extend-imported-canary.mts');
    const source = readFileSync('scripts/extend-imported-canary.mts', 'utf8');
    expect(source).toContain('.extendImportedCanary(');
    expect(source).toContain("schema[0]?.current_schema !== 'public'");
    expect(source).not.toContain('.configure(');
  });
  it.each([[], ['--mode', 'GLOBAL'], ['--schema', 'private'], ['--twitch-id', 'private_name']].map(args => ({ args })))
    ('rejects malformed input before resolving runtime configuration or connecting to PostgreSQL (%#)', ({ args }) => {
      const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/extend-imported-canary.mts', ...args], {
        encoding: 'utf8', env: { ...process.env, DOTENV_CONFIG_PATH: '__private_absent_env__', DATABASE_URL: '', DIRECT_URL: '' },
      });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr.trim()).toBe('IMPORTED_CANARY_EXTENSION_FAILED_CLOSED: contrôlez opérateur, ensemble existant, cible, import, autorité et confirmations.');
    });
});
