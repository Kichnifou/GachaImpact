import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { FavorService } from '../favor/favor-service.js';
import { TwitchFavorBeneficiaryConsumer } from './twitch-favor-beneficiary-consumer.js';

export const resubFavorKey = (messageId: string) => 'eventsub:channel.subscription.message:' + messageId;

/** Reliable resub messages only; never infer a silent renewal or pay a gifter. */
export class TwitchFavorResubConsumer extends TwitchFavorBeneficiaryConsumer {
  constructor(database: PrismaClient, clock: Clock, favor = new FavorService(database, clock)) {
    super(database, clock, 'channel.subscription.message', favor);
  }
}
