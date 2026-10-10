import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/environment.js';
import { frontendReturnOrigin } from '../src/config/frontend-origins.js';
const canonical = 'https://gachaimpact.pages.dev', second = 'https://gachaimpact.fr';
describe('strict frontend origins', () => {
  it('retains the single canonical origin when the list is absent and deduplicates additions', () => {
    expect(loadConfig({ FRONTEND_ORIGIN: canonical }).frontendOrigins).toEqual([canonical]);
    expect(loadConfig({ FRONTEND_ORIGIN: canonical, FRONTEND_ORIGINS: `${second}, ${canonical},${second}`, NODE_ENV: 'production' }).frontendOrigins).toEqual([canonical, second]);
  });
  it.each(['', '*', 'https://*.example', `${second}/`, `${second}/path`, `${second}?x=1`, `${second}#x`, 'https://u:p@gachaimpact.fr', 'https:\\gachaimpact.fr', 'null', 'http://gachaimpact.fr', 'http://localhost:5173', 'https://localhost:5173', `${second},`])('rejects malformed or unsafe production configuration %s', value => {
    expect(() => loadConfig({ FRONTEND_ORIGIN: canonical, FRONTEND_ORIGINS: value, NODE_ENV: 'production' })).toThrow('FRONTEND_ORIGIN');
  });
  it('permits only the documented local HTTP origin in development', () => {
    expect(loadConfig({}).frontendOrigins).toEqual(['http://localhost:5173']);
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow('FRONTEND_ORIGIN');
    expect(() => loadConfig({ FRONTEND_ORIGIN: 'http://example.com' })).toThrow('FRONTEND_ORIGIN');
  });
  it('never reflects an unknown request origin and defaults missing origins to the canonical site', () => {
    const config = loadConfig({ FRONTEND_ORIGIN: canonical, FRONTEND_ORIGINS: second });
    expect(frontendReturnOrigin(config)).toBe(canonical);
    expect(frontendReturnOrigin(config, second)).toBe(second);
    for (const value of ['null', 'https://gachaimpact.fr.evil.example', 'https://www.gachaimpact.fr', `${second}/path`, 'http://gachaimpact.fr']) expect(() => frontendReturnOrigin(config, value)).toThrow();
  });
});
