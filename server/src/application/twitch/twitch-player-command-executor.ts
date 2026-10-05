import { playerCommandError } from '../chat/player-command-core.js';
import { AppError } from '../../api/errors.js';
import { SourceChannel, type PrismaClient } from '../../../generated/prisma/client.js';
import type { Clock } from '../../domain/time/business-date.js';
import { verifiedPlayerActor } from '../player/player-execution-actor.js';
import { withPlayerCommandExecution } from '../player/player-command-execution.js';
import { PlayerCommandResolver, type ChatCommandServices } from '../chat/player-command-resolver.js';
import type { PlayerCommandContext } from '../chat/player-command-context.js';
import { commandMissionFeedback } from '../chat/command-mission-feedback.js';
import { twitchResponseSegments, type TwitchCommandExecutor } from './twitch-command-pilot.js';
import { CommandPrepared, commandIntentServices, freezeCommandValue, thawCommandValue, type FrozenCommandIntent } from './twitch-command-intent.js';

export function twitchPlayerCommandExecutor(db: PrismaClient, services: ChatCommandServices, clock: Clock = { now: () => new Date() }): TwitchCommandExecutor {
  const confirmed = (playerId: string, key: string) => db.businessOperation.count({ where: { playerId, sourceChannel: SourceChannel.TWITCH,
    OR: [{ idempotencyKey: key }, { idempotencyKey: { endsWith: `:${key}` } }], status: 'COMPLETED' } }).then(count => count > 0);
  const context = (playerId: string, key: string, intent: FrozenCommandIntent): PlayerCommandContext => ({
    sourceChannel: SourceChannel.TWITCH,
    async rememberCommandText(_key, field, value) { return intent.memory[field] ??= value; },
    async rememberCommandQuantity(_key, value) { return BigInt(intent.memory.quantity ??= String(value)); },
    async rememberCommandRefreshScopes() {},
    hasConfirmedCommandMutation: () => confirmed(playerId, key),
  });
  const finalize = async (playerId: string, key: string, output: string | readonly string[]) => {
    const segments = twitchResponseSegments(output);
    for (const text of await commandMissionFeedback(db, playerId, SourceChannel.TWITCH, key)) {
      const last = segments.at(-1);
      if (last && Array.from(`${last} ${text}`).length <= 500) segments[segments.length - 1] = `${last} ${text}`;
      else segments.push(...twitchResponseSegments(text));
    }
    return segments;
  };
  const prepare: NonNullable<TwitchCommandExecutor['prepare']> = async (player, handler, args, _usage, key, businessAt) => {
    const actor = verifiedPlayerActor(player);
    const intent: FrozenCommandIntent = { now: businessAt ?? clock.now().toISOString(), reads: {}, memory: {} };
    const frozen = commandIntentServices(services, actor, intent, 'PREPARE');
    try {
      intent.output = freezeCommandValue(await withPlayerCommandExecution({ now: new Date(intent.now), source: SourceChannel.TWITCH, ...intent.targets, bannerId: intent.bannerId, key },
        () => new PlayerCommandResolver(context(player.id, key, intent), frozen, SourceChannel.TWITCH).resolve(actor, `!${handler} ${args.join(' ')}`, key)));
    } catch (error) { if (!(error instanceof CommandPrepared)) throw error; }
    if (intent.mutation) {
      try {
        await withPlayerCommandExecution({ now: new Date(intent.now), source: SourceChannel.TWITCH, key }, async () => {
          if (handler === 'pull' || handler === 'select') {
            const current = await services.getCurrentGacha.execute(actor);
            intent.bannerId = current.banner.id;
            intent.targets = { gachaTargetId: handler === 'pull' ? current.playerState.selectedBannerCharacterId : undefined };
          }
          if (['pull', 'combat'].includes(handler)) {
            const team = await db.team.findFirst({ where: { playerId: player.id, isActive: true }, select: { id: true, members: { select: { position: true, characterId: true }, orderBy: { position: 'asc' } } } });
            (intent.targets ??= {}).activeTeam = { id: team?.id ?? null, members: team?.members ?? [] };
          }
          if (handler === 'expedition') {
            const state = await db.playerExpedition.findUnique({ where: { playerId: player.id }, select: { characterId: true, departedAt: true } });
            (intent.targets ??= {}).expedition = { characterId: state?.characterId ?? null, departedAt: state?.departedAt?.toISOString() ?? null };
          }
          if (intent.mutation?.path === 'dailyCombatService.fight' && services.dailyCombatService.prepareCommand) {
            const mode = (thawCommandValue(intent.mutation.args) as unknown[])[2] as 'ACTIVE_TEAM' | 'AUTO';
            const combat = await services.dailyCombatService.prepareCommand(actor, mode);
            if (combat) (intent.targets ??= {}).combat = combat;
          }

        });
      } catch (error) {
        const output = playerCommandError(error, handler); if (output === undefined) throw error;
        delete intent.mutation; intent.output = freezeCommandValue(output);
      }
    }
    const event = intent.reads['eventService.getCurrent']?.[0];
    if (event) (intent.targets ??= {}).eventEditionId = (thawCommandValue(event) as Awaited<ReturnType<ChatCommandServices['eventService']['getCurrent']>>).edition.id;
    return intent;
  };
  return {
    capturedAt: () => clock.now(),
    prepare,
    async execute(player, handler, args, usage, key, saved) {
      // R1042/R1043 did not store an intent. Recover only a committed legacy effect;
      // an unstarted old receipt must not acquire a new target/day after deployment.
      if (!saved && /^twitch-command:[^:]+$/u.test(key)) {
        if (handler !== 'pull') throw new AppError('Ancien reçu sans intention : contrôle opérateur requis.', 409, 'TWITCH_COMMAND_LEGACY_INTENT_REQUIRED');
        const previous = await db.businessOperation.findFirst({ where: { playerId: player.id, sourceChannel: 'TWITCH', status: 'COMPLETED', operationType: 'gacha.pull', idempotencyKey: { endsWith: `:${key}` } } });
        if (!previous) throw new AppError('Ancien reçu sans opération engagée : contrôle opérateur requis.', 409, 'TWITCH_COMMAND_LEGACY_INTENT_REQUIRED');
        const intent: FrozenCommandIntent = { now: previous.startedAt.toISOString(), reads: {}, memory: {} };
        return finalize(player.id, key, await withPlayerCommandExecution({ now: previous.startedAt, source: 'TWITCH', key },
          () => new PlayerCommandResolver(context(player.id, key, intent), services, 'TWITCH').resolve(verifiedPlayerActor(player), `!pull ${args.join(' ')}`, key)));
      }
      const intent = saved ?? await prepare(player, handler, args, usage, key);
      const actor = verifiedPlayerActor(player);
      const output = intent.output !== undefined ? thawCommandValue(intent.output) as string | readonly string[]
        : await withPlayerCommandExecution({ ...intent.targets, now: new Date(intent.now), source: SourceChannel.TWITCH, bannerId: intent.bannerId, key },
          () => new PlayerCommandResolver(context(player.id, key, intent), commandIntentServices(services, actor, intent, 'EXECUTE'), SourceChannel.TWITCH)
            .resolve(actor, `!${handler} ${args.join(' ')}`, key));
      return finalize(player.id, key, output);
    },
  };
}
