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
    getProgression: () => request<PlayerProgressionDto>('/api/v1/me/progression'),
    getWheelToday: () => request<WheelTodayDto>('/api/v1/wheel/today'),
    spinWheel: () => request<WheelSpinDto>('/api/v1/wheel/spin', { method: 'POST' }),
    getDailyRewardToday: () => request<DailyRewardTodayDto>('/api/v1/daily-reward/today'),
    claimDailyReward: () => request<DailyRewardClaimDto>('/api/v1/daily-reward/claim', { method: 'POST' }),
    getCharacters: () => request<CharacterCatalogDto>('/api/v1/characters'),
    getCurrentGacha: () => request<CurrentGachaDto>('/api/v1/gacha/current'),
    setGachaTarget: (characterId: string) => request<{ playerState: PlayerGachaStateDto }>('/api/v1/gacha/target', { method: 'POST', body: JSON.stringify({ characterId }) }),
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
