import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DirectMessageReportService } from '../src/application/direct-messages/direct-message-report-service.js';
import { GetCurrentPlayer } from '../src/application/player/get-current-player.js';
import { PrismaCurrentPlayerStore } from '../src/infrastructure/database/prisma-current-player-store.js';
import { isolatedBatchDatabase } from './isolated-batch-database.js';

const fixture = isolatedBatchDatabase();
const db = fixture.database;
const service = new DirectMessageReportService(db, new GetCurrentPlayer(new PrismaCurrentPlayerStore(db)));
const as = (subject: string) => ({ subject });
const orderBases = new Map<string, bigint>();
let nextOrderBase = 0n;

async function player(label: string, role?: 'MODERATOR' | 'TESTER' | 'ADMIN') {
  const subject = `dm-report-${randomUUID()}`;
  const row = await db.player.create({ data: { displayName: label, webIdentity: { create: { provider: 'supabase', providerSubject: subject } }, rolesGranted: role ? { create: { role, source: 'report-test' } } : undefined } });
  return { id: row.id, identity: as(subject) };
}

async function thread(label: string) {
  const author = await player(`${label} Auteur`), reporter = await player(`${label} Reporter`);
  const pair = [author.id, reporter.id].sort();
  const conversation = await db.directConversation.create({ data: { playerAId: pair[0]!, playerBId: pair[1]!, participants: { create: [{ playerId: author.id }, { playerId: reporter.id }] } } });
  orderBases.set(conversation.id, nextOrderBase); nextOrderBase += 10_000n;
  return { author, reporter, conversation };
}

async function message(conversationId: string, authorPlayerId: string, order: bigint, content = `Message ${order}`, deletedAt: Date | null = null) {
  const operation = await db.businessOperation.create({ data: { playerId: authorPlayerId, operationType: 'report-test.message', sourceChannel: 'UI', idempotencyKey: randomUUID(), status: 'COMPLETED', completedAt: new Date() } });
  return db.directMessage.create({ data: { conversationId, authorPlayerId, operationId: operation.id, submissionOrder: (orderBases.get(conversationId) ?? 0n) + order, content, deletedAt } });
}

beforeAll(async () => fixture.setup(), 60_000);
afterAll(async () => fixture.cleanup(), 60_000);

describe('private direct-message reports on isolated PostgreSQL', () => {
  it('previews exactly ten-before/target/ten-after in ascending order and masks context tombstones', async () => {
    const { author, reporter, conversation } = await thread('Preview');
    const rows: Awaited<ReturnType<typeof message>>[] = [];
    for (let index = 1; index <= 25; index += 1) rows.push(await message(conversation.id, index % 2 ? author.id : reporter.id, BigInt(index), `Contexte ${index}`, index === 5 ? new Date() : null));
    const target = rows[12]!;
    const preview = await service.preview(reporter.identity, conversation.id, target.id);
    expect(preview.context).toHaveLength(21);
    expect(preview.context.map(row => row.id)).toEqual(rows.slice(2, 23).map(row => row.id));
    expect(preview.context.map(row => BigInt(row.submissionOrder)).every((order, index, all) => index === 0 || order > all[index - 1]!)).toBe(true);
    expect(preview.context.find(row => row.id === rows[4]!.id)).toMatchObject({ content: null, deletedAt: expect.any(String) });
    expect(preview.message).toMatchObject({ id: target.id, content: 'Contexte 13', authorDisplayName: 'Preview Auteur' });
    expect(preview.snapshotFingerprint).toMatch(/^[0-9a-f]{64}$/u);
  }, 30_000);

  it('rejects own/deleted/outsider targets but allows blocked/read-only and an active high-rank historical message', async () => {
    const { author, reporter, conversation } = await thread('Rules');
    const outsider = await player('Rules Outsider');
    const own = await message(conversation.id, reporter.id, 1n, 'Own');
    const deleted = await message(conversation.id, author.id, 2n, 'Deleted', new Date());
    const ancient = await message(conversation.id, author.id, 900n, 'Still active beyond 500');
    await db.playerBlock.create({ data: { blockerPlayerId: reporter.id, blockedPlayerId: author.id } });
    await expect(service.preview(reporter.identity, conversation.id, own.id)).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_REPORT_UNAVAILABLE' });
    await expect(service.preview(reporter.identity, conversation.id, deleted.id)).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_REPORT_UNAVAILABLE' });
    await expect(service.preview(outsider.identity, conversation.id, ancient.id)).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_REPORT_UNAVAILABLE' });
    const preview = await service.preview(reporter.identity, conversation.id, ancient.id);
    expect(await service.report(reporter.identity, conversation.id, ancient.id, preview.snapshotFingerprint)).toEqual({ reported: true, duplicate: false });
  });

  it('rejects stale target/context fingerprints, accepts a refreshed preview, deduplicates and freezes evidence without notifications', async () => {
    const { author, reporter, conversation } = await thread('Freeze');
    const before = await message(conversation.id, reporter.id, 1n, 'Before');
    const target = await message(conversation.id, author.id, 2n, 'Original');
    const first = await service.preview(reporter.identity, conversation.id, target.id);
    await db.directMessage.update({ where: { id: target.id }, data: { content: 'Edited before confirm', editedAt: new Date() } });
    await expect(service.report(reporter.identity, conversation.id, target.id, first.snapshotFingerprint)).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_REPORT_PREVIEW_STALE', statusCode: 409 });
    expect(await db.directMessageReport.count({ where: { messageId: target.id } })).toBe(0);
    const second = await service.preview(reporter.identity, conversation.id, target.id);
    const future = await message(conversation.id, reporter.id, 3n, 'New context');
    await expect(service.report(reporter.identity, conversation.id, target.id, second.snapshotFingerprint)).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_REPORT_PREVIEW_STALE' });
    const refreshed = await service.preview(reporter.identity, conversation.id, target.id);
    const notificationsBefore = await db.notification.count({ where: { playerId: author.id } });
    expect(await service.report(reporter.identity, conversation.id, target.id, refreshed.snapshotFingerprint)).toEqual({ reported: true, duplicate: false });
    expect(await service.report(reporter.identity, conversation.id, target.id, '0'.repeat(64))).toEqual({ reported: true, duplicate: true });
    expect(await db.directMessageReport.count({ where: { messageId: target.id } })).toBe(1);
    const frozen = await db.directMessageReport.findFirstOrThrow({ where: { messageId: target.id } });
    await db.directMessage.update({ where: { id: target.id }, data: { content: null, deletedAt: new Date(), contentPurgedAt: new Date() } });
    await message(conversation.id, author.id, 4n, 'After report');
    const unchanged = await db.directMessageReport.findFirstOrThrow({ where: { messageId: target.id } });
    expect(unchanged.messageSnapshot).toEqual(frozen.messageSnapshot);
    expect(unchanged.contextSnapshot).toEqual(frozen.contextSnapshot);
    expect(JSON.stringify(unchanged.contextSnapshot)).toContain(before.id);
    expect(JSON.stringify(unchanged.contextSnapshot)).toContain(future.id);
    expect(JSON.stringify(unchanged.contextSnapshot)).not.toContain('After report');
    expect(await db.notification.count({ where: { playerId: author.id } })).toBe(notificationsBefore);
  });

  it('allows ADMIN/MODERATOR frozen list/detail only and refuses TESTER/player access', async () => {
    const { author, reporter, conversation } = await thread('Moderation');
    const target = await message(conversation.id, author.id, 1n, 'Proof only');
    const preview = await service.preview(reporter.identity, conversation.id, target.id);
    await service.report(reporter.identity, conversation.id, target.id, preview.snapshotFingerprint);
    const admin = await player('Report Admin', 'ADMIN'), moderator = await player('Report Moderator', 'MODERATOR'), tester = await player('Report Tester', 'TESTER'), ordinary = await player('Report Player');
    for (const actor of [admin, moderator]) {
      const page = await service.list(actor.identity, 1);
      expect(page).toMatchObject({ page: 1, pageSize: 20, totalPages: 1 });
      const summary = page.reports.find(report => (report.message as { id?: string }).id === target.id)!;
      const detail = await service.detail(actor.identity, summary.id);
      expect(detail).toMatchObject({ message: { content: 'Proof only' }, context: [{ content: 'Proof only' }] });
      expect(await db.notification.count({ where: { playerId: author.id } })).toBe(0);
    }
    await expect(service.list(tester.identity, 1)).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN', statusCode: 403 });
    await expect(service.list(ordinary.identity, 1)).rejects.toMatchObject({ code: 'MODERATION_FORBIDDEN', statusCode: 403 });
    await expect(service.detail(admin.identity, randomUUID())).rejects.toMatchObject({ code: 'DIRECT_MESSAGE_REPORT_NOT_FOUND', statusCode: 404 });
  });

  it('keeps the public table RLS-enabled and browser roles grant-free', async () => {
    const result = await fixture.admin.query<{ relrowsecurity: boolean; browser_grants: string }>(`SELECT c.relrowsecurity,
      (SELECT count(*)::text FROM information_schema.role_table_grants g WHERE g.table_schema = 'public' AND g.table_name = 'direct_message_reports' AND g.grantee IN ('PUBLIC', 'anon', 'authenticated')) AS browser_grants
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'direct_message_reports'`);
    expect(result.rows).toEqual([{ relrowsecurity: true, browser_grants: '0' }]);
  });
});
