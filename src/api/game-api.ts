import { loadFrontendConfig } from '../config/environment'
import { getSupabaseClient } from '../infrastructure/supabase/client'
import type {
  BackendErrorDto,
  ElementChoiceDto,
  ElementKey,
  PlayerDto,
  PlayerResourcesDto,
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
  PlayerInventoryDto,
  ModerationPlayerListQuery,
  ModerationPlayerPageDto,
  ModerationPermissionsDto,
  ModerationStateDto,
  NavigationMenuPreferenceDto,
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
    getCurrentPlayer: () => request<PlayerDto>('/api/v1/me'),
    getPermissions: () => request<ModerationPermissionsDto>('/api/v1/me/permissions'),
    getNavigationPreferences: () => request<NavigationMenuPreferenceDto>('/api/v1/me/navigation-preferences'),
    putNavigationPreferences: (value: NavigationMenuPreferenceDto) => request<NavigationMenuPreferenceDto>('/api/v1/me/navigation-preferences', { method: 'PUT', body: JSON.stringify(value) }),
    getModerationState: () => request<ModerationStateDto>('/api/v1/moderation/me'),
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
    getInventory: () => request<PlayerInventoryDto>('/api/v1/me/inventory'),
    getBank: () => request<PlayerBankDto>('/api/v1/me/bank'),
    getBankHistory: (page: number) => request<BankHistoryDto>(`/api/v1/me/bank/history?page=${page}`),
    depositBank: (amount: string, idempotencyKey: string) => request<BankTransferDto>('/api/v1/me/bank/deposit', {
      method: 'POST', body: JSON.stringify({ amount, idempotencyKey }),
    }),
    withdrawBank: (amount: string, idempotencyKey: string) => request<BankTransferDto>('/api/v1/me/bank/withdraw', {
      method: 'POST', body: JSON.stringify({ amount, idempotencyKey }),
    }),
    getShop: () => request<PlayerShopDto>('/api/v1/me/shop'),
    purchaseShopItem: (itemId: string, quantity: string, idempotencyKey: string) => request<ShopPurchaseDto>(`/api/v1/me/shop/${encodeURIComponent(itemId)}/purchase`, {
      method: 'POST', body: JSON.stringify({ quantity, idempotencyKey }),
    }),
    getProgression: () => request<PlayerProgressionDto>('/api/v1/me/progression'),
    getWheelToday: () => request<WheelTodayDto>('/api/v1/wheel/today'),
    spinWheel: () => request<WheelSpinDto>('/api/v1/wheel/spin', { method: 'POST' }),
    getDailyRewardToday: () => request<DailyRewardTodayDto>('/api/v1/daily-reward/today'),
    claimDailyReward: () => request<DailyRewardClaimDto>('/api/v1/daily-reward/claim', { method: 'POST' }),
    getCharacters: () => request<CharacterCatalogDto>('/api/v1/characters'),
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
