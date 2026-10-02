import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js'
import { tutorialPreferenceKey, type TutorialPreferenceDto, type TutorialPreferenceStore } from '../../application/tutorial/tutorial-preferences.js'

export class PrismaTutorialPreferenceStore implements TutorialPreferenceStore {
  constructor(private readonly database: PrismaClient) {}
  async read(playerId: string) {
    return (await this.database.playerPreference.findUnique({ where: { playerId_preferenceKey: { playerId, preferenceKey: tutorialPreferenceKey } }, select: { value: true } }))?.value ?? null
  }
  async write(playerId: string, value: TutorialPreferenceDto) {
    const stored = value as unknown as Prisma.InputJsonValue
    await this.database.playerPreference.upsert({ where: { playerId_preferenceKey: { playerId, preferenceKey: tutorialPreferenceKey } }, create: { playerId, preferenceKey: tutorialPreferenceKey, value: stored }, update: { value: stored } })
  }
}
