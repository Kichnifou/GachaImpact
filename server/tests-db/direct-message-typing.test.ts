import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DirectMessageService } from '../src/application/direct-messages/direct-message-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase();
const db = fixture.database;
let now = new Date('2097-09-27T12:00:00Z');
const service = new DirectMessageService(db, new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)), { now: () => now });
const as = (subject: string) => ({ subject });
let alice: string, bob: string, charlie: string, firstId: string, secondId: string;

async function createPlayer(displayName: string) {
  const id = randomUUID();
  await db.player.create({ data: { id, displayName, webIdentity: { create: { provider: 'supabase', providerSubject: id } } } });
  return id;
}
async function acceptedConversation(from: string, to: string) {
  const initiated = await service.initiate(as(from), to, 'Premier message', randomUUID());
  await service.resolve(as(to), initiated.conversationId as string, initiated.requestId as string, 'ACCEPT', randomUUID());
  return initiated.conversationId as string;
}

beforeAll(async () => {
  await fixture.setup();
  alice = await createPlayer('Alice Typing'); bob = await createPlayer('Bob Typing'); charlie = await createPlayer('Charlie Typing');
  firstId = await acceptedConversation(alice, bob);
  secondId = await acceptedConversation(alice, charlie);
}, 60_000);
afterAll(() => fixture.cleanup(), 60_000);

describe('ephemeral direct-message typing', () => {
  it('applies migration 054 SQL safely in a private DDL schema without changing RLS', async () => {
    const migration = readFileSync('prisma/migrations/20260927230000_054_add_direct_message_typing_state/migration.sql', 'utf8');
    const schema = `typing_ddl_${randomUUID().replaceAll('-', '')}`;
    await fixture.admin.query('BEGIN');
    try {
      await fixture.admin.query(`CREATE SCHEMA "${schema}"`);
      await fixture.admin.query(`SET LOCAL search_path TO "${schema}"`);
      await fixture.admin.query('CREATE TABLE direct_conversation_participants (conversation_id uuid NOT NULL, player_id uuid NOT NULL)');
      await fixture.admin.query('ALTER TABLE direct_conversation_participants ENABLE ROW LEVEL SECURITY');
      await fixture.admin.query(migration);
      const column = await fixture.admin.query<{ data_type: string; is_nullable: string }>('SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3', [schema, 'direct_conversation_participants', 'typing_until']);
      const rls = await fixture.admin.query<{ rowsecurity: boolean }>('SELECT c.relrowsecurity AS rowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2', [schema, 'direct_conversation_participants']);
      expect(column.rows).toEqual([{ data_type: 'timestamp with time zone', is_nullable: 'YES' }]);
      expect(rls.rows).toEqual([{ rowsecurity: true }]);
    } finally { await fixture.admin.query('ROLLBACK'); }
  });

  it('shows only the other participant while a heartbeat is fresh, then clears or expires', async () => {
    const operations = await db.businessOperation.count();
    const notifications = await db.notification.count();
    const first = await service.setTyping(as(alice), firstId, true);
    expect(first.typingUntil).toBe(new Date(now.getTime() + 4_000).toISOString());
    expect((await db.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId: firstId, playerId: alice } } })).typingUntil).toEqual(new Date(first.typingUntil!));
    expect((await service.messages(as(bob), firstId)).otherTypingUntil).toBe(first.typingUntil);
    expect((await service.messages(as(alice), firstId)).otherTypingUntil).toBeNull();
    expect((await service.messages(as(charlie), secondId)).otherTypingUntil).toBeNull();
    now = new Date(now.getTime() + 2_000);
    const renewed = await service.setTyping(as(alice), firstId, true);
    expect(Date.parse(renewed.typingUntil!)).toBe(Date.parse(first.typingUntil!) + 2_000);
    await service.setTyping(as(alice), firstId, false);
    expect((await service.messages(as(bob), firstId)).otherTypingUntil).toBeNull();
    await service.setTyping(as(alice), firstId, true);
    now = new Date(now.getTime() + 4_001);
    expect((await service.messages(as(bob), firstId)).otherTypingUntil).toBeNull();
    expect(await db.businessOperation.count()).toBe(operations);
    expect(await db.notification.count()).toBe(notifications);
    expect(await db.resourceMovement.count()).toBe(0);
    expect(await db.playerProgression.count()).toBe(0);
    expect(await db.globalChatMessage.count()).toBe(0);
  });

  it('allows archived participants to type without unarchiving, projects it, and reactivates only on a real send', async () => {
    await service.archive(as(alice), firstId, true);
    await service.archive(as(bob), firstId, true);
    const before = await db.directConversationParticipant.findMany({ where: { conversationId: firstId }, orderBy: { playerId: 'asc' } });
    const operations = await db.businessOperation.count();
    const typing = await service.setTyping(as(alice), firstId, true);
    expect(Date.parse(typing.typingUntil!)).toBeGreaterThan(now.getTime());
    expect((await service.messages(as(bob), firstId)).otherTypingUntil).toBe(typing.typingUntil);
    const after = await db.directConversationParticipant.findMany({ where: { conversationId: firstId }, orderBy: { playerId: 'asc' } });
    expect(after.map(row => row.archivedAt)).toEqual(before.map(row => row.archivedAt));
    expect(after.every(row => row.archivedAt !== null)).toBe(true);
    expect(await db.businessOperation.count()).toBe(operations);
    await service.send(as(alice), firstId, 'Message depuis les archives', randomUUID());
    expect(await db.directConversationParticipant.count({ where: { conversationId: firstId, archivedAt: { not: null } } })).toBe(0);
  });

  it('refuses nonmembers and blocked archived senders, but permits cleanup after permission changes', async () => {
    await expect(service.setTyping(as(charlie), firstId, true)).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_UNAVAILABLE' });
    await service.archive(as(alice), firstId, true);
    await service.setTyping(as(alice), firstId, true);
    const bobBefore = await db.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId: firstId, playerId: bob } } });
    expect(bobBefore.typingUntil).toBeNull();
    await db.playerBlock.create({ data: { blockerPlayerId: bob, blockedPlayerId: alice } });
    await expect(service.setTyping(as(alice), firstId, true)).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_FORBIDDEN' });
    expect((await service.messages(as(bob), firstId)).otherTypingUntil).toBeNull();
    await service.setTyping(as(alice), firstId, false);
    const aliceAfter = await db.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId: firstId, playerId: alice } } });
    expect(aliceAfter.typingUntil).toBeNull();
    expect(aliceAfter.archivedAt).not.toBeNull();
    expect((await db.directConversationParticipant.findUniqueOrThrow({ where: { conversationId_playerId: { conversationId: firstId, playerId: bob } } })).typingUntil).toBeNull();
  });
});
