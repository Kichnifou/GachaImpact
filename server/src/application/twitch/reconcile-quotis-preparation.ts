import { z } from 'zod';
import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import { TwitchNativeAuthority, STREAMERBOT_PATH_DISABLED } from './twitch-native-authority.js';
import { assessTwitchOperationsInFlight } from './twitch-operations-in-flight.js';

const uuid = z.uuid(), twitchId = z.string().regex(/^[1-9][0-9]{0,127}$/);
const request = z.object({ operatorPlayerId: uuid, twitchUserId: twitchId, expectedPlayerId: uuid,
  expectedRevision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), receiptIds: z.tuple([uuid, uuid]),
}).strict().refine(value => value.receiptIds[0] !== value.receiptIds[1]);
export type QuotisPreparationReconciliation = z.infer<typeof request>;
const pilotState = z.object({ version: z.literal(1), playerId: uuid, handler: z.literal('quotis'), args: z.tuple([]),
  stage: z.literal('EXECUTING'), responses: z.tuple([]), chatterId: twitchId, senderId: twitchId, broadcasterId: twitchId,
  commandKey: z.string().min(1), replyParentMessageId: z.string().min(1).max(256),
}).passthrough();
const fail = () => { throw new Error('QUOTIS_PREPARATION_RECONCILIATION_REFUSED'); };
const object = (value: Prisma.JsonValue | undefined): Prisma.JsonObject | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null;
export const QUOTIS_PREPARATION_FAILURE = 'QUOTIS_READ_ONLY_PREPARATION_FAILED_RECONCILED';

/** Local operator recovery only: no resolver, business executor or Twitch transport is reachable. */
export async function reconcileQuotisPreparation(db: PrismaClient, config: AppConfig, input: QuotisPreparationReconciliation) {
  const parsed = request.safeParse(input);
  if (!parsed.success) return fail();
  const args = parsed.data;
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM twitch_native_authorities WHERE id = 'twitch-commands' FOR UPDATE`;
    await new TwitchNativeAuthority(db, config).requireOperator(tx, args.operatorPlayerId);
    const control = await tx.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } });
    // In the current pilot, persisted OFF makes both armed/enabled false. Never change authority here.
    if (control?.desiredMode !== 'OFF' || control.revision !== args.expectedRevision) return fail();
    await tx.$queryRaw`SELECT id FROM players WHERE id = ${args.expectedPlayerId}::uuid FOR UPDATE`;
    const identity = await tx.twitchIdentity.findUnique({ where: { twitchUserId: args.twitchUserId }, include: { player: true } });
    const target = await tx.twitchNativeTarget.findUnique({ where: { twitchUserId: args.twitchUserId } });
    if (identity?.playerId !== args.expectedPlayerId || identity.player.status !== 'ACTIVE'
      || target?.playerId !== args.expectedPlayerId || target.dataAuthority !== 'NATIVE' || !target.canary
      || target.acknowledgement !== STREAMERBOT_PATH_DISABLED || await tx.twitchNativeTarget.count({ where: { canary: true } }) !== 1
      || await tx.businessOperation.count({ where: { playerId: args.expectedPlayerId, status: 'PENDING' } })) return fail();
    const validated = [];
    for (const receiptId of [...args.receiptIds].sort()) {
      await tx.$queryRaw`SELECT id FROM twitch_event_receipts WHERE id = ${receiptId}::uuid FOR UPDATE`;
      const receipt = await tx.twitchEventReceipt.findUnique({ where: { id: receiptId } });
      const payload = object(receipt?.payloadMinimal ?? undefined), rawPilot = object(payload?.commandPilot);
      const pilot = pilotState.safeParse(rawPilot);
      if (!receipt || receipt.eventType !== 'channel.chat.message' || receipt.twitchUserId !== args.twitchUserId
        || receipt.state !== 'RECEIVED' || receipt.processedAt !== null || receipt.errorMessage !== null
        || !payload || Object.hasOwn(payload, 'preparationReconciliation') || !rawPilot || Object.hasOwn(rawPilot, 'intent')
        || !pilot.success || pilot.data.playerId !== args.expectedPlayerId || pilot.data.chatterId !== args.twitchUserId
        || pilot.data.commandKey !== `twitch-command:${pilot.data.broadcasterId}:${pilot.data.replyParentMessageId}`
        || receipt.externalReference !== `command-pilot:${pilot.data.commandKey}`
        || await tx.businessOperation.count({ where: { OR: [{ idempotencyKey: pilot.data.commandKey },
          { idempotencyKey: { endsWith: ':' + pilot.data.commandKey } }] } })) return fail();
      validated.push({ receiptId, payload, rawPilot });
    }
    const at = new Date();
    for (const { receiptId, payload, rawPilot } of validated) {
      await tx.twitchEventReceipt.update({ where: { id: receiptId }, data: { state: 'FAILED', processedAt: at,
        errorMessage: QUOTIS_PREPARATION_FAILURE,
        payloadMinimal: { ...payload, commandPilot: { ...rawPilot, stage: 'RESPONSES' }, preparationReconciliation: {
          version: 1, reason: QUOTIS_PREPARATION_FAILURE, actorPlayerId: args.operatorPlayerId, at: at.toISOString(),
          previousState: 'RECEIVED', previousStage: 'EXECUTING', resolverExecuted: false, responseSent: false,
        } } as Prisma.InputJsonValue,
      } });
    }
    const assessment = await assessTwitchOperationsInFlight(tx, args.twitchUserId, args.expectedPlayerId);
    if (assessment.blocked || assessment.unresolvedOutbound) return fail();
    await tx.twitchNativeAudit.create({ data: { actorPlayerId: args.operatorPlayerId, twitchUserId: args.twitchUserId,
      action: QUOTIS_PREPARATION_FAILURE, mode: control.desiredMode, revision: control.revision } });
    return { status: QUOTIS_PREPARATION_FAILURE, reconciled: validated.length, operationsInFlight: false } as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
}

/** Exactly two explicit receipts, public schema and exact identity/revision; no generic retry or mode argument. */
export function parseQuotisReconciliationArguments(args: readonly string[]) {
  const options = z.object({ schema: z.literal('public'), 'operator-player': uuid, 'twitch-id': twitchId, 'expected-player': uuid,
    'expected-revision': z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().min(1).max(Number.MAX_SAFE_INTEGER)),
    'receipt-1': uuid, 'receipt-2': uuid }).strict();
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index], value = args[index + 1];
    if (!option?.startsWith('--') || !value || value.startsWith('--') || Object.hasOwn(values, option.slice(2))) return fail();
    values[option.slice(2)] = value;
  }
  const result = options.safeParse(values);
  if (!result.success) return fail();
  const value = result.data;
  return request.parse({ operatorPlayerId: value['operator-player'], twitchUserId: value['twitch-id'], expectedPlayerId: value['expected-player'],
    expectedRevision: value['expected-revision'], receiptIds: [value['receipt-1'], value['receipt-2']] });
}
