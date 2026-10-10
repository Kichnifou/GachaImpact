import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { chatLength, logicalChatParts } from '../src/application/chat/chat-list-result.js';
import { chatCommandRegistry, chatHelp, chatHelpCategories, parseChatCommand } from '../src/application/chat/chat-command-registry.js';
import { parseTwitchChatCommand } from '../src/application/twitch/twitch-command-parser.js';
import { twitchResponseEntries, twitchResponseSegments } from '../src/application/twitch/twitch-response-format.js';
import { withPlayerCommandExecution } from '../src/application/player/player-command-execution.js';
import { twitchPlayerCommandExecutor } from '../src/application/twitch/twitch-player-command-executor.js';
import { freezeCommandValue } from '../src/application/twitch/twitch-command-intent.js';
import type { ChatCommandServices } from '../src/application/chat/player-command-resolver.js';
import { harness } from './helpers/chat-command-harness.js';

const twitch = <T>(run: () => T) => withPlayerCommandExecution({ now: new Date('2026-10-09T12:00:00Z'), source: 'TWITCH' }, run);
const budget = (parts: readonly string[]) => { for (const part of parts) expect(chatLength(part)).toBeLessThanOrEqual(450); };
const exactEntries = (parts: readonly string[], entries: readonly string[]) => {
  budget(parts);
  let previous = -1;
  const all = parts.join('\n');
  for (const entry of entries) {
    expect(parts.filter(part => part.includes(entry))).toHaveLength(1);
    expect(all.split(entry)).toHaveLength(2);
    expect(all.indexOf(entry)).toBeGreaterThan(previous); previous = all.indexOf(entry);
  }
};

describe('Twitch presentation budget and indivisible entries', () => {
  it('counts Unicode codepoints including every prefix and keeps extended graphemes and names whole', () => {
    const emoji = '👩🏽‍🚀👨‍👩‍👧‍👦🏳️‍🌈🇫🇷e\u0301';
    const entries = Array.from({ length: 30 }, (_, index) => `${emoji} Personnage ${index.toString().padStart(2, '0')}, Nom composé (C${index % 7})`);
    const parts = twitch(() => logicalChatParts('✅ Joueur 🧑🏿‍🚀, Box :', entries.map(text => ({ text, separator: ', ' })), '✅ Box (suite) :'));
    expect(parts.length).toBeGreaterThan(3); exactEntries(parts, entries);
    for (const part of parts) {
      expect(part).not.toMatch(/^(?:\u200d|\ufe0f|\p{M})/u);
      expect(part).not.toMatch(/\u200d$/u);
    }
  });
  it('moves the first entry when its prefix would exceed 450 and preserves the standalone 500 budget', () => {
    const entry = 'A'.repeat(435);
    const parts = twitch(() => logicalChatParts('Préfixe suffisamment long :', [{ text: entry, separator: ' | ' }], '↪ Suite :'));
    expect(parts).toEqual(['Préfixe suffisamment long :', `↪ Suite : ${entry}`]); budget(parts);
    const entries = ['A'.repeat(220), 'B'.repeat(220)].map(text => ({ text, separator: ' | ' }));
    expect(logicalChatParts('Préfixe :', entries, 'Suite :')).toHaveLength(1);
    expect(twitch(() => logicalChatParts('Préfixe :', entries, 'Suite :', 500))).toHaveLength(2);
  });
  it('keeps a too-long atom in the receipt and reports it explicitly without cutting it or losing its neighbors', () => {
    const atom = 'CODE_' + '👩🏽‍🚀'.repeat(120);
    const parts = twitch(() => logicalChatParts('Codes :', ['AVANT', atom, 'APRÈS'].map(text => ({ text, separator: ', ' })), 'Codes (suite) :'));
    const responses = twitchResponseEntries(parts);
    budget(responses.map(response => response.text));
    expect(responses.find(response => response.fullText)).toEqual({ text: expect.stringContaining('Contenu intégral conservé'), fullText: atom });
    expect(responses[0]!.text).toContain('AVANT'); expect(responses.at(-1)!.text).toContain('APRÈS');
    expect(responses.map(response => response.fullText ?? response.text).join('\n')).toContain(atom);
    expect(twitchResponseSegments('A'.repeat(450))).toEqual(['A'.repeat(450)]);
    expect(twitchResponseEntries('A'.repeat(451))[0]?.fullText).toBe('A'.repeat(451));
  });
  it('keeps the complete current Help catalog within the budget, including all command tokens', () => {
    for (const topic of [undefined, ...chatHelpCategories, ...chatCommandRegistry.map(command => command.name)]) {
      const text = chatHelp(topic); budget([text]); expect(twitchResponseSegments(text)).toEqual([text]);
    }
  });
});

describe('Twitch-specific repeated command parsing', () => {
  it.each(['!ban', '!BAN', '!banniere', '!bannière', '!BANNIÈRE', '!ban\u034f', '!ban \u034f', '!ban \u034f\u034f', '!ban\t\u034f\n\u034f'])('keeps %s as the banner read', text => {
    const parsed = parseTwitchChatCommand(text);
    expect(parsed.definition?.handler).toBe('banniere'); expect(parsed.args).toEqual([]);
  });
  it('preserves real arguments, names, token content and emoji joiners; leaves standalone parsing unchanged', () => {
    expect(parseChatCommand('!ban \u034f').args).toEqual(['\u034f']);
    expect(parseTwitchChatCommand('!ban visible \u034f').args).toEqual(['visible']);
    expect(parseTwitchChatCommand('!select Yae Miko \u034f').args).toEqual(['Yae', 'Miko']);
    expect(parseTwitchChatCommand('!code TOKEN\u034f').args).toEqual(['TOKEN\u034f']);
    expect(parseTwitchChatCommand('!team rename "👩🏽‍🚀 e\u0301"').args).toEqual(['rename', '"👩🏽‍🚀', 'e\u0301"']);
    expect(parseTwitchChatCommand('!ban \u200d').args).toEqual(['\u200d']);
    expect(parseTwitchChatCommand('!banner').definition?.name).toBe('banniere');
  });
});

describe('complete Twitch command output from frozen owners', () => {
  const player = { id: '11111111-1111-4111-8111-111111111111', displayName: 'Voyageur', elementKey: 'pyro', status: 'ACTIVE' as const };
  function fixture() {
    const h = harness();
    const db = { playerPermanentMissionProgress: { findMany: vi.fn(async () => []) }, resourceMovement: { findMany: vi.fn(async () => []) },
      businessOperation: { count: vi.fn(async () => 0) }, team: { findFirst: vi.fn(async () => null) } };
    const core = twitchPlayerCommandExecutor(db as unknown as PrismaClient, h.services as unknown as ChatCommandServices);
    const run = async (text: string, key = text, responseBodyLimit?: number) => {
      const { definition, args } = parseTwitchChatCommand(text);
      const intent = await core.prepare!(player, definition!.handler!, args, definition!.syntax, key, undefined, responseBodyLimit);
      const output = await core.execute(player, definition!.handler!, args, definition!.syntax, key, intent);
      return { intent, output: typeof output === 'string' ? [output] : output };
    };
    return { ...h, db, core, run };
  }
  it('freezes the reduced body budget across large Box preparation, replay and subsequent standalone changes', async () => {
    const f = fixture();
    const catalog = JSON.parse(readFileSync('prisma/data/characters.json', 'utf8')) as { externalKey: string; name: string; elementKey: string; rarity: number }[];
    const characters = catalog.map((character, index) => ({ ...character, id: character.externalKey, constellation: index % 7, favorite: false, firstObtainedAt: new Date('2026-01-01') }));
    f.services.getCurrentPlayerBox.execute.mockResolvedValue({ characters, preference: { sortKey: 'alphabetical', direction: 'asc' } } as never);
    const legacy = await f.run('!box', 'legacy-output');
    const current = await f.run('!box', 'new-output', 320);
    expect(legacy.intent.responseBodyLimit).toBeUndefined(); expect(current.intent.responseBodyLimit).toBe(320);
    expect(current.output.every(text => chatLength(text) <= 320)).toBe(true);
    expect(current.output.length).toBeGreaterThan(legacy.output.length);
    for (const character of characters) expect(current.output.join('\n').split(`${character.name} (C${character.constellation})`)).toHaveLength(2);
    f.services.getCurrentPlayerBox.execute.mockResolvedValue({ characters: [], preference: { sortKey: 'alphabetical', direction: 'asc' } } as never);
    expect(await f.core.execute(player, 'box', [], '!box', 'new-output', current.intent)).toEqual(current.output);
    expect(await f.core.execute(player, 'box', [], '!box', 'legacy-output', legacy.intent)).toEqual(legacy.output);
    expect(f.services.getCurrentPlayerBox.execute).toHaveBeenCalledTimes(2);
    expect(f.services.setBoxCharacterFavorite.execute).not.toHaveBeenCalled(); expect(f.services.setBoxSortPreference.execute).not.toHaveBeenCalled();
  });
  it('renders a large public-catalog Box including Yoimiya exactly once and freezes its complete output', async () => {
    const f = fixture();
    const catalog = JSON.parse(readFileSync('prisma/data/characters.json', 'utf8')) as { externalKey: string; name: string; elementKey: string; rarity: number }[];
    const characters = catalog.map((character, index) => ({ ...character, id: character.externalKey, constellation: index % 7, favorite: false, firstObtainedAt: new Date('2026-01-01') }));
    f.services.getCurrentPlayerBox.execute.mockResolvedValue({ characters, preference: { sortKey: 'alphabetical', direction: 'asc' } } as never);
    const first = await f.run('!box', 'box-new-id');
    expect(first.output.length).toBeGreaterThan(3); budget(first.output);
    for (const character of characters) {
      const entry = `${character.name} (C${character.constellation})`;
      expect(first.output.filter(part => part.includes(entry))).toHaveLength(1);
      expect(first.output.join('\n').split(entry)).toHaveLength(2);
    }
    expect(first.output.some(part => part.includes('Yoimiya (C'))).toBe(true);
    f.services.getCurrentPlayerBox.execute.mockResolvedValue({ characters: [], preference: { sortKey: 'alphabetical', direction: 'asc' } } as never);
    expect(await f.core.execute(player, 'box', [], '!box', 'box-new-id', first.intent)).toEqual(first.output);
    expect(f.services.getCurrentPlayerBox.execute).toHaveBeenCalledTimes(1);
    expect((await f.run('!box', 'box-next-id')).output).not.toEqual(first.output);
    expect(f.services.setBoxCharacterFavorite.execute).not.toHaveBeenCalled(); expect(f.services.setBoxSortPreference.execute).not.toHaveBeenCalled();
  });
  it.each(['!pity', '!box', '!quotis', '!sac', '!ban', '!banniere', '!bannière', '!BAN'])('prepares a fresh read for a new ID and preserves the old frozen result: %s', async command => {
    const f = fixture(), first = await f.run(command, 'first-id');
    f.services.socialService.actor.mockResolvedValue({ id: 'self', displayName: 'Autre lecture' });
    const second = await f.run(command, 'second-id');
    const { definition, args } = parseTwitchChatCommand(command);
    expect(await f.core.execute(player, definition!.handler!, args, definition!.syntax, 'first-id', first.intent)).toEqual(first.output);
    budget(first.output); budget(second.output);
    expect(first.intent.mutation).toBeUndefined(); expect(second.intent.mutation).toBeUndefined();
    expect(f.services.performGachaPullChat.execute).not.toHaveBeenCalled(); expect(f.services.setGachaTarget.execute).not.toHaveBeenCalled();
    expect(f.db.businessOperation.count).not.toHaveBeenCalled();
  });
  it('keeps an overlong frozen owner output intact until the receipt owns the explicit overflow', async () => {
    const f = fixture(), text = '🔐' + 'TOKEN'.repeat(120);
    const output = await f.core.execute(player, 'code', [], '!code', 'overflow', { now: new Date().toISOString(), reads: {}, memory: {}, output: freezeCommandValue(text) });
    expect(output).toEqual([text]); expect(twitchResponseEntries(output)[0]?.fullText).toBe(text);
  });
  it('keeps every Collection object and quantity whole, including punctuation and emoji inside names', async () => {
    const f = fixture();
    const items = Array.from({ length: 30 }, (_, index) => ({ externalKey: `item-${index}`, displayName: `${index.toString().padStart(2, '0')} Souvenir, 👩🏽‍🚀 | e\u0301 composé`, section: 'collection', quantity: BigInt(index + 1) }));
    f.services.getCurrentPlayerInventory.execute.mockResolvedValue({ resources: [], items } as never);
    const { output } = await f.run('!coffre');
    exactEntries(output, items.map(item => `${item.displayName} (x${item.quantity})`));
  });
  it('keeps all gift code tokens and the claimed count, then all awarded resources', async () => {
    const f = fixture();
    const rewards = ['primogems', 'moras', ...['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].map(element => `particles_${element}`)]
      .map(resourceKey => ({ resourceKey, amount: '9223372036854775807' }));
    const available = Array.from({ length: 35 }, (_, index) => ({ token: `CODE-${index.toString().padStart(2, '0')}-${'A'.repeat(25)}`, editionId: `edition-${index}`, rewards: index ? [] : rewards }));
    f.services.giftCodeService.listForPlayer.mockResolvedValue({ available, claimed: [] } as never);
    const listed = await f.run('!code'); exactEntries(listed.output, available.map(code => code.token));
    expect(listed.output.at(-1)).toContain('Récupérés : 0');
    f.services.giftCodeService.claim.mockResolvedValue({ claimed: [available[0]], resources: { primogems: '9223372036854775807', moras: '9223372036854775807', particles: {} }, operation: { alreadyProcessed: false } } as never);
    const claimed = await f.run(`!code ${available[0]!.token}`); budget(claimed.output);
    expect(claimed.output.join('\n')).toContain(available[0]!.token);
    expect(claimed.output.join('\n').match(/\+(?:💠|🪙)?9 223 372 036 854 775 807/gu)).toHaveLength(9);
    expect(f.services.giftCodeService.claim).toHaveBeenCalledTimes(1);
  });
  it('returns every received and sent friendship request without the old compact-list omission', async () => {
    const f = fixture();
    const players = Array.from({ length: 30 }, (_, index) => ({ id: `friend-${index}`, displayName: `Ami ${index.toString().padStart(2, '0')} 👩🏽‍🚀 ${'é'.repeat(20)}` }));
    const requests = players.map((player, index) => ({ playerId: player.id, direction: index < 18 ? 'RECEIVED' : 'SENT' }));
    f.services.socialService.friends.mockResolvedValue({ players, requests, friends: [], summary: { activeFriends: 0, available: 0 } } as never);
    const { output } = await f.run('!ami demandes');
    exactEntries(output, players.map(player => player.displayName));
    expect(output.join('\n')).not.toContain('autres'); expect(f.services.socialService.friendship.mutate).not.toHaveBeenCalled();
  });
  it('keeps each ranked Event row and each mission with its progress whole and ordered', async () => {
    const f = fixture();
    const entries = Array.from({ length: 10 }, (_, index) => ({ rank: index + 1, displayName: `Voyageur ${index.toString().padStart(2, '0')} ${'👩🏽‍🚀'.repeat(6)}`, points: 100 - index }));
    f.services.eventService.getRanking.mockResolvedValue({ entries });
    const event = await f.run('!event top');
    exactEntries(event.output, entries.map(entry => `${entry.rank}. ${entry.displayName} ${entry.points} pts`));
    const view = await f.services.getCurrentPlayerMissions.execute();
    const missions = view.ranks.S.map((mission, index) => ({ ...mission, displayName: `Mission ${index + 1} ${'e\u0301'.repeat(45)}` }));
    f.services.getCurrentPlayerMissions.execute.mockResolvedValue({ ...view, ranks: { ...view.ranks, S: missions } });
    const mission = await f.run('!mission S'); exactEntries(mission.output, missions.map(row => `${row.displayName} ${row.progress}/${row.target}`));
  });
  it('keeps team pagination and all slots when a compound team requires multiple messages', async () => {
    const f = fixture();
    const teams = Array.from({ length: 10 }, (_, index) => ({ id: `team-${index}`, active: index === 0, position: index + 1, name: `Équipe ${index}`, passives: [],
      slots: Array.from({ length: 4 }, (_, slot) => ({ position: slot + 1, character: { name: `Personnage ${index}-${slot}, ${'e\u0301'.repeat(50)}`, elementKey: 'pyro', constellation: slot } })) }));
    f.services.getCurrentPlayerTeams.execute.mockResolvedValue({ teams } as never);
    const { output } = await f.run('!team list');
    exactEntries(output, teams.flatMap(team => team.slots.map(slot => `${slot.character.name} (C${slot.character.constellation})`)));
    expect(output[0]).toContain('1/1'); expect(f.services.activatePlayerTeam.execute).not.toHaveBeenCalled();
  });
  it('keeps the complete long banner, without treating punctuation inside a name as a boundary', async () => {
    const f = fixture(), current = await f.services.getCurrentGacha.execute();
    const five = Array.from({ length: 4 }, (_, index) => ({ id: `f${index}`, elementKey: 'pyro', name: `Cinq ${index}, | ${'e\u0301'.repeat(25)}` }));
    const four = Array.from({ length: 6 }, (_, index) => ({ id: `q${index}`, elementKey: 'cryo', name: `Quatre ${index}, | ${'e\u0301'.repeat(25)}` }));
    f.services.getCurrentGacha.execute.mockResolvedValue({ ...current, banner: { ...current.banner, featuredFiveStars: five, featuredFourStars: four }, playerState: { ...current.playerState, selectedBannerCharacterId: null } } as never);
    const { output } = await f.run('!ban \u034f'); exactEntries(output, [...five, ...four].map(character => character.name));
    expect(output.at(-1)).toContain('!select');
  });
});
