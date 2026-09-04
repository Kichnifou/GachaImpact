import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js';

/**
 * Boundary between the application and the authentication provider.
 * Gameplay services consume the resolved subject, never a Supabase SDK type.
 */
export interface AuthIdentityVerifier {
  verify(accessToken: string): Promise<AuthenticatedIdentity | null>;
}
