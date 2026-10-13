/** Public, bounded presentation protocol. Contains no Player DTO or execution instructions. */
import { isElementKey, type ElementKey } from '../economy/resources.js';
export const graphicalCommands = ['pull', 'team', 'banniere', 'expedition', 'legende', 'obtention', 'vote', 'stella', 'select', 'combat'] as const;
export type GraphicalCommand = typeof graphicalCommands[number];
/** Vote carries the whole bounded candidate catalog; ordinary results stay at16KiB.
 * This is a server receipt budget, not the public500-character message limit. */
export const structuredResultByteLimit = (command: GraphicalCommand) => command === 'vote' ? 262_144 : 16_384;
export type ResultCharacter = Readonly<{
  id: string; name: string; portrait: string | null; rarity: 4 | 5 | null;
  constellation: number | null; previousConstellation?: number | null;
  isNew?: boolean; label?: string;
  elementKey?: ElementKey; voteCount?: number; pity?: number;
}>;
export type ResultPresentation = Readonly<{
  command: GraphicalCommand; title: string; characters: readonly ResultCharacter[]; facts: readonly string[];
  compact?: boolean;
}>;
export type StructuredChatResult = ResultPresentation & Readonly<{
  version: 1; source: Readonly<{ channel: 'INTERNAL_CHAT'; commandMessageId: string; operationId?: string }>;
}>;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && Array.from(value).length <= max && !/[\u0000-\u001f]/u.test(value);
const constellation = (value: unknown) => value === null || typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
export function isStructuredChatResult(value: unknown): value is StructuredChatResult {
  if (!record(value) || !keys(value, ['version', 'command', 'title', 'characters', 'facts', 'source', 'compact']) || value.version !== 1 || !graphicalCommands.includes(value.command as GraphicalCommand) || !text(value.title, 200)
    || value.compact !== undefined && typeof value.compact !== 'boolean'
    || !record(value.source) || !keys(value.source, ['channel', 'commandMessageId', 'operationId']) || value.source.channel !== 'INTERNAL_CHAT' || !text(value.source.commandMessageId, 64)
    || value.source.operationId !== undefined && !text(value.source.operationId, 64)
    || !Array.isArray(value.characters) || value.characters.length > (value.command === 'vote' ? 200 : 10) || !Array.isArray(value.facts) || value.facts.length > 24
    || !value.facts.every(fact => text(fact, 300))) return false;
  return value.characters.every(c => record(c) && keys(c, ['id', 'name', 'portrait', 'rarity', 'constellation', 'previousConstellation', 'isNew', 'label', 'elementKey', 'voteCount', 'pity']) && text(c.id, 64) && text(c.name, 120)
    && (c.elementKey === undefined || typeof c.elementKey === 'string' && isElementKey(c.elementKey))
    && (c.voteCount === undefined || value.command === 'vote' && Number.isSafeInteger(c.voteCount) && Number(c.voteCount) >= 0)
    && (c.pity === undefined || value.command === 'pull' && Number.isInteger(c.pity) && Number(c.pity) >= 0 && Number(c.pity) <= (c.rarity === 5 ? 90 : 10))
    && (c.rarity === null || c.rarity === 4 || c.rarity === 5) && constellation(c.constellation)
    && (c.previousConstellation === undefined || constellation(c.previousConstellation))
    && (c.isNew === undefined || typeof c.isNew === 'boolean') && (c.label === undefined || text(c.label, 120))
    && (c.portrait === null || typeof c.portrait === 'string' && c.portrait.length <= 500 && (
      /^\/assets\/[A-Za-z0-9/_-]+\.(png|webp|svg)$/u.test(c.portrait)
      || /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/character-catalog\/characters\/[a-f0-9-]{36}\/icon\/[a-f0-9]{64}\.png$/u.test(c.portrait))));
}
