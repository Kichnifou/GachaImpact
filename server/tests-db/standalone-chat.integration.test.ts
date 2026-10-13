import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { isolatedBatchDatabase } from './isolated-batch-database.js';
import { AppearanceService } from '../src/application/appearance/appearance-service.js';
import { GlobalChatService } from '../src/application/chat/global-chat-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { resourceKeys } from '../src/domain/economy/resources.js';
import { badgeSymbols } from '../src/application/appearance/badges.js';
import type { StructuredChatResult } from '../src/domain/chat/structured-result.js';

const fixture = isolatedBatchDatabase(), db = fixture.database;
const getPlayer = new GetCurrentPlayer(new PrismaCurrentPlayerStore(db));
const appearance = new AppearanceService(db, getPlayer);
let now = new Date('2097-03-01T12:00:00Z');
const chat = new GlobalChatService(db, getPlayer, { now: () => now }, { nextInt: () => 0 });
beforeEach(() => { now = new Date(now.getTime() + 60_000); });
let owner: string, archived: string;
const identity = () => ({ subject: owner });
beforeAll(async () => {
  await fixture.setup({ prismaMigrations: true });
  const create = async (status: 'ACTIVE' | 'ARCHIVED') => {
    const id = randomUUID();
    await db.player.create({ data: { id, displayName: `Fixture ${id.slice(0, 8)}`, elementKey: 'pyro', webIdentity: { create: { provider: 'supabase', providerSubject: id } }, progression: { create: { xp: 60n } }, economyStats: { create: {} }, resourceBalances: { create: resourceKeys.map(resourceKey => ({ resourceKey, amount: 0n })) } } });
    if (status === 'ARCHIVED') await db.player.update({ where: { id }, data: { status } });
    return id;
  };
  owner = await create('ACTIVE'); archived = await create('ARCHIVED');
}, 180_000);
afterAll(async () => fixture.cleanup(), 60_000);

describe('Standalone Chat through canonical private migrations', () => {
  it('deploys all migrations and seeds exactly ten universally available badges without possessions', async () => {
    expect(fixture.migrationStatus).toContain('up to date');
    const catalog = await appearance.get(identity());
    expect(catalog.catalog.filter(c => c.type === 'BADGE').map(c => c.displayName).sort()).toEqual(Object.values(badgeSymbols).sort());
    expect(catalog.catalog.filter(c => c.type === 'BADGE').every(c => c.owned && !c.isNew)).toBe(true);
    expect(await db.playerCosmetic.count()).toBe(0);
    expect(await db.player.findUnique({ where: { id: archived }, select: { equippedBadgeCosmeticId: true } })).toEqual({ equippedBadgeCosmeticId: null });
    const sql = readFileSync(new URL('../prisma/migrations/20261012220100_078_badge_catalog/migration.sql', import.meta.url), 'utf8');
    expect(sql).not.toMatch(/\bUPDATE\s+"?players"?\s+SET/iu);
    expect(sql).not.toMatch(/INSERT\s+INTO\s+"player_cosmetics"/iu);
  });
  it('equips one free badge, preserves other cosmetics and projects its current value on old messages', async () => {
    const before = await db.player.findUniqueOrThrow({ where: { id: owner } });
    const message = await chat.send(identity(), 'Message antérieur', randomUUID());
    const badges = await db.cosmeticDefinition.findMany({ where: { type: 'BADGE' }, orderBy: { externalKey: 'asc' } });
    for (const badge of badges.slice(0, 2)) {
      expect((await appearance.equip(identity(), 'BADGE', badge.id)).badgeSymbol).toBe(badge.displayName);
      expect((await chat.list(identity())).messages.find(m => m.id === message.message.id)?.author?.badgeSymbol).toBe(badge.displayName);
    }
    const after = await db.player.findUniqueOrThrow({ where: { id: owner } });
    expect(after.equippedAvatarCosmeticId).toBe(before.equippedAvatarCosmeticId);
    expect(after.equippedTitleCosmeticId).toBe(before.equippedTitleCosmeticId);
    expect(await db.playerCosmetic.count()).toBe(0);
    expect((await appearance.equip(identity(), 'BADGE', null)).badgeSymbol).toBeNull();
    expect((await db.globalChatMessage.findUniqueOrThrow({ where: { id: message.message.id } })).content).toBe('Message antérieur');
  });
  it('refuses wrong type, forged value, disabled badge and archived actor', async () => {
    const badge = await db.cosmeticDefinition.findFirstOrThrow({ where: { type: 'BADGE' } });
    await expect(appearance.equip(identity(), 'TITLE', badge.id)).rejects.toMatchObject({ code: 'COSMETIC_TYPE_MISMATCH' });
    await expect(db.cosmeticDefinition.create({ data: { externalKey: 'badge:forged', type: 'BADGE', displayName: '', visibility: 'VISIBLE' } })).rejects.toThrow();
    await db.cosmeticDefinition.update({ where: { id: badge.id }, data: { isActive: false } });
    await expect(appearance.equip(identity(), 'BADGE', badge.id)).rejects.toMatchObject({ code: 'COSMETIC_UNAVAILABLE' });
    await db.cosmeticDefinition.update({ where: { id: badge.id }, data: { isActive: true } });
    await expect(appearance.equip({ subject: archived }, 'BADGE', badge.id)).rejects.toThrow();
  });
  it('freezes the first complete text/presentation across concurrent publishers and reloads', async () => {
    const sent = await chat.send(identity(), '!pull 1', randomUUID());
    const presentation: StructuredChatResult = { version: 1, command: 'pull', title: 'Invocation ×1', source: { channel: 'INTERNAL_CHAT', commandMessageId: sent.message.id }, characters: [{ id: 'fixture', name: 'Fixture', portrait: null, rarity: 5, constellation: 0, isNew: true }], facts: ['Coût : 160 Primos'] };
    const candidates = [{ content: 'Gain A', presentation }, { content: 'Gain B', presentation: { ...presentation, title: 'Concurrent' } }];
    const [a, b] = await Promise.all([chat.freezeCommandResult(sent.message.id, candidates[0]!), chat.freezeCommandResult(sent.message.id, candidates[1]!) ]);
    expect(a).toEqual(b); expect(await chat.readCommandResult(sent.message.id)).toEqual(a);
    const [one, two] = await Promise.all([chat.publishGameResult(sent.message.id, a.content, a.presentation), chat.publishGameResult(sent.message.id, b.content, b.presentation)]);
    expect(one.message.id).toBe(two.message.id);
    const reloaded = (await chat.list(identity())).messages.find(m => m.id === one.message.id)!;
    expect(reloaded.resultPresentation).toEqual(a.presentation);
    expect(await db.globalChatMessage.count({ where: { replyToMessageId: sent.message.id, messageType: 'GAME_RESULT' } })).toBe(1);
    await db.globalChatMessage.update({ where: { id: one.message.id }, data: { deletionState: 'MODERATION', deletedAt: new Date() } });
    expect((await chat.list(identity())).messages.find(m => m.id === one.message.id)?.resultPresentation).toBeNull();
  });
  it('persists the full bounded vote catalog with long official portraits and rejects budgets for other commands', async () => {
    const sent = await chat.send(identity(), '!vote', randomUUID());
    const portrait = `https://fixture.supabase.co/storage/v1/object/public/character-catalog/characters/${randomUUID()}/icon/${'a'.repeat(64)}.png`;
    const presentation: StructuredChatResult = { version: 1, command: 'vote', compact: true, title: 'Votes bannière', source: { channel: 'INTERNAL_CHAT', commandMessageId: sent.message.id }, facts: [], characters: Array.from({ length: 200 }, (_, i) => ({ id: randomUUID(), name: `${'🌙'.repeat(110)}${i}`, portrait, rarity: 5, constellation: null, elementKey: 'cryo', voteCount: i })) };
    expect(Buffer.byteLength(JSON.stringify(presentation))).toBeGreaterThan(16_384);
    const frozen = await chat.freezeCommandResult(sent.message.id, { content: '🗳️ Votes bannière', presentation });
    const published = await chat.publishGameResult(sent.message.id, frozen.content, frozen.presentation);
    expect((await chat.list(identity())).messages.find(m => m.id === published.message.id)?.resultPresentation?.characters).toHaveLength(200);
    expect(await chat.readCommandResult(sent.message.id)).toEqual(frozen);
    await expect(chat.freezeCommandResult(sent.message.id, { content: 'overflow', presentation: { ...presentation, characters: [...presentation.characters, presentation.characters[0]!] } })).rejects.toThrow('Présentation Chat invalide');
    await expect(chat.freezeCommandResult(sent.message.id, { content: 'overflow', presentation: { ...presentation, command: 'team' } })).rejects.toThrow('Présentation Chat invalide');
    const largeOrdinary = { ...presentation, command: 'team', characters: [], facts: Array(24).fill('🌙'.repeat(300)) };
    await expect(chat.freezeCommandResult(sent.message.id, { content: 'overflow', presentation: largeOrdinary as StructuredChatResult })).rejects.toThrow('Présentation Chat invalide');
    await expect(db.globalChatMessage.create({ data: { messageType: 'GAME_RESULT', sourceChannel: 'SYSTEM', authorPlayerId: owner, content: 'wrong author', resultPresentation: presentation as never } })).rejects.toThrow('global_chat_messages_result_presentation_check');
    await expect(db.globalChatMessage.create({ data: { messageType: 'GAME_RESULT', sourceChannel: 'SYSTEM', content: 'ordinary overflow', resultPresentation: largeOrdinary as never } })).rejects.toThrow('global_chat_messages_result_presentation_check');
    expect(fixture.migrationStatus).toContain('up to date');
    const guards = await db.$queryRaw<{ rls: boolean; anon: boolean; authenticated: boolean }[]>`SELECT relrowsecurity rls, has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') anon, has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') authenticated FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND relname='global_chat_messages'`;
    expect(guards).toEqual([{ rls: true, anon: false, authenticated: false }]);
  });
});
