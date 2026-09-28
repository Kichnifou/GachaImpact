import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/environment.js';

describe('loadConfig', () => {
  it('accepts an optional fixed HTTPS EventSub callback without requiring activation', () => {
    expect(loadConfig({ TWITCH_EVENTSUB_CALLBACK_URL: 'https://backend.example/api/v1/twitch/eventsub' }).twitchEventSub)
      .toMatchObject({ enabled: false, callbackUrl: 'https://backend.example/api/v1/twitch/eventsub' });
    for (const value of ['http://backend.example/api/v1/twitch/eventsub', 'https://backend.example/other', 'https://backend.example/api/v1/twitch/eventsub?q=x', 'https://backend.example/api/v1/twitch/eventsub#x', 'https://user:password@backend.example/api/v1/twitch/eventsub'])
      expect(() => loadConfig({ TWITCH_EVENTSUB_CALLBACK_URL: value })).toThrow('TWITCH_EVENTSUB_CALLBACK_URL');
  });
  it('uses local defaults without a database or Supabase project', () => {
    expect(loadConfig({})).toMatchObject({
      host: '127.0.0.1',
      port: 3001,
      frontendOrigin: 'http://localhost:5173',
      twitch: { pilotPlayerIds: [], pilotLogin: 'kichnifou' },
      twitchEventSub: { enabled: false },
    });
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: 'invalid' })).toThrow('Invalid server environment');
  });

  it('accepts the platform port, public bind address and HTTPS frontend origin', () => {
    expect(loadConfig({ HOST: '0.0.0.0', PORT: '8080', FRONTEND_ORIGIN: 'https://alpha.example.pages.dev' }))
      .toMatchObject({ host: '0.0.0.0', port: 8080, frontendOrigin: 'https://alpha.example.pages.dev' });
  });
  it('requires an ASCII EventSub secret only when the webhook is enabled', () => {
    expect(loadConfig({ TWITCH_EVENTSUB_WEBHOOK_ENABLED: 'false' }).twitchEventSub).toMatchObject({ enabled: false });
    expect(() => loadConfig({ TWITCH_EVENTSUB_WEBHOOK_ENABLED: 'true' })).toThrow('TWITCH_EVENTSUB_SECRET');
    expect(() => loadConfig({ TWITCH_EVENTSUB_WEBHOOK_ENABLED: 'true', TWITCH_EVENTSUB_SECRET: 'too-short' })).toThrow('TWITCH_EVENTSUB_SECRET');
    expect(loadConfig({ TWITCH_EVENTSUB_WEBHOOK_ENABLED: 'true', TWITCH_EVENTSUB_SECRET: 'valid-ascii-secret' }).twitchEventSub).toMatchObject({ enabled: true });
  });
});
