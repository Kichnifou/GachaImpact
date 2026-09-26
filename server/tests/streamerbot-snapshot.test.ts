import { describe, expect, it } from 'vitest';
import { parseStreamerbotSnapshot, resolveSnapshotViewer, snapshotFileNames, SnapshotParseError } from '../src/application/migration/streamerbot-snapshot.js';

const bundle = () => Object.fromEntries(snapshotFileNames.map(name => [name, name === 'monthly_events.json' ? '' : name === 'viewers_data.json' ? JSON.stringify({ KiChNiFoU: { xp: 12 } }) : '{}']));

describe('Streamer.bot snapshot bundle', () => {
  it('accepts the 17 files, including an empty monthly_events, and hashes deterministically', () => {
    const files = bundle();
    const one = parseStreamerbotSnapshot(files);
    expect(one.files).toBe(17);
    expect(one.hash).toBe(parseStreamerbotSnapshot(Object.fromEntries(Object.entries(files).reverse())).hash);
    expect(resolveSnapshotViewer(one, 'kichnifou').name).toBe('KiChNiFoU');
  });
  it('rejects missing, extra and invalid files without including their content in errors', () => {
    const missing = bundle(); delete missing['shop_items.json'];
    expect(() => parseStreamerbotSnapshot(missing)).toThrow(SnapshotParseError);
    const extra = { ...bundle(), 'secret.json': '{}' };
    expect(() => parseStreamerbotSnapshot(extra)).toThrow(SnapshotParseError);
    const invalid = { ...bundle(), 'gift_codes.json': '{PRIVATE_VALUE' };
    expect(() => parseStreamerbotSnapshot(invalid)).toThrow('gift_codes.json: JSON invalide.');
    expect(() => parseStreamerbotSnapshot(invalid)).not.toThrow('PRIVATE_VALUE');
  });
  it('rejects missing or ambiguous pilot viewers', () => {
    const absent = bundle(); absent['viewers_data.json'] = '{}';
    expect(() => resolveSnapshotViewer(parseStreamerbotSnapshot(absent), 'kichnifou')).toThrow('absent ou ambigu');
    const duplicate = bundle(); duplicate['viewers_data.json'] = JSON.stringify({ Kichnifou: {}, kichnifou: {} });
    expect(() => resolveSnapshotViewer(parseStreamerbotSnapshot(duplicate), 'kichnifou')).toThrow('absent ou ambigu');
  });
  it('changes the hash when content changes', () => {
    const first = bundle(); const second = { ...first, 'gift_codes.json': '{"codes":[]}' };
    expect(parseStreamerbotSnapshot(first).hash).not.toBe(parseStreamerbotSnapshot(second).hash);
  });
});
