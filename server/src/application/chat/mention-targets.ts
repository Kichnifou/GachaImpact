import { AppError } from '../../api/errors.js';
import { normalizePresentationReference, presentedName } from '../player/presentation-name.js';

type MentionPlayer = { id: string; displayName: string; presentationName?: string | null };
type Selection = { playerId: string; displayName: string };

function offsets(text: string, name: string): number[] {
  const needle = `@${name}`, found: number[] = [];
  for (let offset = text.indexOf(needle); offset >= 0; offset = text.indexOf(needle, offset + 1)) {
    const before = offset ? text[offset - 1] : null, after = text[offset + needle.length] ?? null, following = text[offset + needle.length + 1] ?? null;
    if ((!before || /\s/u.test(before)) && (!after || /\s/u.test(after) || /[.,!?;:]/u.test(after) && (!following || /\s/u.test(following)))) found.push(offset);
  }
  return found;
}

/** A selected UUID is never silently dropped or redirected when its label changes. */
export function resolveMentionTargets(players: readonly MentionPlayer[], excluded: ReadonlySet<string>, content: string, selections: readonly Selection[]): string[] {
  const text = normalizePresentationReference(content);
  const activeSelections = selections.filter(selection => offsets(text, normalizePresentationReference(selection.displayName)).length > 0);
  for (const selection of activeSelections) {
    const target = players.find(player => player.id === selection.playerId);
    const ambiguous = activeSelections.some(other => other.playerId !== selection.playerId && normalizePresentationReference(other.displayName) === normalizePresentationReference(selection.displayName));
    if (ambiguous || !target || excluded.has(target.id) || normalizePresentationReference(presentedName(target)) !== normalizePresentationReference(selection.displayName)) {
      throw new AppError('Une cible de mention a changé. Sélectionnez à nouveau le joueur avant d’envoyer.', 409, 'CHAT_MENTION_CHANGED');
    }
  }
  const matches = players.flatMap(player => {
    if (excluded.has(player.id)) return [];
    const name = normalizePresentationReference(presentedName(player));
    const selected = activeSelections.filter(selection => normalizePresentationReference(selection.displayName) === name);
    if (selected.length && !selected.some(selection => selection.playerId === player.id)) return [];
    return offsets(text, name).map(offset => ({ id: player.id, offset, length: name.length + 1 }));
  }).sort((a, b) => a.offset - b.offset || b.length - a.length || a.id.localeCompare(b.id));
  const usedOffsets = new Set<number>(), usedPlayers = new Set<string>();
  for (const match of matches) {
    if (usedOffsets.has(match.offset) || matches.some(other => other.offset === match.offset && other.length === match.length && other.id !== match.id)) continue;
    usedOffsets.add(match.offset);
    if (usedPlayers.size < 10) usedPlayers.add(match.id);
  }
  return [...usedPlayers];
}
