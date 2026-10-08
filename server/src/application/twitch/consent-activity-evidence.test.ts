import { describe, expect, it } from 'vitest';
import { consentTables, consentClassifications } from './consent-activity-evidence.js';
const row = { player_id: 'fixture', last_app_activity_at: '2026-10-08T13:00:00.123456+00:00', last_gameplay_activity_at: null, last_internal_chat_at: null, last_twitch_activity_at: null, updated_at: '2026-10-08T13:00:00.123456+00:00' };
const tables = (value: object) => ({ players: ['original raw player'], player_activity_state: [JSON.stringify(value)] });
describe('activity consent projection', () => {
  it('equates absent activity and a first application-only row without changing raw evidence', () => {
    const raw = tables(row), snapshot = JSON.stringify(raw);
    expect(consentTables(raw)).toEqual({ players: raw.players }); expect(JSON.stringify(raw)).toBe(snapshot);
    const known = { edge: 'player_activity_state(player_id)->players(id)', classification: 'OWNED_PERSONAL', count: '1' };
    const unknown = { ...known, edge: 'unknown_activity_fk(player_id)->players(id)' };
    expect(consentClassifications([known, unknown, { ...known, classification: 'SHARED_ACTIVE' }], raw)).toEqual([unknown, { ...known, classification: 'SHARED_ACTIVE' }]);
  });
  it.each(['last_gameplay_activity_at', 'last_internal_chat_at', 'last_twitch_activity_at'])('keeps significant %s and other tables timestamp changes visible', field => {
    const original = { ...row, [field]: row.last_app_activity_at };
    const technical = { ...original, last_app_activity_at: '2026-10-08T14:00:00+00:00', updated_at: '2026-10-08T14:00:00+00:00' };
    expect(consentTables(tables(technical))).toEqual(consentTables(tables(original)));
    expect(consentTables(tables({ ...technical, [field]: technical.last_app_activity_at }))).not.toEqual(consentTables(tables(original)));
    expect(consentTables({ ...tables(technical), friendships: ['changed updated_at'] }).friendships).toEqual(['changed updated_at']);
  });
  it.each([{ ...row, future_security_column: null }, { ...row, updated_at: '2026-10-08T13:00:00.123457+00:00' }, { ...row, last_gameplay_activity_at: '2026-10-08T13:00:00.123457+00:00' }, { ...row, last_app_activity_at: 'invalid' }])('fails closed for unknown shape or an unexplained timestamp', value => {
    expect(consentTables(tables(value))).toEqual(tables(value));
  });
});
