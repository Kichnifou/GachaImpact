import type { SocialService } from './application/social/social-service.js';
import type { TradeService } from './application/trades/trade-service.js';
import type { GetCurrentPlayer } from './application/player/get-current-player.js';
import type { TwitchPilotService } from './application/twitch/twitch-pilot-service.js';
import type { SnapshotPilotService } from './application/migration/snapshot-pilot-service.js';
import { registerTwitchPilotRoutes } from './api/routes/twitch-pilot.js';
import { registerTradeRoutes } from './api/routes/trades.js';
import { registerSocialRoutes } from './api/routes/social.js';
import { registerAppearanceRoutes } from './api/routes/appearance.js';
import type { AppearanceService } from './application/appearance/appearance-service.js';
import { registerChatRoutes } from './api/routes/chat.js';
import type { GlobalChatService } from './application/chat/global-chat-service.js';
import type { ChatCommandDispatcher } from './application/chat/chat-command-dispatcher.js';
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
import type { BannerVoteService } from './application/gacha/banner-vote-service.js';
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
import type { GetCurrentPlayerInventory, GetCurrentPlayerInventoryItemDetail } from './application/inventory/inventory-services.js';
import type { AppConfig } from './config/environment.js';
import type { GetCurrentPlayerShop, GetPlayerShopHistory, PurchaseShopItem } from './application/shop/shop-services.js';
import { loadConfig } from './config/environment.js';
import type { NavigationPreferencesService } from './application/navigation/navigation-preferences.js';
import { registerNavigationPreferenceRoutes } from './api/routes/navigation-preferences.js';
import { registerDailyChallengeRoutes } from './api/routes/daily-challenge.js';
import type { ConvertPersonalParticles, GetDailyChallenge, PurchaseDailyChallenge, SwitchDailyChallenge } from './application/daily-challenge/daily-challenge-services.js';
import type { CombatService } from './application/combat/daily-combat-service.js';
import { registerDailyCombatRoutes } from './api/routes/daily-combat.js';
import type { ExpeditionService } from './application/expedition/expedition-service.js';
import type { NotificationService } from './application/notification/notification-service.js';
import { registerExpeditionRoutes } from './api/routes/expedition.js';
import { registerNotificationRoutes } from './api/routes/notifications.js';
import type { MonthlyBossService } from './application/combat/monthly-boss-service.js';
import { registerMonthlyBossRoutes } from './api/routes/monthly-boss.js';
import type { ContestService } from './application/contest/contest-service.js';
import { registerContestRoutes } from './api/routes/contest.js';
import type { GiftCodeService } from './application/gift-code/gift-code-service.js';
import { registerGiftCodeRoutes } from './api/routes/gift-codes.js';
import type { EventService } from './application/event/event-service.js';
import { registerEventRoutes } from './api/routes/event.js';
import type { DirectMessageService } from './application/direct-messages/direct-message-service.js';
import { registerDirectMessageRoutes } from './api/routes/direct-messages.js';
import type { DirectMessageReportService } from './application/direct-messages/direct-message-report-service.js';
import { registerDirectMessageReportRoutes } from './api/routes/direct-message-reports.js';
import type { GetCurrentPlayerMissions } from './application/missions/get-current-player-missions.js';
import type { GetPlayerMissions } from './application/missions/get-player-missions.js';
import { registerMissionRoutes } from './api/routes/missions.js';
import type { RankingService } from './application/ranking/ranking-service.js';
import { registerRankingRoutes } from './api/routes/ranking.js';
import type { HistoryService } from './application/history/history-service.js';
import { registerHistoryRoutes } from './api/routes/history.js';

export type AppDependencies = Readonly<{
  globalChatService?: GlobalChatService;
  chatCommandDispatcher?: ChatCommandDispatcher;
  rankingService?: RankingService;
  historyService?: HistoryService;
  tradeService?: TradeService;
  twitchPilot?: TwitchPilotService;
  snapshotPilot?: SnapshotPilotService;
  tradePlayer?: GetCurrentPlayer;
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
  bannerVotes?: BannerVoteService;
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
  getCurrentPlayerInventoryItemDetail?: GetCurrentPlayerInventoryItemDetail;
  convertPersonalParticles?: ConvertPersonalParticles;
  getDailyChallenge?: GetDailyChallenge;
  purchaseDailyChallenge?: PurchaseDailyChallenge;
  switchDailyChallenge?: SwitchDailyChallenge;
  moderationTools?: ModerationTools;
  getCurrentPlayerShop?: GetCurrentPlayerShop;
  getPlayerShopHistory?: GetPlayerShopHistory;
  purchaseShopItem?: PurchaseShopItem;
  navigationPreferences?: NavigationPreferencesService;
  dailyCombatService?: CombatService;
  expeditionService?: ExpeditionService;
  notificationService?: NotificationService;
  monthlyBossService?: MonthlyBossService;
  contestService?: ContestService;
  giftCodeService?: GiftCodeService;
  eventService?: EventService;
  socialService?: SocialService;
  appearanceService?: AppearanceService;
  directMessageService?: DirectMessageService;
  directMessageReportService?: DirectMessageReportService;
  getCurrentPlayerMissions?: GetCurrentPlayerMissions;
  getPlayerMissions?: GetPlayerMissions;
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
      appearanceService: dependencies.appearanceService,
    });

    const authenticate = createAuthenticationHook(dependencies.authIdentityVerifier);
    if (dependencies.twitchPilot && dependencies.snapshotPilot) await app.register(registerTwitchPilotRoutes, { authenticate, twitch: dependencies.twitchPilot, snapshot: dependencies.snapshotPilot, config });
    if (dependencies.tradeService && dependencies.tradePlayer) await app.register(registerTradeRoutes, { authenticate, service: dependencies.tradeService, getPlayer: dependencies.tradePlayer });
    if (dependencies.socialService) await app.register(registerSocialRoutes, { authenticate, service: dependencies.socialService });
    if (dependencies.appearanceService) await app.register(registerAppearanceRoutes, { authenticate, service: dependencies.appearanceService });
    if (dependencies.rankingService && dependencies.socialService) await app.register(registerRankingRoutes, { authenticate, service: dependencies.rankingService, social: dependencies.socialService });
    if (dependencies.historyService && dependencies.socialService) await app.register(registerHistoryRoutes, { authenticate, service: dependencies.historyService, social: dependencies.socialService });
    if (dependencies.directMessageService) await app.register(registerDirectMessageRoutes, { authenticate, service: dependencies.directMessageService });
    if (dependencies.directMessageReportService) await app.register(registerDirectMessageReportRoutes, { authenticate, service: dependencies.directMessageReportService });
    if (dependencies.globalChatService && dependencies.chatCommandDispatcher) await app.register(registerChatRoutes, { authenticate, service: dependencies.globalChatService, dispatcher: dependencies.chatCommandDispatcher });
    if (dependencies.getCurrentPlayerMissions) await app.register(registerMissionRoutes, { authenticate, getCurrentPlayerMissions: dependencies.getCurrentPlayerMissions, getPlayerMissions: dependencies.getPlayerMissions });
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
      await app.register(registerGachaRoutes, { authenticate, getCharacters: dependencies.getCharacters, getCurrentGacha: dependencies.getCurrentGacha, setGachaTarget: dependencies.setGachaTarget, performGachaPull: dependencies.performGachaPull, getGachaHistory: dependencies.getGachaHistory, bannerVotes: dependencies.bannerVotes });
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
      await app.register(registerInventoryRoutes, { authenticate, getCurrentPlayerInventory: dependencies.getCurrentPlayerInventory, getCurrentPlayerInventoryItemDetail: dependencies.getCurrentPlayerInventoryItemDetail, convertPersonalParticles: dependencies.convertPersonalParticles });
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
    if (dependencies.getDailyChallenge && dependencies.purchaseDailyChallenge && dependencies.switchDailyChallenge) {
      await app.register(registerDailyChallengeRoutes, { authenticate, getDailyChallenge: dependencies.getDailyChallenge, purchaseDailyChallenge: dependencies.purchaseDailyChallenge, switchDailyChallenge: dependencies.switchDailyChallenge });
    }
    if (dependencies.dailyCombatService) {
      await app.register(registerDailyCombatRoutes, { authenticate, service: dependencies.dailyCombatService });
    }
    if (dependencies.expeditionService) {
      await app.register(registerExpeditionRoutes, { authenticate, service: dependencies.expeditionService });
    }
    if (dependencies.notificationService) {
      await app.register(registerNotificationRoutes, { authenticate, service: dependencies.notificationService });
    }
    if (dependencies.monthlyBossService) {
      await app.register(registerMonthlyBossRoutes, { authenticate, service: dependencies.monthlyBossService });
    }
    if (dependencies.contestService) {
      await app.register(registerContestRoutes, { authenticate, service: dependencies.contestService });
    }
    if (dependencies.giftCodeService) {
      await app.register(registerGiftCodeRoutes, { authenticate, service: dependencies.giftCodeService });
    }
    if (dependencies.eventService) {
      await app.register(registerEventRoutes, { authenticate, service: dependencies.eventService });
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
