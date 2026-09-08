import { ChoosePlayerElement } from '../application/player/choose-player-element.js';
import { GetCurrentPlayer } from '../application/player/get-current-player.js';
import { GetCurrentPlayerResources } from '../application/player/get-current-player-resources.js';
import { GetOrProvisionCurrentPlayer } from '../application/player/get-or-provision-current-player.js';
import { GetCurrentPlayerProgression } from '../application/player/get-current-player-progression.js';
import { SpinDailyWheel } from '../application/wheel/spin-daily-wheel.js';
import { GetTodayWheelState } from '../application/wheel/get-today-wheel-state.js';
import type { AppConfig } from '../config/environment.js';
import { createSupabaseAuthAdapter } from './auth/supabase-auth-adapter.js';
import { PrismaCurrentPlayerStore } from './database/prisma-current-player-store.js';
import { createDatabase } from './database/prisma-database.js';
import { PrismaPlayerElementStore } from './database/prisma-player-element-store.js';
import { PrismaPlayerResourceStore } from './database/prisma-player-resource-store.js';
import { PrismaPlayerProgressionStore } from './database/prisma-player-progression-store.js';
import { PrismaWheelStore } from './database/prisma-wheel-store.js';
import { NodeRandomSource } from './random/node-random-source.js';
import { SystemClock } from './time/system-clock.js';
import { GetTodayDailyReward } from '../application/daily-reward/get-today-daily-reward.js';
import { ClaimDailyReward } from '../application/daily-reward/claim-daily-reward.js';
import { PrismaDailyRewardStore } from './database/prisma-daily-reward-store.js';
import { PrismaGachaStore } from './database/prisma-gacha-store.js';
import { GetCharacters, GetCurrentGacha, GetGachaHistory, PerformGachaPull, SetGachaTarget } from '../application/gacha/gacha-services.js';
import { WeeklyBannerScheduler } from '../application/gacha/weekly-banner-scheduler.js';
import { GetCurrentPlayerBox, SetBoxCharacterFavorite, SetBoxSortPreference, UseMasterlessStella } from '../application/box/box-services.js';
import { PrismaBoxStore } from './database/prisma-box-store.js';
import { ActivatePlayerTeam, ClearPlayerTeam, GetCurrentPlayerTeams, RemovePlayerTeamSlot, SetPlayerTeamSlot } from '../application/team/team-services.js';
import { PrismaTeamStore } from './database/prisma-team-store.js';

export function createRuntimeDependencies(config: AppConfig) {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to start database-backed routes.');
  }

  const issuer = resolveSupabaseIssuer(config);
  const database = createDatabase(config.databaseUrl);
  const store = new PrismaCurrentPlayerStore(database);
  const getCurrentPlayer = new GetCurrentPlayer(store);
  const wheelStore = new PrismaWheelStore(database);
  const clock = new SystemClock();
  const dailyRewardStore = new PrismaDailyRewardStore(database);
  const gachaStore = new PrismaGachaStore(database);
  const random = new NodeRandomSource();
  const scheduler = new WeeklyBannerScheduler(gachaStore, clock, random);
  const boxStore = new PrismaBoxStore(database);
  const teamStore = new PrismaTeamStore(database);

  return {
    authIdentityVerifier: createSupabaseAuthAdapter(issuer),
    getOrProvisionCurrentPlayer: new GetOrProvisionCurrentPlayer(store),
    choosePlayerElement: new ChoosePlayerElement(
      getCurrentPlayer,
      new PrismaPlayerElementStore(database),
    ),
    getCurrentPlayerResources: new GetCurrentPlayerResources(
      getCurrentPlayer,
      new PrismaPlayerResourceStore(database),
    ),
    getCurrentPlayerProgression: new GetCurrentPlayerProgression(
      getCurrentPlayer,
      new PrismaPlayerProgressionStore(database),
    ),
    getTodayWheelState: new GetTodayWheelState(getCurrentPlayer, wheelStore, clock),
    spinDailyWheel: new SpinDailyWheel(getCurrentPlayer, wheelStore, clock, random),
    getTodayDailyReward: new GetTodayDailyReward(getCurrentPlayer, dailyRewardStore, clock),
    claimDailyReward: new ClaimDailyReward(getCurrentPlayer, dailyRewardStore, clock),
    getCharacters: new GetCharacters(gachaStore),
    getCurrentGacha: new GetCurrentGacha(getCurrentPlayer, gachaStore),
    setGachaTarget: new SetGachaTarget(getCurrentPlayer, gachaStore),
    performGachaPull: new PerformGachaPull(getCurrentPlayer, gachaStore, clock, random),
    getGachaHistory: new GetGachaHistory(getCurrentPlayer, gachaStore),
    getCurrentPlayerBox: new GetCurrentPlayerBox(getCurrentPlayer, boxStore),
    setBoxCharacterFavorite: new SetBoxCharacterFavorite(getCurrentPlayer, boxStore),
    setBoxSortPreference: new SetBoxSortPreference(getCurrentPlayer, boxStore),
    useMasterlessStella: new UseMasterlessStella(getCurrentPlayer, boxStore, clock, random),
    getCurrentPlayerTeams: new GetCurrentPlayerTeams(getCurrentPlayer, teamStore),
    activatePlayerTeam: new ActivatePlayerTeam(getCurrentPlayer, teamStore),
    setPlayerTeamSlot: new SetPlayerTeamSlot(getCurrentPlayer, teamStore),
    removePlayerTeamSlot: new RemovePlayerTeamSlot(getCurrentPlayer, teamStore),
    clearPlayerTeam: new ClearPlayerTeam(getCurrentPlayer, teamStore),
    start: () => scheduler.start(),
    close: async () => { scheduler.stop(); await database.$disconnect(); },
  };
}

function resolveSupabaseIssuer(config: AppConfig): string {
  if (config.supabase.jwtIssuer) {
    return config.supabase.jwtIssuer;
  }

  if (config.supabase.url) {
    return new URL('/auth/v1', config.supabase.url).toString();
  }

  throw new Error('SUPABASE_JWT_ISSUER or SUPABASE_URL is required to verify access tokens.');
}
