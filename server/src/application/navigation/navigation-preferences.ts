import type { AuthenticatedIdentity } from '../../domain/identity/authenticated-identity.js'
import type { GetCurrentPlayer } from '../player/get-current-player.js'

export const navigationMenuPreferenceKey = 'navigation_menu_v1'
export const navigationMenuDestinationIds = ['home', 'invocation', 'box', 'team', 'catalog', 'dailies', 'missions', 'combat', 'event', 'contest', 'inventory', 'shop', 'bank', 'history', 'tutorial', 'configuration'] as const
export type NavigationMenuDestinationId = (typeof navigationMenuDestinationIds)[number]
export type NavigationMenuPreferenceDto = Readonly<{ version: 1; order: readonly NavigationMenuDestinationId[]; hidden: readonly NavigationMenuDestinationId[] }>

export interface NavigationPreferenceStore {
  read(playerId: string): Promise<unknown | null>
  write(playerId: string, value: NavigationMenuPreferenceDto): Promise<void>
}

export function mergeNavigationMenuPreference(value: unknown): NavigationMenuPreferenceDto {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  const known = new Set<string>(navigationMenuDestinationIds)
  const savedOrder = Array.isArray(record?.order) ? record.order.filter((id): id is NavigationMenuDestinationId => typeof id === 'string' && known.has(id)) : []
  const order = [...new Set(savedOrder)]
  for (const id of navigationMenuDestinationIds) if (!order.includes(id)) order.push(id)
  const savedHidden = Array.isArray(record?.hidden) ? record.hidden.filter((id): id is NavigationMenuDestinationId => typeof id === 'string' && known.has(id) && id !== 'configuration') : []
  return { version: 1, order, hidden: [...new Set(savedHidden)] }
}

export class NavigationPreferencesService {
  public constructor(private readonly getCurrentPlayer: GetCurrentPlayer, private readonly store: NavigationPreferenceStore) {}
  public async get(identity: AuthenticatedIdentity) { const player = await this.getCurrentPlayer.execute(identity); return mergeNavigationMenuPreference(await this.store.read(player.id)) }
  public async put(identity: AuthenticatedIdentity, value: unknown) { const player = await this.getCurrentPlayer.execute(identity); const preference = mergeNavigationMenuPreference(value); await this.store.write(player.id, preference); return preference }
}
