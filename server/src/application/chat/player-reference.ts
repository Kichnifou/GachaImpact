import { normalizePlayerSearch } from '../social/social-service.js';

/** Chat mention syntax applies only to arguments that identify a Player. */
export const playerReferenceName = (raw: string) => raw.trim().replace(/^@/u, '').trim();

export const samePlayerReference = (displayName: string, raw: string) =>
  normalizePlayerSearch(displayName) === normalizePlayerSearch(playerReferenceName(raw));
