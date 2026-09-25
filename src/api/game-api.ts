import type { SocialActions, DirectoryPage, Profile, ConnectedPlayers, PrivacySettings, FriendsSnapshot, HeartResult, FriendSort } from '../social/types'
import { loadFrontendConfig } from '../config/environment'
import type { TradeActions, TradeSnapshot, TradePartners, TradeResult } from '../trades/types'
import type { BannerVoteDto } from './types'
import type { ChatMentionDto, ChatPageDto, ChatSendDto, ChatUpdatesDto, DirectConversationListDto, DirectMessageArchiveDto, DirectMessageBlockDto, DirectMessageHistoryAnchorDto, DirectMessageHistoryPageDto, DirectMessageHistorySearchDto, DirectMessageInitiateDto, DirectMessageMutationDto, DirectMessagePageDto, DirectMessagePlayerDto, DirectMessageReceiptDto, DirectMessageReportDetailDto, DirectMessageReportPageDto, DirectMessageReportPreviewDto, DirectMessageResolveDto, DirectMessageSendDto, DirectMessageUnreadDto } from './types'
import { getSupabaseClient } from '../infrastructure/supabase/client'
import type {
  BackendErrorDto,
  ElementChoiceDto,
  ElementKey,
  PlayerDto,
  PlayerResourcesDto,
  PlayerMissionsDto,
  PlayerProgressionDto,
  WheelSpinDto,
  WheelTodayDto,
  DailyRewardTodayDto,
  DailyRewardClaimDto,
  CharacterCatalogDto,
  CurrentGachaDto,
  PlayerGachaStateDto,
  GachaPullDto,
  GachaHistoryDto,
  PlayerBoxDto,
  BoxCharacterDto,
  BoxSortPreferenceDto,
  StellaUseDto,
  PlayerTeamsDto,
  PlayerBankDto,
  BankTransferDto,
  BankHistoryDto,
  PlayerShopDto,
  ShopPurchaseDto,
  ShopHistoryDto,
  PlayerInventoryDto,
  InventoryItemDetailDto,
  ModerationPlayerListQuery,
  ModerationPlayerPageDto,
  ModerationPermissionsDto,
  ModerationStateDto,
  NavigationMenuPreferenceDto,
  DailyChallengeDto,
  DailyChallengeMutationDto,
  DailyCombatDto,
  DailyCombatFightDto,
  ExpeditionDto,
  ExpeditionStartDto,
  ExpeditionClaimDto,
  NotificationsDto,
  MonthlyBossDto,
  MonthlyBossAttackDto,
  MonthlyBossHistoryDto,
  ContestDto,
  ContestHistoryDto,
  ContestSnapshotDto,
  PlayerGiftCodesDto,
  GiftCodeClaimDto,
  AdminGiftCodesDto,
  AdminGiftCodeMutationDto,
  GiftCodeAdminQuery,
  GiftCodeClaimantQuery,
  GiftCodeClaimantsDto,
  EventDto,
  EventDailyBonusClaimDto, EventCalendarClaimDto,
  EventShopMutationDto,
  EventRankingDto,
  EventGameAAttemptDto,
  EventGameBAttemptDto,
  EventGameCRecipientQuery,
  EventGameCRecipientsDto,
  EventGameCSendDto,
  EventJoinDto,
} from './types'

type ApiClientDependencies = Readonly<{
  baseUrl: string
  getAccessToken: () => Promise<string | null>
  fetchImplementation?: typeof fetch
}>

export class ApiError extends Error {
  public readonly code: string
  public readonly status: number | null
  public readonly requestId?: string

  constructor(
    code: string,
    message: string,
    status: number | null,
    requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.requestId = requestId
  }
}

export function createGameApiClient(dependencies: ApiClientDependencies) {
  const fetchImplementation = dependencies.fetchImplementation ?? fetch
  const baseUrl = dependencies.baseUrl.replace(/\/$/, '')

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const accessToken = await dependencies.getAccessToken()

    if (!accessToken) {
      throw new ApiError('SESSION_REQUIRED', 'Une session valide est nécessaire.', 401)
    }

    let response: Response

    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(init?.body ? { 'content-type': 'application/json' } : {}),
          ...init?.headers,
        },
      })
    } catch {
      throw new ApiError(
        'NETWORK_ERROR',
        'Impossible de joindre le serveur GachaImpact.',
        null,
      )
    }

    const payload = await readJson(response)

    if (!response.ok) {
      const backendError = isBackendErrorDto(payload) ? payload.error : undefined
      throw new ApiError(
        backendError?.code ?? `HTTP_${response.status}`,
        backendError?.message ?? 'La requête a échoué.',
        response.status,
        backendError?.requestId,
      )
    }

    return payload as T
  }

  return {
    chat: {
      messages: (cursor?: ChatPageDto['nextCursor']) => request<ChatPageDto>('/api/v1/chat/messages' + (cursor ? '?' + new URLSearchParams({ cursorCreatedAt: cursor.createdAt, cursorId: cursor.id }) : '')),
      updates: (generation: number, cursor: { createdAt: string; id: string } | null, knownIds: string[]) => request<ChatUpdatesDto>('/api/v1/chat/updates', { method: 'POST', body: JSON.stringify({ generation, ...(cursor ? { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id } : {}), knownIds }) }),
      unread: () => request<{ unreadCount: number; generation: number }>('/api/v1/chat/unread'),
      read: (messageId: string) => request<{ lastReadMessageId: string; changed: boolean }>('/api/v1/chat/read', { method: 'POST', body: JSON.stringify({ messageId }) }),
      send: (content: string, idempotencyKey: string, replyToMessageId: string | null, mentions: ChatMentionDto[]) => request<ChatSendDto>('/api/v1/chat/messages', { method: 'POST', body: JSON.stringify({ content, idempotencyKey, replyToMessageId, mentions }) }),
      remove: (messageId: string) => request<{ id: string; changed: boolean }>(`/api/v1/chat/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' }),
      mentions: (q: string) => request<{ players: { id: string; displayName: string; elementKey: string | null }[] }>('/api/v1/chat/mentions?' + new URLSearchParams({ q })),
      report: (messageId: string) => request<{ reported: boolean; duplicate: boolean }>(`/api/v1/chat/messages/${encodeURIComponent(messageId)}/report`, { method: 'POST' }),
    },
    directMessages: {
      players: (q: string) => request<{ players: readonly DirectMessagePlayerDto[] }>('/api/v1/me/direct-conversations/players?' + new URLSearchParams({ q })),
      list: (archived = false) => request<DirectConversationListDto>('/api/v1/me/direct-conversations?' + new URLSearchParams({ archived: String(archived) })),
      unread: () => request<DirectMessageUnreadDto>('/api/v1/me/direct-conversations/unread'),
      messages: (conversationId: string, cursor?: DirectMessagePageDto['nextCursor']) => request<DirectMessagePageDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/messages` + (cursor ? '?' + new URLSearchParams({ cursorCreatedAt: cursor.createdAt, cursorId: cursor.id }) : '')),
      history: (conversationId: string, cursor: { beforeOrder?: string; afterOrder?: string; aroundOrder?: string } = {}) => request<DirectMessageHistoryPageDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/history?` + new URLSearchParams(cursor)),
      historySearch: (conversationId: string, q: string, cursor?: string) => request<DirectMessageHistorySearchDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/history/search?` + new URLSearchParams({ q, ...(cursor ? { cursor } : {}) })),
      historyDate: (conversationId: string, at: string) => request<DirectMessageHistoryAnchorDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/history/date?` + new URLSearchParams({ at })),
      initiate: (targetPlayerId: string, content: string, idempotencyKey: string) => request<DirectMessageInitiateDto>('/api/v1/me/direct-conversations', { method: 'POST', body: JSON.stringify({ targetPlayerId, content, idempotencyKey }) }),
      send: (conversationId: string, content: string, idempotencyKey: string) => request<DirectMessageSendDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body: JSON.stringify({ content, idempotencyKey }) }),
      edit: (conversationId: string, messageId: string, content: string, idempotencyKey: string) => request<DirectMessageMutationDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { method: 'PATCH', body: JSON.stringify({ content, idempotencyKey }) }),
      remove: (conversationId: string, messageId: string, idempotencyKey: string) => request<DirectMessageMutationDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/delete`, { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
      restore: (conversationId: string, messageId: string, idempotencyKey: string) => request<DirectMessageMutationDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/restore`, { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
      accept: (conversationId: string, requestId: string, idempotencyKey: string) => request<DirectMessageResolveDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/accept`, { method: 'POST', body: JSON.stringify({ requestId, idempotencyKey }) }),
      ignore: (conversationId: string, requestId: string, idempotencyKey: string) => request<DirectMessageResolveDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/ignore`, { method: 'POST', body: JSON.stringify({ requestId, idempotencyKey }) }),
      block: (conversationId: string, idempotencyKey: string) => request<DirectMessageBlockDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/block`, { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
      unblock: (conversationId: string, idempotencyKey: string) => request<DirectMessageBlockDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/unblock`, { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
      read: (conversationId: string, messageId: string) => request<{ lastReadMessageId: string; sharedReadAt: string | null; changed: boolean }>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/read`, { method: 'POST', body: JSON.stringify({ messageId }) }),
      receipts: (conversationId: string, enabled: boolean) => request<DirectMessageReceiptDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/read-receipts`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
      archive: (conversationId: string, archived: boolean) => request<DirectMessageArchiveDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/archive`, { method: 'PATCH', body: JSON.stringify({ archived }) }),
      reportPreview: (conversationId: string, messageId: string) => request<DirectMessageReportPreviewDto>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/report-preview`),
      report: (conversationId: string, messageId: string, snapshotFingerprint: string) => request<{ reported: true; duplicate: boolean }>(`/api/v1/me/direct-conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/report`, { method: 'POST', body: JSON.stringify({ snapshotFingerprint }) }),
    },
    getCurrentPlayer: () => request<PlayerDto>('/api/v1/me'),
    getPermissions: () => request<ModerationPermissionsDto>('/api/v1/me/permissions'),
    social: {
      friends: () => request<FriendsSnapshot>('/api/v1/me/friends'),
      friendAction: (targetPlayerId, action, idempotencyKey, requestId) => request<{ state: string }>('/api/v1/me/friends/actions', { method: 'POST', body: JSON.stringify({ targetPlayerId, action, idempotencyKey, requestId }) }),
      sendHearts: (targetPlayerId, idempotencyKey) => request<HeartResult>('/api/v1/me/friends/hearts', { method: 'POST', body: JSON.stringify({ targetPlayerId, idempotencyKey }) }),
      saveFriendSort: sort => request<{ sort: FriendSort }>('/api/v1/me/friends/sort', { method: 'PATCH', body: JSON.stringify({ sort }) }),
      directory: query => request<DirectoryPage>('/api/v1/players?' + new URLSearchParams({ q: query.q, page: String(query.page), ...(query.element ? { element: query.element } : {}), ...(query.status ? { status: query.status } : {}), ...(query.relation ? { relation: query.relation } : {}) })),
      profile: id => request<Profile>('/api/v1/players/' + encodeURIComponent(id) + '/profile'),
      connected: () => request<ConnectedPlayers>('/api/v1/social/presence'),
      privacy: () => request<PrivacySettings>('/api/v1/me/privacy'),
      savePrivacy: (categoryKey, level) => request<PrivacySettings>('/api/v1/me/privacy', { method: 'PATCH', body: JSON.stringify({ categoryKey, level }) }),
      session: (sessionKey, activity) => request('/api/v1/me/presence/session', { method: 'POST', body: JSON.stringify({ sessionKey, activity }) }),
      heartbeat: (sessionKey, activity) => request('/api/v1/me/presence/heartbeat', { method: 'POST', body: JSON.stringify({ sessionKey, activity }) }),
      end: sessionKey => request('/api/v1/me/presence/session', { method: 'DELETE', keepalive: true, body: JSON.stringify({ sessionKey }) }),
    } satisfies SocialActions,
    trades: {
      snapshot: () => request<TradeSnapshot>('/api/v1/me/trades'),
      partners: (q, page, signal) => request<TradePartners>('/api/v1/me/trades/partners?' + new URLSearchParams({ q, page: String(page) }), { signal }),
      create: (recipientPlayerId, amount, idempotencyKey) => request<TradeResult>('/api/v1/me/trades', { method: 'POST', body: JSON.stringify({ recipientPlayerId, amount, idempotencyKey }) }),
      mutate: (id, action, idempotencyKey) => request<TradeResult>(`/api/v1/me/trades/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
      all: (action, idempotencyKey) => request<{ results: TradeResult[] }>(`/api/v1/me/trades/${action}-all`, { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    } satisfies TradeActions,
    getNavigationPreferences: () => request<NavigationMenuPreferenceDto>('/api/v1/me/navigation-preferences'),
    putNavigationPreferences: (value: NavigationMenuPreferenceDto) => request<NavigationMenuPreferenceDto>('/api/v1/me/navigation-preferences', { method: 'PUT', body: JSON.stringify(value) }),
    getModerationState: () => request<ModerationStateDto>('/api/v1/moderation/me'),
    getDirectMessageReports: (page = 1) => request<DirectMessageReportPageDto>('/api/v1/moderation/direct-message-reports?' + new URLSearchParams({ page: String(page) })),
    getDirectMessageReport: (reportId: string) => request<DirectMessageReportDetailDto>(`/api/v1/moderation/direct-message-reports/${encodeURIComponent(reportId)}`),
    deleteDirectMessageReport: (reportId: string) => request<{ deleted: true }>(`/api/v1/moderation/direct-message-reports/${encodeURIComponent(reportId)}`, { method: 'DELETE' }),
    getModerationPlayerState: (playerId: string) => request<ModerationStateDto>(`/api/v1/moderation/players/${playerId}/state`),
    listModerationPlayers: (input: ModerationPlayerListQuery = {}) => {
      const query = new URLSearchParams()
      if (input.query) query.set('query', input.query)
      if (input.elementKey) query.set('elementKey', input.elementKey)
      if (input.tester) query.set('tester', input.tester)
      if (input.sort) query.set('sort', input.sort)
      if (input.direction) query.set('direction', input.direction)
      if (input.page) query.set('page', String(input.page))
      const suffix = query.size > 0 ? `?${query.toString()}` : ''
      return request<ModerationPlayerPageDto>(`/api/v1/moderation/players${suffix}`)
    },
    adjustModerationResource: (input: { resourceKey: string; amount: string; direction: 'add' | 'remove'; idempotencyKey: string }) => request<ModerationStateDto>('/api/v1/moderation/me/resources', { method: 'POST', body: JSON.stringify(input) }),
    setModerationXp: (input: { totalXp?: string; prepareNextLevel?: true; idempotencyKey: string }) => request<ModerationStateDto>('/api/v1/moderation/me/xp', { method: 'POST', body: JSON.stringify(input) }),
    setModerationGacha: (input: { pity5?: number; pity4?: number; guaranteedFeatured5?: boolean; captureProgress?: number; idempotencyKey: string }) => request<ModerationStateDto>('/api/v1/moderation/me/gacha', { method: 'POST', body: JSON.stringify(input) }),
    setModerationStella: (quantity: string, idempotencyKey: string) => request<ModerationStateDto>('/api/v1/moderation/me/stella', { method: 'POST', body: JSON.stringify({ quantity, idempotencyKey }) }),
    adjustModerationPlayerResource: (playerId: string, input: { resourceKey: string; amount: string; direction: 'add' | 'remove'; idempotencyKey: string }) => request<ModerationStateDto>(`/api/v1/moderation/players/${playerId}/resources`, { method: 'POST', body: JSON.stringify(input) }),
    setModerationPlayerXp: (playerId: string, input: { totalXp?: string; prepareNextLevel?: true; idempotencyKey: string }) => request<ModerationStateDto>(`/api/v1/moderation/players/${playerId}/xp`, { method: 'POST', body: JSON.stringify(input) }),
    setModerationPlayerGacha: (playerId: string, input: { pity5?: number; pity4?: number; guaranteedFeatured5?: boolean; captureProgress?: number; idempotencyKey: string }) => request<ModerationStateDto>(`/api/v1/moderation/players/${playerId}/gacha`, { method: 'POST', body: JSON.stringify(input) }),
    setModerationPlayerStella: (playerId: string, quantity: string, idempotencyKey: string) => request<ModerationStateDto>(`/api/v1/moderation/players/${playerId}/stella`, { method: 'POST', body: JSON.stringify({ quantity, idempotencyKey }) }),
    setModerationPlayerTester: (playerId: string, enabled: boolean, idempotencyKey: string) => request<ModerationStateDto>(`/api/v1/moderation/players/${playerId}/tester`, { method: 'POST', body: JSON.stringify({ enabled, idempotencyKey }) }),
    onboardPlayer: (displayName: string) =>
      request<PlayerDto>('/api/v1/onboarding/player', {
        method: 'POST',
        body: JSON.stringify({ displayName }),
      }),
    chooseElement: (elementKey: ElementKey) =>
      request<ElementChoiceDto>('/api/v1/me/element', {
        method: 'POST',
        body: JSON.stringify({ elementKey }),
      }),
    getResources: () => request<PlayerResourcesDto>('/api/v1/me/resources'),
    getMissions: () => request<PlayerMissionsDto>('/api/v1/me/missions'),
    getInventory: () => request<PlayerInventoryDto>('/api/v1/me/inventory'),
    getInventoryItemDetail: (itemId: string, page = 1) => request<InventoryItemDetailDto>(`/api/v1/me/inventory/items/${itemId}?page=${page}`),
    convertPersonalParticles: (amount: string, idempotencyKey: string) => request<DailyChallengeMutationDto>('/api/v1/me/inventory/particles/convert', { method: 'POST', body: JSON.stringify({ amount, idempotencyKey }) }),
    getDailyChallenge: () => request<DailyChallengeDto>('/api/v1/me/daily-challenge'),
    purchaseDailyChallenge: (idempotencyKey: string) => request<DailyChallengeMutationDto>('/api/v1/me/daily-challenge/purchase', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    switchDailyChallenge: (idempotencyKey: string) => request<DailyChallengeMutationDto>('/api/v1/me/daily-challenge/switch', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    getDailyCombat: () => request<DailyCombatDto>('/api/v1/me/combat/daily'),
    setDailyCombatSlot: (position: number, characterId: string) => request<DailyCombatDto>(`/api/v1/me/combat/daily/loadout/${position}`, { method: 'PUT', body: JSON.stringify({ characterId }) }),
    removeDailyCombatSlot: (position: number) => request<DailyCombatDto>(`/api/v1/me/combat/daily/loadout/${position}`, { method: 'DELETE' }),
    copyActiveTeamToDailyCombat: () => request<DailyCombatDto>('/api/v1/me/combat/daily/loadout/copy-active', { method: 'POST' }),
    autoSelectDailyCombat: () => request<DailyCombatDto>('/api/v1/me/combat/daily/loadout/auto', { method: 'POST' }),
    clearDailyCombatLoadout: () => request<DailyCombatDto>('/api/v1/me/combat/daily/loadout', { method: 'DELETE' }),
    fightDailyCombat: (idempotencyKey: string) => request<DailyCombatFightDto>('/api/v1/me/combat/daily/fight', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    getMonthlyBoss: () => request<MonthlyBossDto>('/api/v1/me/combat/boss'),
    setMonthlyBossSlot: (position: number, characterId: string) => request<MonthlyBossDto>(`/api/v1/me/combat/boss/loadout/slots/${position}`, { method: 'PUT', body: JSON.stringify({ characterId }) }),
    removeMonthlyBossSlot: (position: number) => request<MonthlyBossDto>(`/api/v1/me/combat/boss/loadout/slots/${position}`, { method: 'DELETE' }),
    copyActiveTeamToMonthlyBoss: () => request<MonthlyBossDto>('/api/v1/me/combat/boss/loadout/copy-active-team', { method: 'POST' }),
    clearMonthlyBossLoadout: () => request<MonthlyBossDto>('/api/v1/me/combat/boss/loadout/clear', { method: 'POST' }),
    attackMonthlyBoss: (bossId: string, idempotencyKey: string) => request<MonthlyBossAttackDto>('/api/v1/me/combat/boss/attack', { method: 'POST', body: JSON.stringify({ bossId, idempotencyKey }) }),
    getMonthlyBossHistory: (page: number) => request<MonthlyBossHistoryDto>(`/api/v1/combat/boss/history?page=${page}`),
    getContest: () => request<ContestDto>('/api/v1/contest'),
    getContestHistory: (page: number) => request<ContestHistoryDto>(`/api/v1/contest/history?page=${page}`),
    getContestHistoryDetail: (contestId: string) => request<ContestSnapshotDto>(`/api/v1/contest/history/${encodeURIComponent(contestId)}`),
    openContest: (characterId: string, idempotencyKey: string) => request<ContestDto>('/api/v1/contest/open', { method: 'POST', body: JSON.stringify({ characterId, idempotencyKey }) }),
    joinContest: (characterId: string, idempotencyKey: string) => request<ContestDto>('/api/v1/contest/join', { method: 'POST', body: JSON.stringify({ characterId, idempotencyKey }) }),
    selectContestLegend: (characterId: string, idempotencyKey: string) => request<ContestDto>('/api/v1/contest/legend', { method: 'POST', body: JSON.stringify({ characterId, idempotencyKey }) }),
    setContestReady: (ready: boolean, idempotencyKey: string) => request<ContestDto>('/api/v1/contest/ready', { method: 'POST', body: JSON.stringify({ ready, idempotencyKey }) }),
    startContest: (idempotencyKey: string) => request<ContestDto>('/api/v1/contest/start', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    spectateContest: (idempotencyKey: string) => request<ContestDto>('/api/v1/contest/spectator', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    leaveContest: (idempotencyKey: string) => request<ContestDto>('/api/v1/contest/leave', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    cancelContest: (idempotencyKey: string) => request<ContestDto>('/api/v1/contest/cancel', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    playContest: (action: 'BASIC' | 'RISK', idempotencyKey: string) => request<ContestDto>('/api/v1/contest/action', { method: 'POST', body: JSON.stringify({ action, idempotencyKey }) }),
    supportContest: (targetSlot: number, idempotencyKey: string) => request<ContestDto>('/api/v1/contest/support', { method: 'POST', body: JSON.stringify({ targetSlot, idempotencyKey }) }),
    removeContestParticipant: (playerId: string, idempotencyKey: string) => request<ContestDto>(`/api/v1/contest/participants/${playerId}`, { method: 'DELETE', body: JSON.stringify({ idempotencyKey }) }),
    removeContestSpectator: (playerId: string, idempotencyKey: string) => request<ContestDto>(`/api/v1/contest/spectators/${playerId}`, { method: 'DELETE', body: JSON.stringify({ idempotencyKey }) }),
    getExpedition: () => request<ExpeditionDto>('/api/v1/me/expedition'),
    startExpedition: (characterId: string, idempotencyKey: string) => request<ExpeditionStartDto>('/api/v1/me/expedition/start', { method: 'POST', body: JSON.stringify({ characterId, idempotencyKey }) }),
    claimExpedition: (idempotencyKey: string) => request<ExpeditionClaimDto>('/api/v1/me/expedition/claim', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    getNotifications: () => request<NotificationsDto>('/api/v1/me/notifications'),
    getGiftCodes: () => request<PlayerGiftCodesDto>('/api/v1/me/gift-codes'),
    getEvent: () => request<EventDto>('/api/v1/me/event'),
    getEventRanking: () => request<EventRankingDto>('/api/v1/me/event/ranking'),
    joinEvent: (idempotencyKey: string) => request<EventJoinDto>('/api/v1/me/event/join', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    claimEventCalendar: (idempotencyKey: string) => request<EventCalendarClaimDto>('/api/v1/me/event/calendar/claim', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    claimEventDailyBonus: (idempotencyKey: string) => request<EventDailyBonusClaimDto>('/api/v1/me/event/daily-bonus/claim', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    convertEventShop: (target: 'PRIMOGEMS' | 'MORAS', quantity: number, idempotencyKey: string) => request<EventShopMutationDto>('/api/v1/me/event/shop/convert', { method: 'POST', body: JSON.stringify({ target, quantity, idempotencyKey }) }),
    purchaseEventCollection: (idempotencyKey: string) => request<EventShopMutationDto>('/api/v1/me/event/shop/collection', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    attemptEventGameA: (idempotencyKey: string) => request<EventGameAAttemptDto>('/api/v1/me/event/game-a/attempt', { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    attemptEventGameB: (code: string, idempotencyKey: string) => request<EventGameBAttemptDto>('/api/v1/me/event/game-b/attempt', { method: 'POST', body: JSON.stringify({ code, idempotencyKey }) }),
    searchEventGameCRecipients: (input: EventGameCRecipientQuery) => {
      const query = new URLSearchParams({ q: input.query, sort: input.sort, direction: input.direction, page: String(input.page) })
      if (input.elementKey) query.set('elementKey', input.elementKey)
      return request<EventGameCRecipientsDto>(`/api/v1/me/event/game-c/recipients?${query}`)
    },
    sendEventGameC: (recipientPlayerId: string, message: string, idempotencyKey: string) => request<EventGameCSendDto>('/api/v1/me/event/game-c/send', { method: 'POST', body: JSON.stringify({ recipientPlayerId, message, idempotencyKey }) }),
    consultEventGameCMessages: () => request<EventDto>('/api/v1/me/event/game-c/messages/consult', { method: 'POST', body: '{}' }),
    claimGiftCode: (editionId: string, idempotencyKey: string) => request<GiftCodeClaimDto>(`/api/v1/me/gift-codes/${encodeURIComponent(editionId)}/claim`, { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    getAdminGiftCodes: (query: GiftCodeAdminQuery) => request<AdminGiftCodesDto>(`/api/v1/moderation/gift-codes?${queryString(query)}`),
    createGiftCode: (input: { token?: string; title: string; description: string; type: 'ONE_OFF' | 'ANNUAL'; recurringMonth?: number; startsAt?: string; endsAt?: string; rewards: readonly { resourceKey: string; amount: string }[]; idempotencyKey: string }) => request<AdminGiftCodeMutationDto>('/api/v1/moderation/gift-codes', { method: 'POST', body: JSON.stringify(input) }),
    publishGiftCode: (codeId: string, idempotencyKey: string) => request<AdminGiftCodeMutationDto>(`/api/v1/moderation/gift-codes/${encodeURIComponent(codeId)}/publish`, { method: 'POST', body: JSON.stringify({ idempotencyKey }) }),
    updateGiftCode: (codeId: string, input: { token?: string; title?: string; description?: string; type?: 'ONE_OFF' | 'ANNUAL'; recurringMonth?: number; startsAt?: string; endsAt?: string; rewards?: readonly { resourceKey: string; amount: string }[]; disabled?: boolean; idempotencyKey: string }) => request<AdminGiftCodeMutationDto>(`/api/v1/moderation/gift-codes/${encodeURIComponent(codeId)}`, { method: 'PATCH', body: JSON.stringify(input) }),
    getGiftCodeClaimants: (codeId: string, query: GiftCodeClaimantQuery) => request<GiftCodeClaimantsDto>(`/api/v1/moderation/gift-codes/${encodeURIComponent(codeId)}/claimants?${queryString(query)}`),
    readNotification: (notificationId: string) => request<NotificationsDto>(`/api/v1/me/notifications/${notificationId}/read`, { method: 'POST' }),
    archiveNotification: (notificationId: string) => request<NotificationsDto>(`/api/v1/me/notifications/${notificationId}/archive`, { method: 'POST' }),
    readAllNotifications: () => request<NotificationsDto>('/api/v1/me/notifications/read-all', { method: 'POST' }),
    archiveReadNotifications: () => request<NotificationsDto>('/api/v1/me/notifications/archive-read', { method: 'POST' }),
    getBank: () => request<PlayerBankDto>('/api/v1/me/bank'),
    getBankHistory: (page: number) => request<BankHistoryDto>(`/api/v1/me/bank/history?page=${page}`),
    depositBank: (amount: string, idempotencyKey: string) => request<BankTransferDto>('/api/v1/me/bank/deposit', {
      method: 'POST', body: JSON.stringify({ amount, idempotencyKey }),
    }),
    withdrawBank: (amount: string, idempotencyKey: string) => request<BankTransferDto>('/api/v1/me/bank/withdraw', {
      method: 'POST', body: JSON.stringify({ amount, idempotencyKey }),
    }),
    getShop: () => request<PlayerShopDto>('/api/v1/me/shop'),
    getShopHistory: (page: number) => request<ShopHistoryDto>(`/api/v1/me/shop/history?page=${page}`),
    purchaseShopItem: (itemId: string, quantity: string, idempotencyKey: string) => request<ShopPurchaseDto>(`/api/v1/me/shop/${encodeURIComponent(itemId)}/purchase`, {
      method: 'POST', body: JSON.stringify({ quantity, idempotencyKey }),
    }),
    getProgression: () => request<PlayerProgressionDto>('/api/v1/me/progression'),
    getWheelToday: () => request<WheelTodayDto>('/api/v1/wheel/today'),
    spinWheel: () => request<WheelSpinDto>('/api/v1/wheel/spin', { method: 'POST' }),
    getDailyRewardToday: () => request<DailyRewardTodayDto>('/api/v1/daily-reward/today'),
    claimDailyReward: () => request<DailyRewardClaimDto>('/api/v1/daily-reward/claim', { method: 'POST' }),
    getCharacters: () => request<CharacterCatalogDto>('/api/v1/characters'),
    getBannerVotes: () => request<BannerVoteDto>('/api/v1/gacha/vote'),
    voteForBanner: (characterId: string, bannerRotationId: string) => request<BannerVoteDto>('/api/v1/gacha/vote', { method: 'POST', body: JSON.stringify({ characterId, bannerRotationId }) }),
    getCurrentGacha: () => request<CurrentGachaDto>('/api/v1/gacha/current'),
    setGachaTarget: (characterId: string) => request<{ playerState: PlayerGachaStateDto }>('/api/v1/gacha/target', { method: 'POST', body: JSON.stringify({ characterId }) }),
    pullGacha: (count: 1 | 10, idempotencyKey: string) => request<GachaPullDto>('/api/v1/gacha/pull', { method: 'POST', body: JSON.stringify({ count, idempotencyKey }) }),
    getGachaHistory: (page = 1) => request<GachaHistoryDto>(`/api/v1/gacha/history?page=${page}`),
    getBox: () => request<PlayerBoxDto>('/api/v1/me/box'),
    setBoxFavorite: (characterId: string, favorite: boolean) =>
      request<{ character: BoxCharacterDto }>(`/api/v1/me/box/${characterId}/favorite`, {
        method: 'PATCH',
        body: JSON.stringify({ favorite }),
      }),
    setBoxSortPreference: (preference: BoxSortPreferenceDto) =>
      request<{ preference: BoxSortPreferenceDto }>('/api/v1/me/box/preference', {
        method: 'PATCH', body: JSON.stringify(preference),
      }),
    useStella: (characterId: string, idempotencyKey: string) =>
      request<StellaUseDto>(`/api/v1/me/box/${characterId}/stella`, {
        method: 'POST', body: JSON.stringify({ idempotencyKey }),
      }),
    getTeams: () => request<PlayerTeamsDto>('/api/v1/me/teams'),
    activateTeam: (teamId: string) => request<PlayerTeamsDto>(`/api/v1/me/teams/${teamId}/active`, { method: 'PATCH' }),
    renameTeam: (teamId: string, name: string | null) => request<PlayerTeamsDto>(`/api/v1/me/teams/${teamId}/name`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    createNextTeam: (expectedPosition: number) => request<PlayerTeamsDto>('/api/v1/me/teams', { method: 'POST', body: JSON.stringify({ expectedPosition }) }),
    deleteTeam: (teamId: string) => request<PlayerTeamsDto>(`/api/v1/me/teams/${teamId}`, { method: 'DELETE' }),
    reorderTeams: (teamIds: readonly string[]) => request<PlayerTeamsDto>('/api/v1/me/teams/order', { method: 'PUT', body: JSON.stringify({ teamIds }) }),
    setTeamSlot: (teamId: string, position: number, characterId: string) =>
      request<PlayerTeamsDto>(`/api/v1/me/teams/${teamId}/slots/${position}`, {
        method: 'PUT', body: JSON.stringify({ characterId }),
      }),
    reorderTeamSlots: (teamId: string, characterIds: readonly (string | null)[]) =>
      request<PlayerTeamsDto>(`/api/v1/me/teams/${teamId}/slots/order`, { method: 'PUT', body: JSON.stringify({ characterIds }) }),
    removeTeamSlot: (teamId: string, position: number) =>
      request<PlayerTeamsDto>(`/api/v1/me/teams/${teamId}/slots/${position}`, { method: 'DELETE' }),
    clearTeam: (teamId: string) => request<PlayerTeamsDto>(`/api/v1/me/teams/${teamId}/slots`, { method: 'DELETE' }),
  }
}

export type GameApiClient = ReturnType<typeof createGameApiClient>

let singleton: GameApiClient | undefined

export function getGameApiClient(): GameApiClient {
  if (!singleton) {
    const config = loadFrontendConfig()
    singleton = createGameApiClient({
      baseUrl: config.apiBaseUrl,
      getAccessToken: async () => {
        const { data } = await getSupabaseClient().auth.getSession()
        return data.session?.access_token ?? null
      },
    })
  }

  return singleton
}

function queryString(value: object) {
  const params = new URLSearchParams()
  for (const [key, entry] of Object.entries(value)) if (entry !== undefined && entry !== '') params.set(key, String(entry))
  return params.toString()
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function isBackendErrorDto(value: unknown): value is BackendErrorDto {
  if (!value || typeof value !== 'object' || !('error' in value)) return false
  const error = value.error
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      'message' in error &&
      typeof error.message === 'string',
  )
}
