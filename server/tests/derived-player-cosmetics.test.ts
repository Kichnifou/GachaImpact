import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isDerivedPlayerCosmetic } from '../src/application/appearance/derived-player-cosmetics.js';
import { profileLevelTitleNames, profileLevelTitleThresholds } from '../src/application/appearance/profile-level-titles.js';
describe('explicit deterministic cosmetic families and canonical catalog', () => {
  it.each(profileLevelTitleThresholds)('classifies only the canonical PLAYER_LEVEL title %s', level => {
    const definition = { externalKey: `title-level-${level}`, type: 'TITLE', sourceCharacterId: null, unlockRule: { kind: 'PLAYER_LEVEL', level } };
    expect(isDerivedPlayerCosmetic(definition)).toBe(true);
    expect(isDerivedPlayerCosmetic({ ...definition, unlockRule: { kind: 'PLAYER_LEVEL', level: level + 1 } })).toBe(false);
    expect(isDerivedPlayerCosmetic({ ...definition, externalKey: 'future-title' })).toBe(false);
  });
  it('shares the exact permanent title catalog already shipped in migration 059', () => {
    const sql = readFileSync(new URL('../prisma/migrations/20261003160000_059_add_profile_level_titles/migration.sql', import.meta.url), 'utf8');
    profileLevelTitleThresholds.forEach((level, index) => expect(sql).toContain(`('title-level-${level}', 'TITLE', '${profileLevelTitleNames[index]}', '{"kind":"PLAYER_LEVEL","level":${level}}'`));
  });
  it('refuses future cosmetic families', () => expect(isDerivedPlayerCosmetic({ externalKey: 'future-avatar', type: 'AVATAR', sourceCharacterId: null, unlockRule: null })).toBe(false));
});
