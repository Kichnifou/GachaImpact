import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js';
import type { CurrentPlayer } from '../../domain/player/current-player.js';
import type { Clock } from '../../domain/time/business-date.js';
import type { RandomSource } from '../../domain/wheel/wheel.js';
import { progressPlayerMessage } from '../chat/message-progression.js';
import { xpRewardPresentation } from '../chat/xp-reward-presentation.js';
import { PrismaPlayerXpService } from '../../infrastructure/database/prisma-player-xp-service.js';
import { PrismaDailyChallengeStore } from '../../infrastructure/database/prisma-daily-challenge-store.js';
import { PermanentMissionService } from '../missions/permanent-mission-service.js';
import { PrismaEconomyService } from '../../infrastructure/database/prisma-economy-service.js';
import { PlayerActivityRecorder } from '../player/player-activity-recorder.js';
import { isPrismaConcurrencyCollision } from '../../infrastructure/database/prisma-concurrency.js';
import { commandMissionFeedback } from '../chat/command-mission-feedback.js';
import { isElementKey } from '../../domain/economy/resources.js';
import { verifiedPlayerActor } from '../player/player-execution-actor.js';
import { withPlayerCommandExecution } from '../player/player-command-execution.js';
import type { ClaimDailyReward } from '../daily-reward/claim-daily-reward.js';
import type { EventService } from '../event/event-service.js';
import { EventChatPresence, type EventChatPresenceIntent } from '../event/event-chat-presence.js';
import { isPlayerDomainReady, isRecoveryUnavailable } from '../player/player-recovery-readiness.js';
import { BusinessError } from '../errors.js';
import { AppError } from '../../api/errors.js';
import { firstDailyMessageResult } from '../chat/daily-reward-chat-result.js';
import type { EventMessageBinding } from '../event/event-message-delivery.js';

type MessagePresenceIntent = { daily: boolean; event: EventChatPresenceIntent | null };

/** No raw text or fabricated standalone message. Counters, XP, Missions and activity
 * commit with one durable operation identified by the actual Twitch message ID. */
export class TwitchMessageActivity {
  constructor(private readonly db: PrismaClient, private readonly clock: Clock, private readonly random: RandomSource,
    private readonly dailyReward?: ClaimDailyReward, private readonly events?: EventService) {}
  capturedAt() { return this.clock.now(); }
  async prepare(player: CurrentPlayer, normal: boolean, now: Date): Promise<MessagePresenceIntent> {
    const eligible = normal && Boolean(player.elementKey && isElementKey(player.elementKey));
    return { daily: eligible, event: eligible && this.events ? await new EventChatPresence(this.db, this.events).prepare(player, now) : null };
  }
  async consume(player: CurrentPlayer, messageId: string, broadcasterId: string, length: number, normal: boolean, now = this.clock.now(), intent?: MessagePresenceIntent, responseBodyLimit?: number) {
    const key = `twitch-message:${broadcasterId}:${messageId}`;
    const completed = await this.db.businessOperation.findFirst({ where: { sourceChannel: 'TWITCH', idempotencyKey: `message-complete:${key}` } });
    if (completed) {
      const summary = completed.resultSummary as { length: number; normal: boolean; responses: string[] };
      if (completed.playerId !== player.id || completed.status !== 'COMPLETED' || completed.operationType !== 'twitch.message.complete' || summary?.length !== length || summary.normal !== normal) throw new Error('TWITCH_MESSAGE_CONFLICT');
      return summary.responses;
    }
    for (let retry = 0; ; retry++) {
      try {
        const responses = await this.db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${player.id}::uuid FOR UPDATE`;
          const active = await tx.player.findUnique({ where: { id: player.id }, select: { status: true, elementKey: true } });
          if (active?.status !== 'ACTIVE') throw new AppError('Compte indisponible.', 403, 'PLAYER_INACTIVE');
          const previous = await tx.businessOperation.findFirst({ where: { sourceChannel: 'TWITCH', idempotencyKey: key } });
          if (previous) {
            const summary = previous.resultSummary as { length?: number; normal?: boolean; responses?: string[] } | null;
            if (previous.playerId !== player.id || previous.operationType !== 'twitch.message' || previous.status !== 'COMPLETED'
              || summary?.length !== length || summary.normal !== normal) throw new Error('TWITCH_MESSAGE_CONFLICT');
            return summary.responses ?? [];
          }
          const operation = await tx.businessOperation.create({ data: { playerId: player.id, operationType: 'twitch.message', sourceChannel: 'TWITCH', idempotencyKey: key, startedAt: now } });
          const economy = new PrismaEconomyService(() => now), missions = new PermanentMissionService(economy);
          const result = await progressPlayerMessage(tx,
            { playerId: player.id, elementKey: active.elementKey, length, normal, now, operationId: operation.id, source: 'TWITCH' },
            { xp: new PrismaPlayerXpService(economy, missions), missions, dailyChallenges: new PrismaDailyChallengeStore(this.db, economy), random: this.random });
          await new PlayerActivityRecorder().record(tx, player.id, now, 'TWITCH');
          const responses: string[] = [];
          if (active.elementKey === null && result.xpPlan?.levelsReached.includes(2))
            responses.push(`✨ ${player.displayName}, niveau 2 : choisis ton élément avec !element pyro (hydro, anemo, electro, dendro, cryo ou geo).`);
          if (result.dailyChallengeCompleted) responses.push('🎯 Défi quotidien messages terminé !');
          if (result.xpPlan && (result.xpPlan.levelsReached.length || result.xpPlan.overflowRewardsGranted)) {
            responses.push(...xpRewardPresentation(player.displayName, result.xpPlan, result.xpBalances, 'TWITCH', responseBodyLimit));
          }
          await tx.businessOperation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', completedAt: now, resultSummary: { length, normal, responses, xpGranted: result.xpGranted } } });
          return responses;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
        const presence = intent ?? await this.prepare(player, normal, now);
        const actor = verifiedPlayerActor(player);
        const eventMessageBindings: EventMessageBinding[] = [];
        const extras = await withPlayerCommandExecution({ now, source: 'TWITCH', eventEditionId: presence.event?.editionId, responseBodyLimit }, async () => {
          const output: string[] = [];
          if (presence.daily && this.dailyReward) {
            const daily = await this.dailyReward.execute(actor, 'TWITCH', key);
            const element = player.elementKey;
            if (!daily.alreadyClaimed && element && isElementKey(element)) output.push(firstDailyMessageResult(player.displayName, element, daily));
          }
          if (presence.event && this.events && await isPlayerDomainReady(this.db, player.id, 'EVENT')) {
            if (presence.event.bonus) {
              try {
                const result = await this.events.claimDailyBonus(actor, `event-daily:${key}`, 'TWITCH');
                output.push(`🎪 ${presence.event.title} : +1 ${presence.event.currency} · solde ${result.currency.amount}.`);
              } catch (error) {
                if (!isRecoveryUnavailable(error) && !(error instanceof BusinessError && ['EVENT_DAILY_BONUS_ALREADY_CLAIMED', 'EVENT_NOT_JOINED'].includes(error.code))) throw error;
              }
            }
            const eventOffset = responses.length + output.length;
            output.push(...await new EventChatPresence(this.db, this.events).deliver(player, presence.event, key, now));
            const receipt = await this.db.businessOperation.findFirst({ where: { playerId: player.id, sourceChannel: 'TWITCH', operationType: 'event.presence.delivery', idempotencyKey: `event-presence:${key}` } });
            const bindings = (receipt?.resultSummary as { messageBindings?: EventMessageBinding[] } | null)?.messageBindings ?? [];
            eventMessageBindings.push(...bindings.map(binding => ({ messageId: binding.messageId, responseIndexes: binding.responseIndexes.map(index => eventOffset + index) })));
          }
          return output;
        });
        const output = [...responses, ...extras, ...await commandMissionFeedback(this.db, player.id, 'TWITCH', key)];
        await this.db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM players WHERE id = ${player.id}::uuid FOR UPDATE`;
          const previous = await tx.businessOperation.findFirst({ where: { sourceChannel: 'TWITCH', idempotencyKey: `message-complete:${key}` } });
          if (!previous) await tx.businessOperation.create({ data: { playerId: player.id, sourceChannel: 'TWITCH', idempotencyKey: `message-complete:${key}`, operationType: 'twitch.message.complete', status: 'COMPLETED', startedAt: now, completedAt: now, resultSummary: { length, normal, responses: output, eventMessageBindings } } });
        });
        return output;
      } catch (error) { if (retry < 5 && isPrismaConcurrencyCollision(error)) continue; throw error; }
    }
  }
}
