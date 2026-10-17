import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import type { AppConfig } from '../../config/environment.js';
import type { GiveawayService } from '../giveaway/giveaway-service.js';
import type { TwitchGiveawayManager } from './twitch-giveaway-manager.js';
import type { TwitchEventSubSubscriptionManager } from './twitch-eventsub-subscription-manager.js';
import type { ConfirmedTwitchStream, TwitchStreamClient } from '../../infrastructure/twitch/twitch-stream-client.js';
import { LIVE_FRESH_MS, LIVE_OFFLINE_GRACE_MS } from './twitch-live-context.js';

const lock = async (tx: Prisma.TransactionClient) => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(7861450867001::bigint)`; };
/** Shared server observer; hints never carry economic authority or mutate live truth. */
export class TwitchLiveService {
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = true;
  private closed = false;
  private ensuredAt = 0;
  constructor(private readonly db: PrismaClient, private readonly config: AppConfig,
    private readonly streams: Pick<TwitchStreamClient, 'current'>, private readonly core: GiveawayService,
    private readonly bridge: Pick<TwitchGiveawayManager, 'sendSessionMilestones'>,
    private readonly subscriptions?: Pick<TwitchEventSubSubscriptionManager, 'ensureLiveSubscriptions'>,
    private readonly now: () => Date = () => new Date()) {}

  private async context() {
    if (this.config.twitch?.pilotLogin !== 'kichnifou' || !this.config.twitch.clientId || !this.config.twitch.clientSecret) return null;
    const rows = await this.db.twitchIdentity.findMany({ where: { playerId: { in: [...this.config.twitch.pilotPlayerIds] }, login: { equals: 'kichnifou', mode: 'insensitive' } }, take: 2 });
    return rows.length === 1 ? rows[0]! : null;
  }
  async projection() {
    const identity = await this.context();
    const channel = identity ? await this.db.twitchLiveChannel.findUnique({ where: { broadcasterId: identity.twitchUserId } }) : null;
    const age = channel?.checkedAt ? +this.now() - +channel.checkedAt : Infinity;
    const live = channel?.status === 'LIVE' && age >= 0 && age <= LIVE_FRESH_MS;
    return { live, validForMs: live ? LIVE_FRESH_MS - age : 0 };
  }
  start() {
    if (!this.stopped) return;
    this.closed = false;
    this.stopped = false;
    const loop = () => { if (this.stopped) return; void this.tick().catch(() => undefined).finally(() => { if (!this.stopped) this.timer = setTimeout(loop, 30_000); }); };
    loop();
  }
  async stop() { this.stopped = true; this.closed = true; clearTimeout(this.timer); await this.running?.catch(() => undefined); }
  async signal(broadcasterId: string) {
    const identity = await this.context();
    if (identity?.twitchUserId === broadcasterId) void this.tick().catch(() => undefined);
  }
  async tick() {
    if (this.closed) return;
    if (this.running) return this.running;
    const job = this.reconcile(); this.running = job;
    try { await job; } finally { this.running = undefined; }
  }
  private async reconcile() {
    const identity = await this.context(); if (!identity) return;
    const broadcasterId = identity.twitchUserId, now = this.now(), token = randomUUID();
    await this.db.twitchLiveChannel.createMany({ data: [{ broadcasterId }], skipDuplicates: true });
    const acquired = await this.db.twitchLiveChannel.updateMany({ where: { broadcasterId,
      AND: [{ OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }, { OR: [{ checkedAt: null }, { checkedAt: { lte: new Date(+now - 15_000) } }] }] },
      data: { leaseToken: token, leaseUntil: new Date(+now + 120_000) } });
    if (!acquired.count) return;
    try {
      if (this.subscriptions && +now - this.ensuredAt > 300_000) {
        try { await this.subscriptions.ensureLiveSubscriptions(identity.playerId, broadcasterId); this.ensuredAt = +now; } catch { /* Helix catch-up remains authoritative. */ }
      }
      let live: ConfirmedTwitchStream | null;
      try { live = await this.streams.current(broadcasterId); if (live && +live.startedAt > +this.now()) throw Error('Future live'); }
      catch {
        await this.db.twitchLiveChannel.updateMany({ where: { broadcasterId, leaseToken: token }, data: { status: 'UNKNOWN', checkedAt: this.now(), offlineSince: null } });
        return;
      }
      await this.db.$transaction(async tx => {
        await lock(tx);
        const channel = await tx.twitchLiveChannel.findUniqueOrThrow({ where: { broadcasterId } });
        if (channel.leaseToken !== token || !channel.leaseUntil || channel.leaseUntil < this.now()) return;
        const checkedAt = this.now();
        const previous = channel.currentStreamId ? await tx.twitchLiveStream.findUnique({ where: { id: channel.currentStreamId } }) : null;
        if (!live) {
          await tx.twitchLiveChannel.update({ where: { broadcasterId }, data: { status: 'OFFLINE', checkedAt, offlineSince: channel.offlineSince ?? checkedAt } });
          return;
        }
        const known = await tx.twitchLiveStream.findUnique({ where: { id: live.id } });
        if (known?.endedAt && live.id !== previous?.id || known && known.broadcasterId !== broadcasterId || previous && live.id !== previous.id && live.startedAt <= previous.startedAt) {
          await tx.twitchLiveChannel.update({ where: { broadcasterId }, data: { status: 'UNKNOWN', checkedAt, offlineSince: null } }); return;
        }
        let inherited: { consumed: boolean; sessionId: string | null } | undefined;
        if (previous && !previous.endedAt && live.id !== previous.id) {
          // A restart lasting seconds may receive a new Twitch stream ID. Keep its Giveaway cycle.
          if (channel.lastOnlineAt && +live.startedAt - +channel.lastOnlineAt <= 60_000) {
            inherited = { consumed: previous.consumed, sessionId: previous.sessionId };
            await tx.twitchLiveStream.update({ where: { id: previous.id }, data: { endedAt: checkedAt } });
          } else {
            // A different confirmed stream also proves the previous one ended. Finish it first.
            await tx.twitchLiveChannel.update({ where: { broadcasterId }, data: { status: 'OFFLINE', checkedAt, offlineSince: channel.offlineSince ?? checkedAt } }); return;
          }
        }
        await tx.twitchLiveStream.upsert({ where: { id: live.id }, create: { id: live.id, broadcasterId, startedAt: live.startedAt, ...inherited }, update: {} });
        await tx.twitchLiveChannel.update({ where: { broadcasterId }, data: { status: 'LIVE', currentStreamId: live.id, checkedAt, lastOnlineAt: checkedAt, offlineSince: null } });
      }, { timeout: 30_000 });
      const channel = await this.db.twitchLiveChannel.findUniqueOrThrow({ where: { broadcasterId } });
      if (channel.leaseToken !== token || !channel.currentStreamId) return;
      const stream = await this.db.twitchLiveStream.findUniqueOrThrow({ where: { id: channel.currentStreamId } });
      const authority = await this.db.twitchNativeAuthority.findUnique({ where: { id: 'twitch-commands' } });
      if (!this.config.twitchCommandPilot?.enabled || !this.config.twitchCommandPilot.globalEnabled || authority?.desiredMode !== 'GLOBAL' || authority.operatorPlayerId !== identity.playerId) return;
      const context = { broadcasterId, streamId: stream.id };
      if (channel.status === 'LIVE' && !stream.consumed) await this.core.open(identity.playerId, 'TWITCH', 'live:open:' + stream.id, context);
      if (channel.status === 'OFFLINE' && channel.offlineSince && +this.now() - +channel.offlineSince >= LIVE_OFFLINE_GRACE_MS && !stream.endedAt) {
        if (stream.sessionId) await this.core.close(identity.playerId, 'TWITCH', stream.sessionId, 'live:close:' + stream.id, context);
        await this.db.twitchLiveStream.update({ where: { id: stream.id }, data: { endedAt: this.now(), consumed: true } });
      }
      const updated = await this.db.twitchLiveStream.findUniqueOrThrow({ where: { id: stream.id } });
      if (updated.sessionId) await this.bridge.sendSessionMilestones(updated.sessionId);
    } finally {
      await this.db.twitchLiveChannel.updateMany({ where: { broadcasterId, leaseToken: token }, data: { leaseToken: null, leaseUntil: null } });
    }
  }
}
