import { describe, expect, it } from 'vitest';
import { resolveLegacyTwitchLogins } from '../src/application/migration/twitch-identity-resolver.js';

function fakeRequest(users: { id: string; login: string; display_name: string }[]): typeof fetch {
  return (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/token')) {
      expect(String(init?.body)).not.toContain('scope');
      return Response.json({ access_token: 'test', token_type: 'bearer' });
    }
    expect(url.pathname).toBe('/helix/users');
    expect(init?.headers).toMatchObject({ 'client-id': 'id' });
    const logins = url.searchParams.getAll('login');
    const ids = url.searchParams.getAll('id');
    return Response.json({ data: users.filter(user => logins.includes(user.login) || ids.includes(user.id)) });
  }) as typeof fetch;
}

describe('Twitch app identity resolution', () => {
  it('does not infer historical IDs from inherited object properties', async () => {
    const result = await resolveLegacyTwitchLogins(['constructor'], { clientId: 'id', clientSecret: 'secret' },
      fakeRequest([{ id: '123', login: 'constructor', display_name: 'Fixture' }]));
    expect(result.users).toHaveLength(1); expect(result.conflicts).toEqual([]);
  });
  it('uses no chat scopes and resolves stable IDs, missing accounts and verified renames', async () => {
    const result = await resolveLegacyTwitchLogins(['old_login', 'missing'], { clientId: 'id', clientSecret: 'secret' },
      fakeRequest([{ id: '123', login: 'new_login', display_name: 'NewLogin' }]), { old_login: '123' });
    expect(result.users).toEqual([{ legacyLogin: 'old_login', twitchUserId: '123', currentLogin: 'new_login', displayName: 'NewLogin', renamed: true }]);
    expect(result.missing).toEqual(['missing']);
  });

  it('blocks duplicate stable IDs', async () => {
    const result = await resolveLegacyTwitchLogins(['one', 'two'], { clientId: 'id', clientSecret: 'secret' },
      fakeRequest([{ id: '123', login: 'one', display_name: 'One' }]), { two: '123' });
    expect(result.conflicts).toEqual(['two']);
    expect(result.duplicates).toBe(1);
  });

  it('blocks a reused login when its previously verified Twitch ID differs', async () => {
    const result = await resolveLegacyTwitchLogins(['old_login'], { clientId: 'id', clientSecret: 'secret' },
      fakeRequest([{ id: '999', login: 'old_login', display_name: 'Different account' }]), { old_login: '123' });
    expect(result.conflicts).toEqual(['old_login']);
    expect(result.users).toEqual([]);
  });

  it('requires ID revalidation even when the old login still resolves', async () => {
    const calls: string[] = [];
    const base = fakeRequest([{ id: '123', login: 'one', display_name: 'One' }]);
    const request = (async (input, init) => { calls.push(String(input)); return base(input, init); }) as typeof fetch;
    const result = await resolveLegacyTwitchLogins(['one'], { clientId: 'id', clientSecret: 'secret' }, request, { one: '123' });
    expect(result.users).toHaveLength(1);
    expect(calls.some(url => url.includes('id=123'))).toBe(true);
  });

  it('keeps a vanished historical ID NOT_FOUND', async () => {
    const result = await resolveLegacyTwitchLogins(['old_login'], { clientId: 'id', clientSecret: 'secret' }, fakeRequest([]), { old_login: '123' });
    expect(result.missing).toEqual(['old_login']); expect(result.users).toEqual([]);
  });

  it('classifies an incoherent ID response as a conflict', async () => {
    const request = (async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/token')) return Response.json({ access_token: 'test', token_type: 'bearer' });
      return Response.json({ data: url.searchParams.has('id') ? [{ id: '789', login: 'other', display_name: 'Other' }] : [] });
    }) as typeof fetch;
    const result = await resolveLegacyTwitchLogins(['old_login'], { clientId: 'id', clientSecret: 'secret' }, request, { old_login: '123' });
    expect(result.conflicts).toEqual(['old_login']); expect(result.users).toEqual([]); expect(result.missing).toEqual([]);
  });

  it('keeps conflicting historical evidence blocked even if a current login resolves', async () => {
    const result = await resolveLegacyTwitchLogins(['one'], { clientId: 'id', clientSecret: 'secret' },
      fakeRequest([{ id: '123', login: 'one', display_name: 'One' }]), {}, ['one']);
    expect(result.conflicts).toEqual(['one']); expect(result.users).toEqual([]);
  });
});
