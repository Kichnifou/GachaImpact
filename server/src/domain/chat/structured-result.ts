/** Public, bounded presentation protocol. Contains no Player DTO or execution instructions. */
export const graphicalCommands = ['pull', 'team', 'banniere', 'expedition', 'legende', 'obtention', 'vote', 'stella'] as const;
export type GraphicalCommand = typeof graphicalCommands[number];
export type ResultCharacter = Readonly<{
  id: string; name: string; portrait: string | null; rarity: 4 | 5 | null;
  constellation: number | null; previousConstellation?: number | null;
  isNew?: boolean; label?: string;
}>;
export type ResultPresentation = Readonly<{
  command: GraphicalCommand; title: string; characters: readonly ResultCharacter[]; facts: readonly string[];
}>;
export type StructuredChatResult = ResultPresentation & Readonly<{
  version: 1; source: Readonly<{ channel: 'INTERNAL_CHAT'; commandMessageId: string; operationId?: string }>;
}>;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && Array.from(value).length <= max && !/[\u0000-\u001f]/u.test(value);
const constellation = (value: unknown) => value === null || typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
export function isStructuredChatResult(value: unknown): value is StructuredChatResult {
  if (!record(value) || !keys(value, ['version', 'command', 'title', 'characters', 'facts', 'source']) || value.version !== 1 || !graphicalCommands.includes(value.command as GraphicalCommand) || !text(value.title, 200)
    || !record(value.source) || !keys(value.source, ['channel', 'commandMessageId', 'operationId']) || value.source.channel !== 'INTERNAL_CHAT' || !text(value.source.commandMessageId, 64)
    || value.source.operationId !== undefined && !text(value.source.operationId, 64)
    || !Array.isArray(value.characters) || value.characters.length > 10 || !Array.isArray(value.facts) || value.facts.length > 24
    || !value.facts.every(fact => text(fact, 300))) return false;
  return value.characters.every(c => record(c) && keys(c, ['id', 'name', 'portrait', 'rarity', 'constellation', 'previousConstellation', 'isNew', 'label']) && text(c.id, 64) && text(c.name, 120)
    && (c.rarity === null || c.rarity === 4 || c.rarity === 5) && constellation(c.constellation)
    && (c.previousConstellation === undefined || constellation(c.previousConstellation))
    && (c.isNew === undefined || typeof c.isNew === 'boolean') && (c.label === undefined || text(c.label, 120))
    && (c.portrait === null || typeof c.portrait === 'string' && c.portrait.length <= 500 && (
      /^\/assets\/[A-Za-z0-9/_-]+\.(png|webp|svg)$/u.test(c.portrait)
      || /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/character-catalog\/characters\/[a-f0-9-]{36}\/icon\/[a-f0-9]{64}\.png$/u.test(c.portrait))));
}
