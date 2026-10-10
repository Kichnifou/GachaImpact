import type { AppConfig } from '../../config/environment.js';
import { frontendReturnOrigin } from '../../config/frontend-origins.js';
import { AppError } from '../../api/errors.js';

// The complete value (including origin) is bound by the existing server-side state_hash.
// No callback may use this envelope's origin until the atomic state consumption succeeds.
export function oauthStateEnvelope(state: string): { legacyState: string; origin?: string } {
  if (!state.startsWith('v2.')) return { legacyState: state };
  const match = /^v2\.([A-Za-z0-9_-]{1,684})\.([A-Za-z0-9_-]{43,52})$/.exec(state);
  if (!match) throw new AppError('État OAuth invalide.', 400, 'TWITCH_STATE_INVALID');
  const origin = Buffer.from(match[1]!, 'base64url').toString('utf8');
  if (Buffer.from(origin).toString('base64url') !== match[1]) throw new AppError('État OAuth invalide.', 400, 'TWITCH_STATE_INVALID');
  return { legacyState: match[2]!, origin };
}

export function bindOAuthReturn(state: string, origin: string | undefined, config: AppConfig): string {
  if (origin === undefined) return state; // Older internal callers retain the canonical return.
  return `v2.${Buffer.from(frontendReturnOrigin(config, origin)).toString('base64url')}.${state}`;
}

export function consumedOAuthReturn(state: string, config: AppConfig): string {
  return frontendReturnOrigin(config, oauthStateEnvelope(state).origin);
}
