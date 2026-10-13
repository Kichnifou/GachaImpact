import { Prisma } from '../../../generated/prisma/client.js';
import { businessDateToDatabaseDate, getBusinessDate } from '../../domain/time/business-date.js';

export type PlayerActivityCategory = 'APPLICATION' | 'GAMEPLAY' | 'INTERNAL_CHAT' | 'TWITCH';

/** Records an accomplished, player-initiated action in its owning transaction.
 * Receiving a message, reading a projection and running a job are not callers.
 * GREATEST prevents an older concurrent transaction from moving activity backwards.
 */
export class PlayerActivityRecorder {
  async record(tx: Prisma.TransactionClient, playerId: string, at: Date, category: PlayerActivityCategory) {
    const application = category !== 'TWITCH' ? at : null;
    const gameplay = category === 'GAMEPLAY' ? at : null;
    const chat = category === 'INTERNAL_CHAT' ? at : null;
    const twitch = category === 'TWITCH' ? at : null;
    await tx.$executeRaw`INSERT INTO player_activity_state
      (player_id, last_app_activity_at, last_gameplay_activity_at, last_internal_chat_at, last_twitch_activity_at, updated_at)
      VALUES (${playerId}::uuid, ${application}, ${gameplay}, ${chat}, ${twitch}, ${at})
      ON CONFLICT (player_id) DO UPDATE SET
        last_app_activity_at = GREATEST(player_activity_state.last_app_activity_at, EXCLUDED.last_app_activity_at),
        last_gameplay_activity_at = GREATEST(player_activity_state.last_gameplay_activity_at, EXCLUDED.last_gameplay_activity_at),
        last_internal_chat_at = GREATEST(player_activity_state.last_internal_chat_at, EXCLUDED.last_internal_chat_at),
        last_twitch_activity_at = GREATEST(player_activity_state.last_twitch_activity_at, EXCLUDED.last_twitch_activity_at),
        updated_at = GREATEST(player_activity_state.updated_at, EXCLUDED.updated_at)`;
    await tx.$executeRaw`INSERT INTO player_daily_activity
      (business_date, player_id, application, gameplay, internal_chat, twitch)
      VALUES (${businessDateToDatabaseDate(getBusinessDate(at))}, ${playerId}::uuid,
        ${category === 'APPLICATION'}, ${category === 'GAMEPLAY'}, ${category === 'INTERNAL_CHAT'}, ${category === 'TWITCH'})
      ON CONFLICT (business_date, player_id) DO UPDATE SET
        application = player_daily_activity.application OR EXCLUDED.application,
        gameplay = player_daily_activity.gameplay OR EXCLUDED.gameplay,
        internal_chat = player_daily_activity.internal_chat OR EXCLUDED.internal_chat,
        twitch = player_daily_activity.twitch OR EXCLUDED.twitch
      WHERE (EXCLUDED.application AND NOT player_daily_activity.application)
        OR (EXCLUDED.gameplay AND NOT player_daily_activity.gameplay)
        OR (EXCLUDED.internal_chat AND NOT player_daily_activity.internal_chat)
        OR (EXCLUDED.twitch AND NOT player_daily_activity.twitch)`;
  }
}
