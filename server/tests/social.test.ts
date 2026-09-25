import { describe, expect, it } from 'vitest';
import { derivePresence, PRESENCE_AWAY_MS, PRESENCE_INACTIVE_MS, PRESENCE_CONNECTION_TIMEOUT_MS } from '../src/application/social/presence-service.js';
import { privacyDefaults } from '../src/application/social/privacy-service.js';
import { normalizePlayerSearch } from '../src/application/social/social-service.js';

const now = new Date('2026-09-20T12:00:00Z');
const session = (activityAge: number, heartbeatAge = 0, ended = false) => ({ lastActivityAt: new Date(+now - activityAge), lastHeartbeatAt: new Date(+now - heartbeatAge), endedAt: ended ? now : null });
describe('Social policies', () => {
  it('separates heartbeat, activity, ten-minute absence, two-hour inactivity and connection timeout', () => {
    expect(derivePresence([session(PRESENCE_AWAY_MS - 1)], now)).toBe('ONLINE');
    expect(derivePresence([session(PRESENCE_AWAY_MS)], now)).toBe('AWAY');
    expect(derivePresence([session(PRESENCE_INACTIVE_MS - 1)], now)).toBe('AWAY');
    expect(derivePresence([session(PRESENCE_INACTIVE_MS)], now)).toBe('OFFLINE');
    expect(derivePresence([session(0, PRESENCE_CONNECTION_TIMEOUT_MS)], now)).toBe('OFFLINE');
    expect(derivePresence([session(0, 0, true)], now)).toBe('OFFLINE');
    expect(derivePresence([session(0, 0, true), session(1000)], now)).toBe('ONLINE');
    expect(derivePresence([session(0, PRESENCE_CONNECTION_TIMEOUT_MS), session(PRESENCE_AWAY_MS)], now)).toBe('AWAY');
    expect(derivePresence([], now)).toBe('OFFLINE');
  });
  it('normalizes accents, case and contiguous substrings', () => {
    expect(normalizePlayerSearch('  ÉLiO  ')).toBe('elio');
    expect(normalizePlayerSearch('Jean Julien').includes(normalizePlayerSearch('éan Ju'))).toBe(true);
    expect(normalizePlayerSearch('Yelan').includes('ya')).toBe(false);
  });
  it('keeps R518 defaults and separate presence/last activity categories', () => {
    expect(Object.entries(privacyDefaults).filter(([,v]) => v === 'PUBLIC').map(([k]) => k)).toEqual(['ACTIVE_TEAM', 'BOX', 'COLLECTION', 'GENERAL_STATISTICS', 'MISSIONS', 'LAST_ACTIVITY', 'PITY_GUARANTEE', 'PRIVATE_MESSAGES', 'PRESENCE', 'CURRENCY_BALANCES', 'BANK']);
    expect(privacyDefaults.FRIEND_LIST).toBe('FRIENDS');
    expect(Object.values(privacyDefaults).filter(v => v === 'FRIENDS')).toHaveLength(7);
  });
});
