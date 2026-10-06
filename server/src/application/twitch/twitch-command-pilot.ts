import { TwitchNativeAuthority, type NativeAuthorityStore, type NativeAuthorityState, type NativeAuthorityMode } from './twitch-native-authority.js';
import { PrismaTwitchPlayerStore } from '../../infrastructure/database/prisma-twitch-player-store.js';
import type { TwitchMessageActivity } from './twitch-message-activity.js';
import { AppError } from '../../api/errors.js';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import type { CurrentPlayer } from '../../domain/player/current-player.js';
import { findChatCommand, parseChatCommand } from '../chat/chat-command-registry.js';
import type { FrozenCommandIntent } from './twitch-command-intent.js';
import { TwitchObservationConflict } from './twitch-event-observer.js';
import { twitchCommandOwner } from './twitch-command-coverage.js';
import type { PilotChatTransport, TwitchEventSubSubscriptionManager } from './twitch-eventsub-subscription-manager.js';
import { TwitchCommandSendError, type TwitchCommandChatClient } from '../../infrastructure/twitch/twitch-command-chat-client.js';

const twitchId = z.string().regex(/^\d+$/).max(128);
const envelope = z.object({ subscription: z.object({ id: z.string().min(1), type: z.literal('channel.chat.message'),
  version: z.literal('1'), status: z.literal('enabled'),
  condition: z.object({ broadcaster_user_id: twitchId, user_id: twitchId }).strict(),
  transport: z.object({ method: z.literal('webhook'), callback: z.string().optional() }),
}), event: z.object({ chatter_user_id: twitchId, broadcaster_user_id: twitchId,
  source_broadcaster_user_id: twitchId.nullish(), chatter_user_login: z.string().max(128).optional(), chatter_user_name: z.string().max(128).optional(), message_id: z.string().min(1).max(256), message: z.object({ text: z.string().max(2000) }), reply: z.object({ parent_message_id: z.string() }).nullish(),
}) });
const response = z.object({ text: z.string(), status: z.enum(['PENDING', 'SENDING', 'SENT', 'FAILED', 'AMBIGUOUS']),
  messageId: z.string().optional(), error: z.string().optional() });
const frozenIntent = z.object({ now: z.iso.datetime(), reads: z.record(z.string(), z.array(z.json())), memory: z.record(z.string(), z.string()),
  mutation: z.object({ path: z.string(), args: z.json() }).optional(), output: z.json().optional(), bannerId: z.string().optional(),
  targets: z.object({ gachaTargetId: z.string().nullable().optional(), eventEditionId: z.string().optional(), bannerId: z.string().optional(),
    activeTeam: z.object({ id: z.string().nullable(), members: z.array(z.object({ position: z.number().int(), characterId: z.string() })) }).optional(),
    expedition: z.object({ characterId: z.string().nullable(), departedAt: z.string().nullable() }).optional(), friendIds: z.array(z.string()).optional(), tradeIds: z.array(z.string()).optional(),
    combat: z.object({ encounterId: z.string(), characterIds: z.array(z.string()) }).optional(),
  }).optional() });
const execution = z.object({ version: z.literal(1), playerId: z.string(), actorName: z.string(),
  senderId: twitchId, broadcasterId: twitchId, chatterId: twitchId.optional(), replyParentMessageId: z.string().min(1).max(256),
  commandKey: z.string(), handler: z.string(), businessAt: z.iso.datetime().optional(), args: z.array(z.string()).optional(), intent: frozenIntent.optional(), stage: z.enum(['EXECUTING', 'RESPONSES']), responses: z.array(response) });
type Execution = z.infer<typeof execution>;
export type TwitchCommandExecutor = { capturedAt?(): Date; prepare?(player: CurrentPlayer, handler: string, args: readonly string[], usage: string, key: string, businessAt?: string): Promise<FrozenCommandIntent>; execute(player: CurrentPlayer, handler: string, args: readonly string[], usage: string, key: string, intent?: FrozenCommandIntent): Promise<string | readonly string[]> };
export type TwitchCommandSubscriptionInspector = Pick<TwitchEventSubSubscriptionManager, 'activationAvailable' | 'inspectPilotChatTransport'>;

/** Preserve presentation segments; split only an oversized segment, by Unicode characters. */
export function twitchResponseSegments(value: string | readonly string[]): string[] {
  return (typeof value === 'string' ? [value] : value).flatMap(segment => {
    const chars = Array.from(segment.replace(/[\r\n\u2028\u2029]/gu, ' ').trim());
    const chunks: string[] = [];
    for (let index = 0; index < chars.length; index += 500) chunks.push(chars.slice(index, index + 500).join('').trim());
    return chunks.filter(Boolean);
  });
}


export class TwitchCommandPilot {
  private transport?: PilotChatTransport;
  private transportRevision = -1;
  private readonly authority: NativeAuthorityStore;
  private readonly players: PrismaTwitchPlayerStore;
  constructor(private readonly db: PrismaClient, private readonly config: AppConfig,
    private readonly executor: TwitchCommandExecutor, private readonly outbound: Pick<TwitchCommandChatClient, 'send'>,
    private readonly parser: typeof findChatCommand = findChatCommand,
    private readonly subscriptions?: TwitchCommandSubscriptionInspector,
    private readonly messageActivity?: TwitchMessageActivity, authority?: NativeAuthorityStore, players?: PrismaTwitchPlayerStore) {
    this.authority = authority ?? new TwitchNativeAuthority(db, config);
    this.players = players ?? new PrismaTwitchPlayerStore(db, this.authority);
  }

  private async validateTransport(state: NativeAuthorityState) {
    if (state.desiredMode === 'OFF' || !state.operatorPlayerId || !this.config.twitch?.pilotPlayerIds.includes(state.operatorPlayerId)
      || this.config.twitch.pilotLogin !== 'kichnifou' || !this.config.twitchCommandPilot?.enabled
      || state.desiredMode === 'GLOBAL' && this.config.twitchCommandPilot.globalEnabled !== true) {
      this.transport = undefined; return false;
    }
    if (this.transport && this.transportRevision === state.revision && this.subscriptions?.activationAvailable) return true;
    this.transport = undefined;
    if (!this.subscriptions?.activationAvailable) return false;
    const identity = await this.db.twitchIdentity.findUnique({ where: { playerId: state.operatorPlayerId }, include: { player: true } });
    if (!identity || identity.player.status !== 'ACTIVE') return false;
    const transport = await this.subscriptions.inspectPilotChatTransport(state.operatorPlayerId, AbortSignal.timeout(3_000));
    if (!transport || transport.broadcasterId !== identity.twitchUserId || !twitchId.safeParse(transport.receiverId).success
      || this.config.twitchEventSub?.callbackUrl && transport.callback !== this.config.twitchEventSub.callbackUrl) return false;
    const latest = await this.authority.read();
    if (latest.revision !== state.revision || latest.desiredMode !== state.desiredMode) return false;
    this.transport = { ...transport }; this.transportRevision = state.revision;
    return true;
  }

  async status() {
    const capability = this.config.twitchCommandPilot?.enabled === true;
    try {
      const state = await this.authority.read();
      const valid = capability && await this.validateTransport(state);
      return { commandPilotCapabilityEnabled: capability, commandPilotArmed: state.desiredMode !== 'OFF',
        commandPilotEnabled: valid, desiredAuthority: state.desiredMode, effectiveAuthority: valid ? state.desiredMode : 'OFF', transportValid: valid };
    } catch {
      this.transport = undefined;
      return { commandPilotCapabilityEnabled: capability, commandPilotArmed: false, commandPilotEnabled: false,
        desiredAuthority: 'OFF', effectiveAuthority: 'OFF', transportValid: false, authorityUnavailable: true };
    }
  }
  private async enabled(twitchUserId?: string) {
    if (!(await this.status()).commandPilotEnabled) return false;
    try { return twitchUserId === undefined || await this.authority.covers(twitchUserId); } catch { return false; }
  }

  async configureAuthority(playerId: string, mode: NativeAuthorityMode, ids: readonly string[], acknowledgement?: string) {
    await this.authority.configure(playerId, mode, ids, acknowledgement);
    this.transport = undefined;
    return this.status();
  }
  async arm(playerId: string, acknowledgement?: string, ids?: readonly string[]) {
    if (this.config.twitchCommandPilot?.enabled !== true)
      throw new AppError('Capacité du pilote de commandes inactive.', 409, 'TWITCH_COMMAND_PILOT_OFF');
    const state = await this.authority.read();
    const identity = await this.db.twitchIdentity.findUnique({ where: { playerId }, include: { player: true } });
    if (!identity || identity.player.status !== 'ACTIVE' || !this.config.twitch?.pilotPlayerIds.includes(playerId)
      || this.config.twitch.pilotLogin !== 'kichnifou' || identity.login.toLowerCase() !== 'kichnifou')
      throw new AppError('Armement du pilote Twitch interdit.', 403, 'TWITCH_COMMAND_PILOT_FORBIDDEN');
    if (!this.subscriptions?.activationAvailable)
      throw new AppError('Transport Twitch indisponible.', 409, 'TWITCH_COMMAND_TRANSPORT_UNAVAILABLE');
    const transport = await this.subscriptions.inspectPilotChatTransport(playerId, AbortSignal.timeout(3_000)).catch(() => null);
    if (!transport || transport.broadcasterId !== identity.twitchUserId || !twitchId.safeParse(transport.receiverId).success
      || this.config.twitchEventSub?.callbackUrl && transport.callback !== this.config.twitchEventSub.callbackUrl)
      throw new AppError('Une subscription Chat active compatible est nécessaire.', 409, 'TWITCH_COMMAND_SUBSCRIPTION_INACTIVE');
    await this.authority.configure(playerId, 'CANARY', ids ?? [identity.twitchUserId], acknowledgement, state.revision);
    this.transport = undefined;
    return this.status();
  }
  async disarm(playerId: string) {
    await this.authority.configure(playerId, 'OFF', []);
    this.transport = undefined;
    return this.status();
  }

  async responseStatus(playerId: string) {
    const identity = await this.db.twitchIdentity.findUnique({ where: { playerId }, include: { player: true } });
    if (!identity || identity.player.status !== 'ACTIVE' || !this.config.twitch?.pilotPlayerIds.includes(playerId)
      || this.config.twitch.pilotLogin !== 'kichnifou' || identity.login.toLowerCase() !== 'kichnifou') return null;
    const receipt = await this.db.twitchEventReceipt.findFirst({ where: { twitchUserId: identity.twitchUserId,
      eventType: 'channel.chat.message', externalReference: { startsWith: 'command-pilot:' } }, orderBy: { receivedAt: 'desc' } });
    if (!receipt) return null;
    const saved = execution.safeParse((receipt.payloadMinimal as Record<string, Prisma.JsonValue> | null)?.commandPilot);
    if (!saved.success || saved.data.playerId !== playerId) return null;
    return { receiptId: receipt.id, state: receipt.state, stage: saved.data.stage,
      responses: saved.data.responses.map(row => row.status), error: receipt.errorMessage };
  }

  private async locked<T>(receiptId: string, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM twitch_event_receipts WHERE id = ${receiptId}::uuid FOR UPDATE`;
      return action(tx);
    }, { timeout: 60_000, maxWait: 10_000 });
  }

  /** Only the authenticated EventSub route calls this; observation/specialized consumers run first. */
  async consumeAuthenticated(raw: unknown, receiptId: string, executeCommands = true): Promise<void> {
    if (!await this.enabled() || this.config.twitch?.pilotLogin !== 'kichnifou') return;
    const parsed = envelope.safeParse(raw);
    if (!parsed.success) return;
    const { subscription, event } = parsed.data;
    const transport = this.transport;
    // The authorized subscription identifies the channel and receiver, never the Player author.
    if (!transport || subscription.id !== transport.subscriptionId
      || event.broadcaster_user_id !== transport.broadcasterId
      || subscription.condition.broadcaster_user_id !== transport.broadcasterId
      || subscription.condition.user_id !== transport.receiverId
      || subscription.transport.callback !== transport.callback
      || event.source_broadcaster_user_id && event.source_broadcaster_user_id !== transport.broadcasterId) return;
    // Authority precedes identity/provisioning, parser and every business effect.
    if (!executeCommands || !await this.enabled(event.chatter_user_id) || !event.message.text.trim()) return;
    const existing = await this.db.twitchIdentity.findUnique({ where: { twitchUserId: event.chatter_user_id }, include: { player: true } });
    if (!existing && await this.isNativeOutboundMessage(raw)) return;
    const identity = existing ?? await this.players.resolve({ twitchUserId: event.chatter_user_id,
      login: event.chatter_user_login ?? '', displayName: event.chatter_user_name ?? event.chatter_user_login ?? 'Voyageur', observedAt: this.executor.capturedAt?.() ?? new Date() });
    if (!await this.enabled(event.chatter_user_id) || transport !== this.transport || !identity || identity.player.status !== 'ACTIVE'
      || identity.twitchUserId !== event.chatter_user_id) return;
    if (!event.message.text.trim()) return;
    if (this.messageActivity) {
      const output = await this.consumeMessageActivity(identity.player, event, receiptId);
      if (output === null) return; // Native outbound echo, not a player message.
      if (!event.message.text.startsWith('!')) {
        if (output.length) await this.deliverActivityResponses(identity.player, event, receiptId, output, transport);
        else await this.completeMessageObservation(receiptId);
        return;
      }
    }
    if (!executeCommands || !event.message.text.startsWith('!')) return;
    const { root, args } = parseChatCommand(event.message.text);
    const definition = this.parser(root);
    const handler = definition?.handler ?? undefined;
    if (!definition || !handler || definition.permission !== 'PLAYER' || !definition.twitch || twitchCommandOwner(definition.name) !== 'GENERIC_NATIVE') {
      if (this.messageActivity) await this.completeMessageObservation(receiptId);
      return;
    }
    const read = (tx: Prisma.TransactionClient) => this.read(tx, receiptId, identity.twitchUserId);
    const save = (tx: Prisma.TransactionClient, minimal: Record<string, Prisma.JsonValue>, state: Execution) => this.save(tx, receiptId, minimal, state);
    // Commit the retention exemption BEFORE the business call, including its recoverable crash window.
    const owned = await this.locked(receiptId, async tx => {
      const key = `twitch-command:${event.broadcaster_user_id}:${event.message_id}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      const { receipt, minimal, saved } = await read(tx);
      const prior = await tx.twitchEventReceipt.findFirst({ where: { externalReference: `command-pilot:${key}`, id: { not: receiptId } } });
      if (prior) {
        if ((prior.payloadMinimal as Prisma.JsonObject)?.contentHash !== minimal.contentHash || prior.twitchUserId !== receipt.twitchUserId) throw new TwitchObservationConflict();
        return false;
      }
      if (saved) {
        if (saved.playerId !== identity.playerId || saved.handler !== handler) throw new Error('TWITCH_COMMAND_RECEIPT_CONFLICT');
        return true;
      }
      if (receipt.state !== 'RECEIVED' || receipt.externalReference !== null && !receipt.externalReference.startsWith('message-native:')) throw new Error('TWITCH_COMMAND_RECEIPT_CONFLICT');
      const activity = minimal.messageActivity as { now?: string } | undefined;
      await save(tx, minimal, { version: 1, playerId: identity.playerId, actorName: identity.player.displayName,
        senderId: transport.receiverId, chatterId: identity.twitchUserId, broadcasterId: event.broadcaster_user_id, replyParentMessageId: event.message_id,
        commandKey: key, handler, args, businessAt: activity?.now ?? this.executor.capturedAt?.().toISOString() ?? new Date().toISOString(),
        stage: 'EXECUTING', responses: [] });
      return true;
    });
    if (!owned) return;
    // Preparation has no explicit command effect; commit the resolved invocation before execution.
    await this.locked(receiptId, async tx => {
      const { minimal, saved } = await read(tx);
      if (!saved || saved.stage !== 'EXECUTING' || saved.intent || saved.args === undefined || !await this.enabled(event.chatter_user_id) || !this.executor.prepare) return;
      const intent = await this.executor.prepare({ ...identity.player, displayName: saved.actorName }, saved.handler, saved.args ?? args, definition.syntax, saved.commandKey, saved.businessAt);
      await save(tx, minimal, { ...saved, intent: frozenIntent.parse(intent) });
    });
    await this.locked(receiptId, async tx => {
      const { minimal, saved } = await read(tx);
      if (!saved || saved.stage !== 'EXECUTING' || !await this.enabled(event.chatter_user_id)) return;
      const output = await this.executor.execute({ ...identity.player, displayName: saved.actorName }, saved.handler, saved.args ?? args, definition.syntax, saved.commandKey, saved.intent);
      const segments = twitchResponseSegments(output);
      if (!segments.length) throw new Error('TWITCH_COMMAND_EMPTY_RESPONSE');
      await save(tx, minimal, { ...saved, stage: 'RESPONSES', responses: segments.map(text => ({ text, status: 'PENDING' })) });
    });
    await this.deliver(receiptId, { senderId: transport.receiverId, chatterId: identity.twitchUserId, broadcasterId: event.broadcaster_user_id, replyParentMessageId: event.message_id });
  }

  async isNativeOutboundMessage(raw: unknown): Promise<boolean> {
    const parsed = envelope.safeParse(raw); if (!parsed.success) return false;
    const event = parsed.data.event;
    if (await this.db.twitchEventReceipt.findFirst({ where: { eventType: 'channel.chat.message', AND: [
      { payloadMinimal: { path: ['commandPilot', 'senderId'], equals: event.chatter_user_id } },
      { payloadMinimal: { path: ['commandPilot', 'broadcasterId'], equals: event.broadcaster_user_id } },
      { payloadMinimal: { path: ['commandPilot', 'responses'], array_contains: [{ messageId: event.message_id }] } },
    ] } })) return true;
    const replies = await this.db.twitchEventReceipt.findMany({ where: { eventType: 'channel.chat.message', externalReference: { startsWith: 'command-pilot:' }, payloadMinimal: { path: ['commandPilot', 'senderId'], equals: event.chatter_user_id } }, orderBy: { receivedAt: 'desc' }, take: 100 });
    if (replies.some(receipt => {
      const parsed = execution.safeParse((receipt.payloadMinimal as Record<string, Prisma.JsonValue> | null)?.commandPilot);
      return parsed.success && parsed.data.broadcasterId === event.broadcaster_user_id && parsed.data.senderId === event.chatter_user_id && parsed.data.responses.some(response => response.messageId === event.message_id
        || event.reply?.parent_message_id === parsed.data.replyParentMessageId && response.text === event.message.text && ['SENDING', 'AMBIGUOUS'].includes(response.status));
    })) return true;
    const gifts = await this.db.twitchEventReceipt.findMany({ where: { eventType: 'channel.channel_points_custom_reward_redemption.add', payloadMinimal: { path: ['remote', 'broadcasterId'], equals: event.broadcaster_user_id } }, orderBy: { receivedAt: 'desc' }, take: 100 });
    return event.chatter_user_id === event.broadcaster_user_id && gifts.some(receipt => {
      const remote = (receipt.payloadMinimal as Prisma.JsonObject)?.remote as Prisma.JsonObject | undefined;
      return remote?.messageId === event.message_id || remote?.announcementText === event.message.text && ['RESERVED', 'AMBIGUOUS'].includes(String(remote?.announcementState));
    });
  }

  private async completeMessageObservation(receiptId: string) {
    await this.db.twitchEventReceipt.updateMany({ where: { id: receiptId, externalReference: { startsWith: 'message-native:' } }, data: { state: 'PROCESSED', processedAt: new Date() } });
  }

  private async consumeMessageActivity(player: CurrentPlayer, event: z.infer<typeof envelope>['event'], receiptId: string) {
    if (await this.isNativeOutboundMessage({ subscription: { id: 'echo', type: 'channel.chat.message', version: '1', status: 'enabled', condition: { broadcaster_user_id: event.broadcaster_user_id, user_id: event.chatter_user_id }, transport: { method: 'webhook' } }, event })) return null;
    const normal = event.message.text.trim().length > 0 && !event.message.text.trimStart().startsWith('!');
    const length = Array.from(event.message.text.trim()).length;
    const canonical = await this.locked(receiptId, async tx => {
      const key = 'twitch-message:' + event.broadcaster_user_id + ':' + event.message_id;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      const { minimal, receipt } = await this.read(tx, receiptId, event.chatter_user_id);
      const prior = await tx.twitchEventReceipt.findFirst({ where: { eventType: 'channel.chat.message', twitchUserId: event.chatter_user_id, payloadMinimal: { path: ['messageActivity', 'key'], equals: key } }, orderBy: { receivedAt: 'asc' } });
      if (prior) {
        if ((prior.payloadMinimal as Prisma.JsonObject)?.contentHash !== minimal.contentHash) throw new TwitchObservationConflict();
        return prior.id;
      }
      const now = this.messageActivity!.capturedAt();
      await tx.twitchEventReceipt.update({ where: { id: receiptId }, data: { externalReference: receipt.externalReference ?? 'message-native:' + event.broadcaster_user_id + ':' + event.message_id,
        payloadMinimal: { ...minimal, messageActivity: { key, now: now.toISOString(), messageId: event.message_id, normal, length } } } });
      return receiptId;
    });
    // Reservation is committed before Event preparation can reconcile its existing owners.
    const activity = await this.locked(canonical, async tx => {
      const { minimal } = await this.read(tx, canonical, event.chatter_user_id);
      const prior = minimal.messageActivity as unknown as { now: string; plan?: Awaited<ReturnType<TwitchMessageActivity['prepare']>> };
      if (!prior.plan) {
        prior.plan = await this.messageActivity!.prepare(player, normal, new Date(prior.now));
        await tx.twitchEventReceipt.update({ where: { id: canonical }, data: { payloadMinimal: { ...minimal, messageActivity: prior } as Prisma.InputJsonValue } });
      }
      return prior;
    });
    if (!await this.enabled(event.chatter_user_id)) return [];
    return this.messageActivity!.consume(player, event.message_id, event.broadcaster_user_id, length, normal, new Date(activity.now), activity.plan);
  }

  private async deliverActivityResponses(player: CurrentPlayer, event: z.infer<typeof envelope>['event'], receiptId: string, output: readonly string[], transport: PilotChatTransport) {
    const owned = await this.locked(receiptId, async tx => {
      const key = 'twitch-message:' + event.broadcaster_user_id + ':' + event.message_id;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      if (await tx.twitchEventReceipt.findFirst({ where: { externalReference: 'command-pilot:' + key, id: { not: receiptId } } })) return false;
      const { minimal, saved } = await this.read(tx, receiptId, event.chatter_user_id);
      if (saved) return true;
      await this.save(tx, receiptId, minimal, { version: 1, playerId: player.id, actorName: player.displayName,
        senderId: transport.receiverId, chatterId: event.chatter_user_id, broadcasterId: event.broadcaster_user_id, replyParentMessageId: event.message_id,
        commandKey: 'twitch-message:' + event.broadcaster_user_id + ':' + event.message_id, handler: 'message', stage: 'RESPONSES',
        responses: twitchResponseSegments(output).map(text => ({ text, status: 'PENDING' })) });
      return true;
    });
    if (!owned) return;
    await this.deliver(receiptId, { senderId: transport.receiverId, chatterId: event.chatter_user_id, broadcasterId: event.broadcaster_user_id, replyParentMessageId: event.message_id });
  }

  /** Authenticated pilot operator only; no parser or business service is reachable from this recovery path. */
  async retryResponses(playerId: string, receiptId: string) {
    if (!await this.enabled()) throw new AppError('Pilote de commandes inactif.', 409, 'TWITCH_COMMAND_PILOT_OFF');
    const identity = await this.db.twitchIdentity.findUnique({ where: { playerId }, include: { player: true } });
    if (!identity || identity.player.status !== 'ACTIVE' || !this.config.twitch?.pilotPlayerIds.includes(playerId)
      || this.config.twitch.pilotLogin !== 'kichnifou' || identity.login.toLowerCase() !== 'kichnifou')
      throw new AppError('Reprise de réponse Twitch interdite.', 403, 'TWITCH_COMMAND_RETRY_FORBIDDEN');
    const target = await this.locked(receiptId, async tx => {
      const receipt = await tx.twitchEventReceipt.findUnique({ where: { id: receiptId } });
      const { saved } = await this.read(tx, receiptId, receipt?.twitchUserId ?? '');
      const actor = await tx.twitchIdentity.findUnique({ where: { twitchUserId: receipt!.twitchUserId! }, include: { player: true } });
      if (!this.transport || this.transport.broadcasterId !== identity.twitchUserId || !saved || !actor || actor.player.status !== 'ACTIVE'
        || !await this.authority.covers(actor.twitchUserId) || saved.playerId !== actor.playerId
        || saved.senderId !== this.transport.receiverId || saved.broadcasterId !== this.transport.broadcasterId)
        throw new AppError('Réponse Twitch introuvable.', 404, 'TWITCH_COMMAND_RESPONSE_NOT_FOUND');
      if (saved.stage !== 'RESPONSES' || saved.responses.some(row => row.status === 'SENDING' || row.status === 'AMBIGUOUS'))
        throw new AppError('Résultat de réponse incertain : contrôle opérateur requis.', 409, 'TWITCH_COMMAND_RESPONSE_AMBIGUOUS');
      return { senderId: saved.senderId, chatterId: receipt!.twitchUserId!, broadcasterId: saved.broadcasterId, replyParentMessageId: saved.replyParentMessageId };
    });
    await this.deliver(receiptId, target);
    return this.locked(receiptId, async tx => {
      const { receipt } = await this.read(tx, receiptId, target.chatterId);
      return { state: receipt.state };
    });
  }

  private async deliver(receiptId: string, target: { senderId: string; chatterId: string; broadcasterId: string; replyParentMessageId: string }) {
    const canSend = async () => await this.enabled(target.chatterId) && this.transport?.broadcasterId === target.broadcasterId && this.transport.receiverId === target.senderId;
    const read = (tx: Prisma.TransactionClient) => this.read(tx, receiptId, target.chatterId);
    const save = (tx: Prisma.TransactionClient, minimal: Record<string, Prisma.JsonValue>, state: Execution, final = false, error?: string) => this.save(tx, receiptId, minimal, state, final, error);
    // Persist SENDING before HTTP. Unknown outcomes never auto-retry; certain rejection retries response only.
    for (let index = 0; ; index++) {
      if (!await canSend()) return;
      const text = await this.locked(receiptId, async tx => {
        const { receipt, minimal, saved } = await read(tx);
        if (!await canSend() || !saved || receipt.state === 'PROCESSED') return null;
        if (saved.senderId !== target.senderId || saved.broadcasterId !== target.broadcasterId || saved.replyParentMessageId !== target.replyParentMessageId)
          throw new AppError('Transport de réponse modifié : contrôle opérateur requis.', 409, 'TWITCH_COMMAND_RESPONSE_TRANSPORT_CHANGED');
        const segment = saved.responses[index];
        if (!segment) return null;
        if (segment.status === 'SENT') return '';
        if (segment.status !== 'PENDING' && segment.status !== 'FAILED') return null;
        segment.status = 'SENDING'; delete segment.error;
        await save(tx, minimal, saved);
        return segment.text;
      });
      if (text === null) return;
      if (text === '') continue;
      let sentId: string | undefined, failure: TwitchCommandSendError | undefined;
      try {
        if (!await canSend()) throw new TwitchCommandSendError('CERTAIN', 'PILOT_DISABLED');
        sentId = await this.outbound.send({ broadcasterId: target.broadcasterId, senderId: target.senderId,
          message: text, replyParentMessageId: target.replyParentMessageId }, canSend);
      } catch (error) {
        failure = error instanceof TwitchCommandSendError ? error : new TwitchCommandSendError('AMBIGUOUS', 'UNKNOWN');
      }
      await this.locked(receiptId, async tx => {
        const { minimal, saved } = await read(tx);
        if (!saved || saved.responses[index]?.status !== 'SENDING') throw new Error('TWITCH_COMMAND_RESPONSE_CONFLICT');
        saved.responses[index] = failure?.reason === 'PILOT_DISABLED' ? { text, status: 'PENDING' }
          : failure ? { text, status: failure.certainty === 'CERTAIN' ? 'FAILED' : 'AMBIGUOUS', error: failure.reason }
          : { text, status: 'SENT', messageId: sentId! };
        await save(tx, minimal, saved, saved.responses.every(row => row.status === 'SENT'), failure?.reason === 'PILOT_DISABLED' ? undefined : failure?.reason);
      });
      if (failure) return;
    }
  }
  private async read(tx: Prisma.TransactionClient, receiptId: string, twitchUserId: string) {
    const receipt = await tx.twitchEventReceipt.findUnique({ where: { id: receiptId } });
    if (!receipt || receipt.eventType !== 'channel.chat.message' || receipt.twitchUserId !== twitchUserId)
      throw new AppError('Réponse Twitch introuvable.', 404, 'TWITCH_COMMAND_RESPONSE_NOT_FOUND');
    const minimal = receipt.payloadMinimal as Record<string, Prisma.JsonValue> | null;
    const saved = minimal?.commandPilot ? execution.parse(minimal.commandPilot) : null;
    if (saved && (saved.chatterId ?? saved.senderId) !== twitchUserId)
      throw new AppError('Réponse Twitch introuvable.', 404, 'TWITCH_COMMAND_RESPONSE_NOT_FOUND');
    return { receipt, minimal: minimal ?? {}, saved };
  }
  private async save(tx: Prisma.TransactionClient, receiptId: string, minimal: Record<string, Prisma.JsonValue>, state: Execution, final = false, error?: string) {
    await tx.twitchEventReceipt.update({ where: { id: receiptId }, data: {
      externalReference: `command-pilot:${state.commandKey}`, state: final ? 'PROCESSED' : error ? 'FAILED' : 'RECEIVED',
      processedAt: final ? new Date() : null, errorMessage: error ?? null,
      payloadMinimal: { ...minimal, commandPilot: state } as Prisma.InputJsonValue,
    } });
  }
}
