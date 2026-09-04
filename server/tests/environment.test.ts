import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config/environment.js';

describe('loadConfig', () => {
  it('uses local defaults without a database or Supabase project', () => {
    expect(loadConfig({})).toEqual({
      host: '127.0.0.1',
      port: 3001,
      frontendOrigin: 'http://localhost:5173',
      supabase: {},
    });
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: 'invalid' })).toThrow('Invalid server environment');
  });
});
