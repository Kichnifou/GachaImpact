import { normalizeLegacyName } from './streamerbot-snapshot.js';

export type ResolvedTwitchUser = { legacyLogin: string; twitchUserId: string; currentLogin: string; displayName: string; renamed: boolean };
export type TwitchResolution = { users: ResolvedTwitchUser[]; missing: string[]; conflicts: string[]; duplicates: number };
type Fetch = typeof fetch;
const validLogin = /^[a-z0-9_]{1,25}$/;

/** Explicit operator action only. App credentials grant requests no scopes and no chat APIs. */
export async function resolveLegacyTwitchLogins(
  logins: readonly string[], credentials: { clientId: string; clientSecret: string }, request: Fetch = fetch,
  knownIds: Readonly<Record<string, string>> = {},
): Promise<TwitchResolution> {
  if (!credentials.clientId || !credentials.clientSecret) throw new Error('Identifiants Twitch requis.');
  const normalized = logins.map(login => ({ original: login, key: normalizeLegacyName(login) }));
  if (normalized.some(login => !validLogin.test(login.key))) throw new Error('Login Twitch legacy invalide.');
  if (new Set(normalized.map(login => login.key)).size !== normalized.length) throw new Error('Logins legacy dupliqués.');
  const tokenResponse = await request('https://id.twitch.tv/oauth2/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, grant_type: 'client_credentials' }),
  });
  if (!tokenResponse.ok) throw new Error('Jeton application Twitch indisponible.');
  const token = await tokenResponse.json() as { access_token?: unknown; token_type?: unknown };
  if (typeof token.access_token !== 'string' || token.token_type !== 'bearer') throw new Error('Réponse OAuth Twitch invalide.');
  const found = new Map<string, { id: string; login: string; display_name: string }>();
  for (let start = 0; start < normalized.length; start += 100) {
    const batch = normalized.slice(start, start + 100);
    const url = new URL('https://api.twitch.tv/helix/users');
    for (const login of batch) url.searchParams.append('login', login.key);
    const response = await request(url, { headers: { authorization: `Bearer ${token.access_token}`, 'client-id': credentials.clientId } });
    if (!response.ok) throw new Error('Résolution Helix impossible.');
    const body = await response.json() as { data?: unknown };
    if (!Array.isArray(body.data)) throw new Error('Réponse Helix invalide.');
    for (const row of body.data) {
      if (!row || typeof row !== 'object') throw new Error('Profil Helix invalide.');
      const user = row as Record<string, unknown>;
      if (typeof user.id !== 'string' || !/^[0-9]+$/.test(user.id) ||
          typeof user.login !== 'string' || !validLogin.test(user.login) ||
          typeof user.display_name !== 'string' || !user.display_name.trim()) throw new Error('Profil Helix invalide.');
      const key = normalizeLegacyName(user.login);
      if (!batch.some(login => login.key === key) || found.has(key)) throw new Error('Réponse Helix inattendue ou dupliquée.');
      found.set(key, { id: user.id, login: user.login, display_name: user.display_name });
    }
  }
  // A renamed account cannot be found by its old login. A previously verified ID
  // may be looked up by ID; an unverified guess must remain a blocker.
  const missingWithKnownIds = normalized.filter(login => !found.has(login.key) && knownIds[login.key]);
  for (let start = 0; start < missingWithKnownIds.length; start += 100) {
    const batch = missingWithKnownIds.slice(start, start + 100);
    const url = new URL('https://api.twitch.tv/helix/users');
    for (const login of batch) url.searchParams.append('id', knownIds[login.key]!);
    const response = await request(url, { headers: { authorization: `Bearer ${token.access_token}`, 'client-id': credentials.clientId } });
    if (!response.ok) throw new Error('Résolution Helix par ID impossible.');
    const body = await response.json() as { data?: unknown };
    if (!Array.isArray(body.data)) throw new Error('Réponse Helix invalide.');
    for (const row of body.data) {
      if (!row || typeof row !== 'object') throw new Error('Profil Helix invalide.');
      const user = row as Record<string, unknown>;
      if (typeof user.id !== 'string' || typeof user.login !== 'string' || typeof user.display_name !== 'string'
          || !validLogin.test(user.login) || !user.display_name.trim()) throw new Error('Profil Helix invalide.');
      const legacy = batch.find(login => knownIds[login.key] === user.id);
      if (!legacy || found.has(legacy.key)) throw new Error('Réponse Helix par ID inattendue.');
      found.set(legacy.key, { id: user.id, login: user.login, display_name: user.display_name });
    }
  }
  const users: ResolvedTwitchUser[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  let duplicates = 0;
  const ids = new Set<string>();
  for (const login of normalized) {
    const user = found.get(login.key);
    if (!user) { missing.push(login.original); continue; }
    if (knownIds[login.key] && knownIds[login.key] !== user.id) { conflicts.push(login.original); continue; }
    if (ids.has(user.id)) { conflicts.push(login.original); duplicates++; continue; }
    ids.add(user.id);
    users.push({ legacyLogin: login.original, twitchUserId: user.id, currentLogin: user.login,
      displayName: user.display_name, renamed: login.key !== normalizeLegacyName(user.login) });
  }
  return { users, missing, conflicts, duplicates };
}
