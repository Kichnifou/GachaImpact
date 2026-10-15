import { z } from 'zod';

/** Presentation only. Never use this value as an authenticated identity. */
export const presentationNameSchema = z.string().trim().min(1).max(40)
  .refine(value => !/[\p{Cc}\p{Zl}\p{Zp}\p{Bidi_Control}\u200b\ufeff]/u.test(value), 'Caractères de contrôle interdits.');

export function presentedName(player: { displayName: string; presentationName?: string | null }): string {
  return player.presentationName ?? player.displayName;
}

/** A personalized value or a past presentation edit is data that claim must preserve. */
export function hasNeutralPresentationName(player: { presentationName: string | null; presentationNameRevision: number }): boolean {
  return player.presentationName === null && player.presentationNameRevision === 0;
}

export const normalizePresentationReference = (name: string) => name.trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR');

/** Names are aliases. A collision, including a technical alias, never picks a Player. */
export function uniquePlayerReference<T extends { id: string; displayName: string; presentationName?: string | null }>(players: readonly T[], raw: string): T | null {
  const query = normalizePresentationReference(raw.replace(/^@/u, ''));
  const matches = players.filter(player => [player.displayName, player.presentationName].some(name => name != null && normalizePresentationReference(name) === query));
  return matches.length === 1 ? matches[0]! : null;
}
