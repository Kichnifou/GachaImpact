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

async function message(conversationId: string, authorPlayerId: string, order: bigint, content = `Message ${order}`, deletedAt: Date | null = null, replyToMessageId: string | null = null) {
  const operation = await db.businessOperation.create({ data: { playerId: authorPlayerId, operationType: 'report-test.message', sourceChannel: 'UI', idempotencyKey: randomUUID(), status: 'COMPLETED', completedAt: new Date() } });
  return db.directMessage.create({ data: { conversationId, authorPlayerId, operationId: operation.id, submissionOrder: (orderBases.get(conversationId) ?? 0n) + order, content, deletedAt, replyToMessageId } });
}

beforeAll(async () => fixture.setup(), 60_000);
afterAll(async () => fixture.cleanup(), 60_000);

describe('private direct-message reports on isolated PostgreSQL', () => {
  it('previews only immediate neighbours while fingerprinting and storing the full 10/1/10 evidence', async () => {
    const { author, reporter, conversation } = await thread('Preview');
    const rows: Awaited<ReturnType<typeof message>>[] = [];
    for (let index = 1; index <= 25; index += 1) rows.push(await message(conversation.id, index % 2 ? author.id : reporter.id, BigInt(index), `Contexte ${index}`, index === 12 ? new Date() : null));
    const target = rows[12]!;
    const preview = await service.preview(reporter.identity, conversation.id, target.id);
    expect(preview.context).toHaveLength(3);
    expect(preview.context.map(row => row.id)).toEqual(rows.slice(11, 14).map(row => row.id));
    expect(preview.context.map(row => BigInt(row.submissionOrder)).every((order, index, all) => index === 0 || order > all[index - 1]!)).toBe(true);
    expect(preview.context[0]).toMatchObject({ content: null, deletedAt: expect.any(String) });
    expect(preview.message).toMatchObject({ id: target.id, content: 'Contexte 13', authorDisplayName: 'Preview Auteur' });
    expect(preview.snapshotFingerprint).toMatch(/^[0-9a-f]{64}$/u);
    await service.report(reporter.identity, conversation.id, target.id, preview.snapshotFingerprint);
    const stored = await db.directMessageReport.findFirstOrThrow({ where: { messageId: target.id } });
    expect(stored.contextSnapshot).toEqual(rows.slice(2, 23).map(projected => expect.objectContaining({ id: projected.id })));
  }, 30_000);

  it('condenses edge previews to target plus available immediate neighbours', async () => {
    const firstThread = await thread('First edge');
    const first = await message(firstThread.conversation.id, firstThread.author.id, 1n, 'First');
    const next = await message(firstThread.conversation.id, firstThread.reporter.id, 2n, 'Next');
    expect((await service.preview(firstThread.reporter.identity, firstThread.conversation.id, first.id)).context.map(row => row.id)).toEqual([first.id, next.id]);

    const lastThread = await thread('Last edge');
    const previous = await message(lastThread.conversation.id, lastThread.reporter.id, 1n, 'Previous');
    const last = await message(lastThread.conversation.id, lastThread.author.id, 2n, 'Last');
    expect((await service.preview(lastThread.reporter.identity, lastThread.conversation.id, last.id)).context.map(row => row.id)).toEqual([previous.id, last.id]);

    const singleThread = await thread('Single edge');
    const single = await message(singleThread.conversation.id, singleThread.author.id, 1n, 'Single');
    expect((await service.preview(singleThread.reporter.identity, singleThread.conversation.id, single.id)).context.map(row => row.id)).toEqual([single.id]);
  });

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
    const target = await message(conversation.id, author.id, 2n, 'Original', null, before.id);
    const first = await service.preview(reporter.identity, conversation.id, target.id);
    expect(first.message).toMatchObject({ replyToMessageId: before.id, replyPreview: 'Before' });
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
    expect(frozen.messageSnapshot).toMatchObject({ replyToMessageId: before.id, replyPreview: 'Before' });
    await db.directMessage.update({ where: { id: before.id }, data: { content: 'Before edited', editedAt: new Date() } });
    await db.directMessage.update({ where: { id: target.id }, data: { content: null, deletedAt: new Date(), contentPurgedAt: new Date() } });
    await message(conversation.id, author.id, 4n, 'After report');
    const unchanged = await db.directMessageReport.findFirstOrThrow({ where: { messageId: target.id } });
    expect(unchanged.messageSnapshot).toEqual(frozen.messageSnapshot);
    expect(unchanged.messageSnapshot).toMatchObject({ replyToMessageId: before.id, replyPreview: 'Before' });
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

  it('lets ADMIN/MODERATOR delete only the report with content-free audit and no MP or notification impact', async () => {
    const createReport = async (label: string) => {
      const current = await thread(label);
      const target = await message(current.conversation.id, current.author.id, 1n, `${label} private content`);
      const preview = await service.preview(current.reporter.identity, current.conversation.id, target.id);
      await service.report(current.reporter.identity, current.conversation.id, target.id, preview.snapshotFingerprint);
      const report = await db.directMessageReport.findFirstOrThrow({ where: { messageId: target.id } });
      return { ...current, target, report };
    };
    const moderator = await player('Delete Moderator', 'MODERATOR'), admin = await player('Delete Admin', 'ADMIN');
    const tester = await player('Delete Tester', 'TESTER'), ordinary = await player('Delete Player');
    const first = await createReport('Delete one');
    await expect(service.delete(tester.identity, first.report.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.delete(ordinary.identity, first.report.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.delete(admin.identity, randomUUID())).rejects.toMatchObject({ statusCode: 404 });
    const messagesBefore = await db.directMessage.count({ where: { conversationId: first.conversation.id } });
    const notificationsBefore = await db.notification.count({ where: { playerId: { in: [first.author.id, first.reporter.id] } } });
    expect(await service.delete(moderator.identity, first.report.id)).toEqual({ deleted: true });
    expect(await db.directMessageReport.findUnique({ where: { id: first.report.id } })).toBeNull();
    expect(await db.directMessage.count({ where: { conversationId: first.conversation.id } })).toBe(messagesBefore);
    expect(await db.directConversation.findUnique({ where: { id: first.conversation.id } })).not.toBeNull();
    expect(await db.notification.count({ where: { playerId: { in: [first.author.id, first.reporter.id] } } })).toBe(notificationsBefore);
    const audit = await db.adminAuditEntry.findFirstOrThrow({ where: { actorPlayerId: moderator.id, action: 'delete-direct-message-report' } });
    expect(JSON.stringify(audit)).not.toContain('private content');
    expect(audit).toMatchObject({ targetPlayerId: first.author.id, domain: 'community', before: { reportId: first.report.id, reportedPlayerId: first.author.id }, after: { deleted: true } });
    const second = await createReport('Delete two');
    expect(await service.delete(admin.identity, second.report.id)).toEqual({ deleted: true });
  });

  it('keeps the public table RLS-enabled and browser roles grant-free', async () => {
    const result = await fixture.admin.query<{ relrowsecurity: boolean; browser_grants: string }>(`SELECT c.relrowsecurity,
      (SELECT count(*)::text FROM information_schema.role_table_grants g WHERE g.table_schema = 'public' AND g.table_name = 'direct_message_reports' AND g.grantee IN ('PUBLIC', 'anon', 'authenticated')) AS browser_grants
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'direct_message_reports'`);
    expect(result.rows).toEqual([{ relrowsecurity: true, browser_grants: '0' }]);
  });
});
