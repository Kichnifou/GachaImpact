import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import fastify, { type FastifyInstance } from 'fastify';

import { createAuthenticationHook, registerAuthenticationContext } from './api/auth/authentication.js';
import { registerErrorHandler } from './api/error-handler.js';
import { registerCurrentPlayerRoutes } from './api/routes/current-player.js';
import { registerHealthRoute } from './api/routes/health.js';
import { registerPlayerGameRoutes } from './api/routes/player-game.js';
import { registerPlayerProgressionRoutes } from './api/routes/player-progression.js';
import { registerWheelRoutes } from './api/routes/wheel.js';
import type { AuthIdentityVerifier } from './application/auth/auth-identity-verifier.js';
import type { ChoosePlayerElement } from './application/player/choose-player-element.js';
import type { GetCurrentPlayerResources } from './application/player/get-current-player-resources.js';
import type { GetCurrentPlayerProgression } from './application/player/get-current-player-progression.js';
import type { GetOrProvisionCurrentPlayer } from './application/player/get-or-provision-current-player.js';
import type { SpinDailyWheel } from './application/wheel/spin-daily-wheel.js';
import type { GetTodayWheelState } from './application/wheel/get-today-wheel-state.js';
import { registerDailyRewardRoutes } from './api/routes/daily-reward.js';
import { registerGachaRoutes } from './api/routes/gacha.js';
import { registerBoxRoutes } from './api/routes/box.js';
import { registerTeamRoutes } from './api/routes/team.js';
import { registerBankRoutes } from './api/routes/bank.js';
import { registerInventoryRoutes } from './api/routes/inventory.js';
import { registerModerationRoutes } from './api/routes/moderation.js';
import { registerShopRoutes } from './api/routes/shop.js';
import type { ModerationTools } from './application/moderation/moderation-tools.js';
import type { GetCharacters, GetCurrentGacha, GetGachaHistory, PerformGachaPull, SetGachaTarget } from './application/gacha/gacha-services.js';
import type { GetTodayDailyReward } from './application/daily-reward/get-today-daily-reward.js';
import type { ClaimDailyReward } from './application/daily-reward/claim-daily-reward.js';
import type { GetCurrentPlayerBox, SetBoxCharacterFavorite, SetBoxSortPreference, UseMasterlessStella } from './application/box/box-services.js';
import type { ActivatePlayerTeam, ClearPlayerTeam, CreateNextPlayerTeam, DeleteExtraPlayerTeam, GetCurrentPlayerTeams, RemovePlayerTeamSlot, RenamePlayerTeam, ReorderPlayerTeams, ReorderPlayerTeamSlots, SetPlayerTeamSlot } from './application/team/team-services.js';
import type { GetCurrentPlayerBank, GetPlayerBankHistory, TransferPlayerBank } from './application/banking/banking-services.js';
import type { GetCurrentPlayerInventory } from './application/inventory/inventory-services.js';
import type { AppConfig } from './config/environment.js';
import type { GetCurrentPlayerShop, GetPlayerShopHistory, PurchaseShopItem } from './application/shop/shop-services.js';
import { loadConfig } from './config/environment.js';
import type { NavigationPreferencesService } from './application/navigation/navigation-preferences.js';
import { registerNavigationPreferenceRoutes } from './api/routes/navigation-preferences.js';

export type AppDependencies = Readonly<{
  authIdentityVerifier: AuthIdentityVerifier;
  getOrProvisionCurrentPlayer: GetOrProvisionCurrentPlayer;
  choosePlayerElement?: ChoosePlayerElement;
  getCurrentPlayerResources?: GetCurrentPlayerResources;
  getCurrentPlayerProgression?: GetCurrentPlayerProgression;
  getTodayWheelState?: GetTodayWheelState;
  spinDailyWheel?: SpinDailyWheel;
  getTodayDailyReward?: GetTodayDailyReward;
  claimDailyReward?: ClaimDailyReward;
  getCharacters?: GetCharacters;
  getCurrentGacha?: GetCurrentGacha;
  setGachaTarget?: SetGachaTarget;
  performGachaPull?: PerformGachaPull;
  getGachaHistory?: GetGachaHistory;
  getCurrentPlayerBox?: GetCurrentPlayerBox;
  setBoxCharacterFavorite?: SetBoxCharacterFavorite;
  setBoxSortPreference?: SetBoxSortPreference;
  useMasterlessStella?: UseMasterlessStella;
  getCurrentPlayerTeams?: GetCurrentPlayerTeams;
  activatePlayerTeam?: ActivatePlayerTeam;
  renamePlayerTeam?: RenamePlayerTeam;
  createNextPlayerTeam?: CreateNextPlayerTeam;
  deleteExtraPlayerTeam?: DeleteExtraPlayerTeam;
  reorderPlayerTeams?: ReorderPlayerTeams;
  setPlayerTeamSlot?: SetPlayerTeamSlot;
  reorderPlayerTeamSlots?: ReorderPlayerTeamSlots;
  removePlayerTeamSlot?: RemovePlayerTeamSlot;
  clearPlayerTeam?: ClearPlayerTeam;
  getCurrentPlayerBank?: GetCurrentPlayerBank;
  getPlayerBankHistory?: GetPlayerBankHistory;
  depositPlayerBank?: TransferPlayerBank;
  withdrawPlayerBank?: TransferPlayerBank;
  getCurrentPlayerInventory?: GetCurrentPlayerInventory;
  moderationTools?: ModerationTools;
  getCurrentPlayerShop?: GetCurrentPlayerShop;
  getPlayerShopHistory?: GetPlayerShopHistory;
  purchaseShopItem?: PurchaseShopItem;
  navigationPreferences?: NavigationPreferencesService;
  close?: () => Promise<void>;
}>;

export async function buildApp(
  config: AppConfig = loadConfig(),
  dependencies?: AppDependencies,
): Promise<FastifyInstance> {
  const app = fastify({
    logger: true,
    genReqId: (request) => request.headers['x-request-id']?.toString() || randomUUID(),
    requestIdHeader: 'x-request-id',
  });

  registerErrorHandler(app);

  const frontendOrigin = config.frontendOrigin ?? 'http://localhost:5173';
  await app.register(cors, {
    origin: (requestOrigin, callback) => {
      callback(null, requestOrigin === frontendOrigin);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });

  app.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id);
    done();
  });

  await app.register(registerHealthRoute);

  if (dependencies) {
    registerAuthenticationContext(app);
    await app.register(registerCurrentPlayerRoutes, {
      authenticate: createAuthenticationHook(dependencies.authIdentityVerifier),
      getOrProvisionCurrentPlayer: dependencies.getOrProvisionCurrentPlayer,
    });

    const authenticate = createAuthenticationHook(dependencies.authIdentityVerifier);
    if (dependencies.choosePlayerElement && dependencies.getCurrentPlayerResources) {
      await app.register(registerPlayerGameRoutes, {
        authenticate,
        choosePlayerElement: dependencies.choosePlayerElement,
        getCurrentPlayerResources: dependencies.getCurrentPlayerResources,
      });
    }
    if (dependencies.getCurrentPlayerProgression) {
      await app.register(registerPlayerProgressionRoutes, {
        authenticate,
        getCurrentPlayerProgression: dependencies.getCurrentPlayerProgression,
      });
    }
    if (dependencies.getTodayWheelState && dependencies.spinDailyWheel) {
      await app.register(registerWheelRoutes, {
        authenticate,
        getTodayWheelState: dependencies.getTodayWheelState,
        spinDailyWheel: dependencies.spinDailyWheel,
      });
    }
    if (dependencies.getTodayDailyReward && dependencies.claimDailyReward) {
      await app.register(registerDailyRewardRoutes, { authenticate, getTodayDailyReward: dependencies.getTodayDailyReward, claimDailyReward: dependencies.claimDailyReward });
    }
    if (dependencies.getCharacters && dependencies.getCurrentGacha && dependencies.setGachaTarget) {
      await app.register(registerGachaRoutes, { authenticate, getCharacters: dependencies.getCharacters, getCurrentGacha: dependencies.getCurrentGacha, setGachaTarget: dependencies.setGachaTarget, performGachaPull: dependencies.performGachaPull, getGachaHistory: dependencies.getGachaHistory });
    }
    if (dependencies.getCurrentPlayerBox && dependencies.setBoxCharacterFavorite && dependencies.setBoxSortPreference && dependencies.useMasterlessStella) {
      await app.register(registerBoxRoutes, {
        authenticate, getCurrentPlayerBox: dependencies.getCurrentPlayerBox,
        setBoxCharacterFavorite: dependencies.setBoxCharacterFavorite,
        setBoxSortPreference: dependencies.setBoxSortPreference,
        useMasterlessStella: dependencies.useMasterlessStella,
      });
    }
    if (dependencies.getCurrentPlayerTeams && dependencies.activatePlayerTeam && dependencies.renamePlayerTeam && dependencies.createNextPlayerTeam && dependencies.deleteExtraPlayerTeam && dependencies.reorderPlayerTeams && dependencies.setPlayerTeamSlot && dependencies.reorderPlayerTeamSlots && dependencies.removePlayerTeamSlot && dependencies.clearPlayerTeam) {
      await app.register(registerTeamRoutes, {
        authenticate,
        getCurrentPlayerTeams: dependencies.getCurrentPlayerTeams,
        activatePlayerTeam: dependencies.activatePlayerTeam,
        renamePlayerTeam: dependencies.renamePlayerTeam,
        createNextPlayerTeam: dependencies.createNextPlayerTeam,
        deleteExtraPlayerTeam: dependencies.deleteExtraPlayerTeam,
        reorderPlayerTeams: dependencies.reorderPlayerTeams,
        setPlayerTeamSlot: dependencies.setPlayerTeamSlot,
        reorderPlayerTeamSlots: dependencies.reorderPlayerTeamSlots,
        removePlayerTeamSlot: dependencies.removePlayerTeamSlot,
        clearPlayerTeam: dependencies.clearPlayerTeam,
      });
    }
    if (dependencies.getCurrentPlayerBank && dependencies.getPlayerBankHistory && dependencies.depositPlayerBank && dependencies.withdrawPlayerBank) {
      await app.register(registerBankRoutes, {
        authenticate,
        getCurrentPlayerBank: dependencies.getCurrentPlayerBank,
        getPlayerBankHistory: dependencies.getPlayerBankHistory,
        depositPlayerBank: dependencies.depositPlayerBank,
        withdrawPlayerBank: dependencies.withdrawPlayerBank,
      });
    }
    if (dependencies.getCurrentPlayerInventory) {
      await app.register(registerInventoryRoutes, { authenticate, getCurrentPlayerInventory: dependencies.getCurrentPlayerInventory });
    }
    if (dependencies.moderationTools) {
      await app.register(registerModerationRoutes, { authenticate, moderationTools: dependencies.moderationTools });
    }
    if (dependencies.getCurrentPlayerShop && dependencies.getPlayerShopHistory && dependencies.purchaseShopItem) {
      await app.register(registerShopRoutes, { authenticate, getCurrentPlayerShop: dependencies.getCurrentPlayerShop, getPlayerShopHistory: dependencies.getPlayerShopHistory, purchaseShopItem: dependencies.purchaseShopItem });
    }
    if (dependencies.navigationPreferences) {
      await app.register(registerNavigationPreferenceRoutes, { authenticate, service: dependencies.navigationPreferences });
    }

    if (dependencies.close) {
      app.addHook('onClose', dependencies.close);
    }
  }

  app.addHook('onReady', () => {
    app.log.info({ host: config.host, port: config.port }, 'Application ready');
  });

  return app;
}
