import { SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import { verifiedPlayerActor } from '../player/player-execution-actor.js';
import { resolvePlayerCommand, playerCommandError, type PlayerCommandServices } from '../chat/player-command-core.js';
import { commandMissionFeedback } from '../chat/command-mission-feedback.js';
import { twitchResponseSegments, type TwitchCommandExecutor } from './twitch-command-pilot.js';

export function twitchPlayerCommandExecutor(db: PrismaClient, services: PlayerCommandServices): TwitchCommandExecutor {
  return { async execute(player, handler, args, usage, key) {
    let output: string | readonly string[];
    try { output = await resolvePlayerCommand(verifiedPlayerActor(player), handler, args, usage, key, services); }
    catch (error) {
      // A post-commit error must recover the persisted business result, never turn into a false failure response.
      if (await db.businessOperation.count({ where: { playerId: player.id, sourceChannel: SourceChannel.TWITCH,
        OR: [{ idempotencyKey: key }, { idempotencyKey: { endsWith: `:${key}` } }], status: 'COMPLETED' } })) throw error;
      const text = playerCommandError(error, handler);
      if (text === undefined) throw error;
      output = text;
    }
    const segments = twitchResponseSegments(output);
    for (const text of await commandMissionFeedback(db, player.id, SourceChannel.TWITCH, key)) {
      const last = segments.at(-1);
      if (last && Array.from(`${last} ${text}`).length <= 500) segments[segments.length - 1] = `${last} ${text}`;
      else segments.push(...twitchResponseSegments(text));
    }
    return segments;
  } };
}
