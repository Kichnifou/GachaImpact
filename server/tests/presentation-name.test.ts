import { describe, expect, it } from 'vitest';
import { hasNeutralPresentationName, presentedName, presentationNameSchema, uniquePlayerReference } from '../src/application/player/presentation-name.js';
import { harness } from './helpers/chat-command-harness.js';

describe('presentation name is an alias, never an identity', () => {
  it('recognizes only the null/zero bootstrap presentation as disposable bookkeeping', () => {
    expect(hasNeutralPresentationName({ presentationName: null, presentationNameRevision: 0 })).toBe(true);
    expect(hasNeutralPresentationName({ presentationName: 'Custom', presentationNameRevision: 0 })).toBe(false);
    expect(hasNeutralPresentationName({ presentationName: null, presentationNameRevision: 1 })).toBe(false);
  });
  it('preserves legitimate names and trims the existing 1..40 UTF-16 rule', () => {
    expect(presentationNameSchema.parse('  Étoile 月 🌙  ')).toBe('Étoile 月 🌙');
    expect(presentationNameSchema.safeParse('a'.repeat(40)).success).toBe(true);
    for (const name of ['', '   ', 'a'.repeat(41), 'a\nb', 'a\u0000b', 'a\u0085b', 'a\u202eb']) expect(presentationNameSchema.safeParse(name).success).toBe(false);
  });
  it('uses the custom label with a technical fallback without mutating the object', () => {
    const player = { id: 'one', displayName: 'Technical', presentationName: 'Étoile' };
    expect(presentedName(player)).toBe('Étoile');
    expect(presentedName({ displayName: 'Technical' })).toBe('Technical');
    expect(player.displayName).toBe('Technical');
  });
  it('refuses homonyms across current and technical aliases regardless of order', () => {
    const one = { id: 'one', displayName: 'OldOne', presentationName: 'Étoile' };
    const two = { id: 'two', displayName: 'ETOILE', presentationName: 'Other' };
    expect(uniquePlayerReference([one], '@etoile')).toBe(one);
    expect(uniquePlayerReference([one], 'OldOne')).toBe(one);
    expect(uniquePlayerReference([one, two], 'etoile')).toBeNull();
    expect(uniquePlayerReference([two, one], 'etoile')).toBeNull();
    expect(uniquePlayerReference([one, two], 'Other')).toBe(two);
  });
  it('refuses a trade counterpart with a homonym on a later directory page', async () => {
    const h = harness();
    h.services.socialService.directory.mockResolvedValueOnce({ players: [{ id: 'other', displayName: 'Autre' }], page: 1, totalPages: 2 });
    h.services.socialService.directory.mockResolvedValueOnce({ players: [{ id: 'collision', displayName: 'Autre' }], page: 2, totalPages: 2 });
    expect(await h.send('!ech accepter Autre')).toContain('introuvable');
    expect(h.services.tradeService.mutate).not.toHaveBeenCalled();
  });
  it('refuses an Event recipient with a homonym on a later page', async () => {
    const h = harness();
    h.services.eventService.searchGameCRecipients.mockResolvedValueOnce({ recipients: [{ playerId: 'other', displayName: 'Autre' }], totalPages: 2 });
    h.services.eventService.searchGameCRecipients.mockResolvedValueOnce({ recipients: [{ playerId: 'collision', displayName: 'Autre' }], totalPages: 2 });
    expect(await h.send('!event mot doux Autre "Bonjour"')).toContain('introuvable');
    expect(h.services.eventService.sendGameC).not.toHaveBeenCalled();
  });
});
