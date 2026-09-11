import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js'
import { navigationMenuPreferenceKey, type NavigationMenuPreferenceDto, type NavigationPreferenceStore } from '../../application/navigation/navigation-preferences.js'

export class PrismaNavigationPreferenceStore implements NavigationPreferenceStore {
  public constructor(private readonly database: PrismaClient) {}
  public async read(playerId: string) { return (await this.database.playerPreference.findUnique({ where: { playerId_preferenceKey: { playerId, preferenceKey: navigationMenuPreferenceKey } }, select: { value: true } }))?.value ?? null }
  public async write(playerId: string, value: NavigationMenuPreferenceDto) { const stored = value as unknown as Prisma.InputJsonValue; await this.database.playerPreference.upsert({ where: { playerId_preferenceKey: { playerId, preferenceKey: navigationMenuPreferenceKey } }, create: { playerId, preferenceKey: navigationMenuPreferenceKey, value: stored }, update: { value: stored } }) }
}
