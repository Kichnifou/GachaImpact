import { AppError } from '../../api/errors.js';
import { z } from 'zod';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import type { CurrentPlayer } from '../../domain/player/current-player.js';
import { findChatCommand } from '../chat/chat-command-registry.js';
import type { PlayerCommandHandler } from '../chat/player-command-core.js';
import { parsePullCount } from '../chat/player-command-core.js';
import type { TwitchEventSubSubscriptionManager } from './twitch-eventsub-subscription-manager.js';
import { TwitchCommandSendError, type TwitchCommandChatClient } from '../../infrastructure/twitch/twitch-command-chat-client.js';

const twitchId = z.string().regex(/^\d+$/).max(128);
const envelope = z.object({ subscription: z.object({ id: z.string().min(1), type: z.literal('channel.chat.message'),
  version: z.literal('1'), status: z.literal('enabled'),
  condition: z.object({ broadcaster_user_id: twitchId, user_id: twitchId }).strict(),
  transport: z.object({ method: z.literal('webhook'), callback: z.string().optional() }),
}), event: z.object({ chatter_user_id: twitchId, broadcaster_user_id: twitchId,
  source_broadcaster_user_id: twitchId.nullish(), message_id: z.string().min(1).max(256), message: z.object({ text: z.string().max(2000) }),
}) });
const response = z.object({ text: z.string(), status: z.enum(['PENDING', 'SENDING', 'SENT', 'FAILED', 'AMBIGUOUS']),
  messageId: z.string().optional(), error: z.string().optional() });
const execution = z.object({ version: z.literal(1), playerId: z.string(), actorName: z.string(),
  senderId: twitchId, broadcasterId: twitchId, replyParentMessageId: z.string().min(1).max(256),
  commandKey: z.string(), handler: z.string(), stage: z.enum(['EXECUTING', 'RESPONSES']), responses: z.array(response) });
type Execution = z.infer<typeof execution>;
export type TwitchCommandExecutor = { execute(player: CurrentPlayer, handler: PlayerCommandHandler, args: readonly string[], usage: string, key: string): Promise<string | readonly string[]> };
export type TwitchCommandSubscriptionInspector = Pick<TwitchEventSubSubscriptionManager, 'activationAvailable' | 'inspectPilotChatSubscription'>;

/** Preserve presentation segments; split only an oversized segment, by Unicode characters. */
export function twitchResponseSegments(value: string | readonly string[]): string[] {
  return (typeof value === 'string' ? [value] : value).flatMap(segment => {
    const chars = Array.from(segment.replace(/[\r\n\u2028\u2029]/gu, ' ').trim());
    const chunks: string[] = [];
    for (let index = 0; index < chars.length; index += 500) chunks.push(chars.slice(index, index + 500).join('').trim());
    return chunks.filter(Boolean);
  });
}

const allowed = new Set<PlayerCommandHandler>(['pity', 'banniere', 'team', 'sac', 'quotis', 'expedition', 'pull']);

export class TwitchCommandPilot {
  private armed = false;
  private controlVersion = 0;
  constructor(private readonly db: PrismaClient, private readonly config: AppConfig,
    private readonly executor: TwitchCommandExecutor, private readonly outbound: Pick<TwitchCommandChatClient, 'send'>,
    private readonly parser: typeof findChatCommand = findChatCommand,
    private readonly subscriptions?: TwitchCommandSubscriptionInspector) {}

  status() {
    const capability = this.config.twitchCommandPilot?.enabled === true;
    return { commandPilotCapabilityEnabled: capability, commandPilotArmed: this.armed,
      commandPilotEnabled: capability && this.armed };
  }

  private enabled() { return this.status().commandPilotEnabled; }

  async arm(playerId: string) {
    if (this.config.twitchCommandPilot?.enabled !== true)
      throw new AppError('Capacité du pilote de commandes inactive.', 409, 'TWITCH_COMMAND_PILOT_OFF');
    const version = this.controlVersion;
    const identity = await this.db.twitchIdentity.findUnique({ where: { playerId }, include: { player: true } });
    if (!identity || identity.player.status !== 'ACTIVE' || !this.config.twitch?.pilotPlayerIds.includes(playerId)
      || this.config.twitch.pilotLogin !== 'kichnifou' || identity.login.toLowerCase() !== 'kichnifou'
      || !twitchId.safeParse(identity.twitchUserId).success)
      throw new AppError('Armement du pilote Twitch interdit.', 403, 'TWITCH_COMMAND_PILOT_FORBIDDEN');
    if (!this.subscriptions?.activationAvailable)
      throw new AppError('Transport Twitch indisponible.', 409, 'TWITCH_COMMAND_TRANSPORT_UNAVAILABLE');
    let active = false;
    try { active = await this.subscriptions.inspectPilotChatSubscription(playerId, AbortSignal.timeout(3_000)) === 'ACTIVE'; }
    catch { throw new AppError('Inspection Twitch indisponible.', 409, 'TWITCH_COMMAND_TRANSPORT_UNAVAILABLE'); }
    if (!active) throw new AppError('Une subscription Chat active est nécessaire.', 409, 'TWITCH_COMMAND_SUBSCRIPTION_INACTIVE');
    if (version !== this.controlVersion)
      throw new AppError('Armement annulé par le désarmement.', 409, 'TWITCH_COMMAND_PILOT_OFF');
    this.armed = true;
    return this.status();
  }

  /** Process-local emergency stop: no Twitch inspection or mutation, no cancellation of committed work. */
  disarm(playerId: string) {
    if (!this.config.twitch?.pilotPlayerIds.includes(playerId) || this.config.twitch.pilotLogin !== 'kichnifou')
      throw new AppError('Pilote Twitch non autorisé.', 403, 'TWITCH_COMMAND_PILOT_FORBIDDEN');
    this.controlVersion++;
    this.armed = false;
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
  async consumeAuthenticated(raw: unknown, receiptId: string): Promise<void> {
    if (!this.enabled() || this.config.twitch?.pilotLogin !== 'kichnifou') return;
    const parsed = envelope.safeParse(raw);
    if (!parsed.success) return;
    const { subscription, event } = parsed.data;
    const identity = await this.db.twitchIdentity.findUnique({ where: { twitchUserId: event.chatter_user_id }, include: { player: true } });
    // No command classification/registry lookup occurs before every author/transport gate succeeds.
    if (!this.enabled() || !identity || identity.player.status !== 'ACTIVE' || !this.config.twitch.pilotPlayerIds.includes(identity.playerId)
      || identity.login.toLowerCase() !== this.config.twitch.pilotLogin
      || identity.twitchUserId !== event.chatter_user_id || identity.twitchUserId !== event.broadcaster_user_id
      || subscription.condition.broadcaster_user_id !== event.broadcaster_user_id
      || subscription.condition.user_id !== identity.twitchUserId
      || event.source_broadcaster_user_id && event.source_broadcaster_user_id !== event.broadcaster_user_id
      || this.config.twitchEventSub?.callbackUrl && subscription.transport.callback !== this.config.twitchEventSub.callbackUrl) return;
    if (!event.message.text.startsWith('!')) return;
    const [root = '', ...args] = event.message.text.slice(1).trim().split(/\s+/u);
    const definition = this.parser(root);
    const handler = definition?.handler as PlayerCommandHandler | undefined;
    if (!definition || !handler || !allowed.has(handler) || (handler === 'pull'
      ? parsePullCount(args) === null : args.length > 0)) return;
    const read = (tx: Prisma.TransactionClient) => this.read(tx, receiptId, identity.twitchUserId);
    const save = (tx: Prisma.TransactionClient, minimal: Record<string, Prisma.JsonValue>, state: Execution) => this.save(tx, receiptId, minimal, state);
    // Commit the retention exemption BEFORE the business call, including its recoverable crash window.
    await this.locked(receiptId, async tx => {
      const { receipt, minimal, saved } = await read(tx);
      if (saved) {
        if (saved.playerId !== identity.playerId || saved.handler !== handler) throw new Error('TWITCH_COMMAND_RECEIPT_CONFLICT');
        return;
      }
      if (receipt.state !== 'RECEIVED' || receipt.externalReference !== null) throw new Error('TWITCH_COMMAND_RECEIPT_CONFLICT');
      await save(tx, minimal, { version: 1, playerId: identity.playerId, actorName: identity.player.displayName,
        senderId: identity.twitchUserId, broadcasterId: event.broadcaster_user_id, replyParentMessageId: event.message_id,
        commandKey: `twitch-command:${receipt.externalEventId}`, handler, stage: 'EXECUTING', responses: [] });
    });
    await this.locked(receiptId, async tx => {
      const { minimal, saved } = await read(tx);
      if (!saved || saved.stage !== 'EXECUTING' || !this.enabled()) return;
      const output = await this.executor.execute({ ...identity.player, displayName: saved.actorName }, handler, args, definition.syntax, saved.commandKey);
      const segments = twitchResponseSegments(output);
      if (!segments.length) throw new Error('TWITCH_COMMAND_EMPTY_RESPONSE');
      await save(tx, minimal, { ...saved, stage: 'RESPONSES', responses: segments.map(text => ({ text, status: 'PENDING' })) });
    });
    await this.deliver(receiptId, { senderId: identity.twitchUserId, broadcasterId: event.broadcaster_user_id, replyParentMessageId: event.message_id });
  }

  /** Authenticated pilot operator only; no parser or business service is reachable from this recovery path. */
  async retryResponses(playerId: string, receiptId: string) {
    if (!this.enabled()) throw new AppError('Pilote de commandes inactif.', 409, 'TWITCH_COMMAND_PILOT_OFF');
    const identity = await this.db.twitchIdentity.findUnique({ where: { playerId }, include: { player: true } });
    if (!identity || identity.player.status !== 'ACTIVE' || !this.config.twitch?.pilotPlayerIds.includes(playerId)
      || this.config.twitch.pilotLogin !== 'kichnifou' || identity.login.toLowerCase() !== 'kichnifou')
      throw new AppError('Reprise de réponse Twitch interdite.', 403, 'TWITCH_COMMAND_RETRY_FORBIDDEN');
    const target = await this.locked(receiptId, async tx => {
      const { saved } = await this.read(tx, receiptId, identity.twitchUserId);
      if (!saved || saved.playerId !== playerId || saved.senderId !== identity.twitchUserId || saved.broadcasterId !== identity.twitchUserId)
        throw new AppError('Réponse Twitch introuvable.', 404, 'TWITCH_COMMAND_RESPONSE_NOT_FOUND');
      if (saved.stage !== 'RESPONSES' || saved.responses.some(row => row.status === 'SENDING' || row.status === 'AMBIGUOUS'))
        throw new AppError('Résultat de réponse incertain : contrôle opérateur requis.', 409, 'TWITCH_COMMAND_RESPONSE_AMBIGUOUS');
      return { senderId: saved.senderId, broadcasterId: saved.broadcasterId, replyParentMessageId: saved.replyParentMessageId };
    });
    await this.deliver(receiptId, target);
    return this.locked(receiptId, async tx => {
      const { receipt } = await this.read(tx, receiptId, identity.twitchUserId);
      return { state: receipt.state };
    });
  }

  private async deliver(receiptId: string, target: { senderId: string; broadcasterId: string; replyParentMessageId: string }) {
    const read = (tx: Prisma.TransactionClient) => this.read(tx, receiptId, target.senderId);
    const save = (tx: Prisma.TransactionClient, minimal: Record<string, Prisma.JsonValue>, state: Execution, final = false, error?: string) => this.save(tx, receiptId, minimal, state, final, error);
    // Persist SENDING before HTTP. Unknown outcomes never auto-retry; certain rejection retries response only.
    for (let index = 0; ; index++) {
      if (!this.enabled()) return;
      const text = await this.locked(receiptId, async tx => {
        const { receipt, minimal, saved } = await read(tx);
        if (!this.enabled() || !saved || receipt.state === 'PROCESSED') return null;
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
        if (!this.enabled()) throw new TwitchCommandSendError('CERTAIN', 'PILOT_DISABLED');
        sentId = await this.outbound.send({ broadcasterId: target.broadcasterId, senderId: target.senderId,
          message: text, replyParentMessageId: target.replyParentMessageId }, () => this.enabled());
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
    return { receipt, minimal: minimal ?? {}, saved: minimal?.commandPilot ? execution.parse(minimal.commandPilot) : null };
  }
  private async save(tx: Prisma.TransactionClient, receiptId: string, minimal: Record<string, Prisma.JsonValue>, state: Execution, final = false, error?: string) {
    await tx.twitchEventReceipt.update({ where: { id: receiptId }, data: {
      externalReference: `command-pilot:${state.commandKey}`, state: final ? 'PROCESSED' : error ? 'FAILED' : 'RECEIVED',
      processedAt: final ? new Date() : null, errorMessage: error ?? null,
      payloadMinimal: { ...minimal, commandPilot: state } as Prisma.InputJsonValue,
    } });
  }
}
