import { freezeCommandValue, thawCommandValue } from '../chat/command-value.js';
export { freezeCommandValue, thawCommandValue } from '../chat/command-value.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PlayerExecutionActor } from '../player/player-execution-actor.js';
import type { ChatCommandServices } from '../chat/player-command-resolver.js';
import type { CommandTargets } from '../player/player-command-execution.js';

/** Explicit effect boundary. Unknown service methods fail closed. */
export const commandMutations = [
  'choosePlayerElement.execute', 'setGachaTarget.execute', 'bannerVotes.vote', 'performGachaPullChat.execute',
  'setBoxCharacterFavorite.execute', 'setBoxSortPreference.execute', 'useMasterlessStella.execute',
  'activatePlayerTeam.execute', 'renamePlayerTeam.execute', 'createNextPlayerTeam.execute',
  'setPlayerTeamSlot.execute', 'removePlayerTeamSlot.execute', 'clearPlayerTeam.execute',
  'depositPlayerBankChat.execute', 'withdrawPlayerBankChat.execute', 'purchaseShopItemChat.execute',
  'purchaseDailyChallenge.execute', 'switchDailyChallenge.execute', 'convertPersonalParticlesChat.execute',
  'spinDailyWheelChat.execute', 'socialService.friendship.mutate', 'socialService.friendship.sendHearts',
  'tradeService.create', 'tradeService.mutate', 'tradeService.all', 'giftCodeService.claim',
  'eventService.join', 'eventService.attemptGameA', 'eventService.attemptGameB', 'eventService.sendGameC',
  'eventService.claimCalendar', 'eventService.convertShop', 'eventService.purchaseCollection',
  'expeditionService.start', 'expeditionService.claim', 'dailyCombatService.fight', 'monthlyBossService.attackWithActiveTeam',
] as const;
const mutations = new Set<string>(commandMutations);
const reads = new Set([
  'getCurrentGacha.execute', 'getCharacters.execute', 'bannerVotes.getCurrent', 'getCurrentPlayerBox.execute',
  'getCurrentPlayerTeams.execute', 'getCurrentPlayerInventory.execute', 'getCurrentPlayerBank.execute', 'getCurrentPlayerShop.execute',
  'socialService.actor', 'socialService.directory', 'socialService.connected', 'socialService.profile', 'socialService.favor', 'socialService.legends', 'socialService.friends',
  'rankingService.chatTop', 'rankingService.personal', 'tradePlayer.execute', 'tradeService.snapshot', 'tradeService.partners', 'tradeService.eligibility',
  'dailyCombatService.getDaily', 'dailyCombatService.previewActiveTeam', 'dailyCombatService.getElementMatrix', 'monthlyBossService.getCurrentForChat',
  'expeditionService.getState', 'contestService.getCurrent', 'eventService.getCurrent', 'eventService.getRanking', 'eventService.searchGameCRecipients',
  'giftCodeService.listForPlayer', 'getDailyChallenge.execute', 'getCurrentPlayerMissions.execute', 'getTodayWheelState.execute', 'getTodayDailyReward.execute',
]);
export type FrozenCommandIntent = {
  now: string;
  responseBodyLimit?: number;
  reads: Record<string, Prisma.JsonValue[]>;
  memory: Record<string, string>;
  mutation?: { path: string; args: Prisma.JsonValue };
  output?: Prisma.JsonValue;
  bannerId?: string;
  targets?: CommandTargets;
};
export class CommandPrepared extends Error {}

/** Prepare executes reads only; the first effect interrupts the shared resolver.
 * Replay uses the original reads/arguments, then the existing owner's idempotent effect. */
export function commandIntentServices(services: ChatCommandServices, actor: PlayerExecutionActor,
  intent: FrozenCommandIntent, mode: 'PREPARE' | 'EXECUTE'): ChatCommandServices {
  const positions = new Map<string, number>();
  let effectCalled = false;
  const wrap = (object: object, prefix: string): object => new Proxy(object, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property);
      const path = prefix ? `${prefix}.${String(property)}` : String(property);
      if (typeof value === 'function') return async (...args: unknown[]) => {
        if (!mutations.has(path) && !reads.has(path)) throw new Error('TWITCH_COMMAND_SERVICE_UNCLASSIFIED');
        const index = positions.get(path) ?? 0; positions.set(path, index + 1);
        if (mutations.has(path)) {
          if (mode === 'PREPARE') {
            if (path === 'socialService.friendship.sendHearts' && args[1] === 'all') {
              const state = thawCommandValue(intent.reads['socialService.friends']![0]!) as Awaited<ReturnType<ChatCommandServices['socialService']['friends']>>;
              (intent.targets ??= {}).friendIds = state.friends.map(friend => friend.playerId);
            }
            if (path === 'tradeService.all') {
              const state = await services.tradeService.snapshot(args[0] as string);
              (intent.targets ??= {}).tradeIds = (args[1] === 'cancel' ? state.sent : state.received).map(request => request.id);
            }
            intent.mutation = { path, args: freezeCommandValue(args.map(argument => argument === actor ? { actor: true } : argument)) };
            throw new CommandPrepared();
          }
          if (effectCalled || intent.mutation?.path !== path) throw new Error('TWITCH_COMMAND_INTENT_CONFLICT');
          effectCalled = true;
          const frozen = thawCommandValue(intent.mutation.args) as unknown[];
          const effective = frozen.map(argument => argument && typeof argument === 'object' && 'actor' in argument ? actor : argument);
          return Reflect.apply(value, target, effective);
        }
        const previous = intent.reads[path]?.[index];
        if (previous !== undefined) return thawCommandValue(previous);
        if (mode === 'EXECUTE' && !effectCalled) throw new Error('TWITCH_COMMAND_INTENT_MISSING_READ');
        const result: unknown = await Reflect.apply(value, target, args);
        if (mode === 'PREPARE') (intent.reads[path] ??= [])[index] = freezeCommandValue(result);
        return result;
      };
      return value && typeof value === 'object' ? wrap(value, path) : value;
    },
  });
  return wrap(services, '') as ChatCommandServices;
}
