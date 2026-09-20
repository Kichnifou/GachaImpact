import { Prisma } from '../../../generated/prisma/client.js';

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
  }
}
