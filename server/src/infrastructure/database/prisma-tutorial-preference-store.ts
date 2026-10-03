import { Prisma, type PrismaClient } from '../../../generated/prisma/client.js'
import { autostartPreference, tutorialAutostartKey, tutorialPreferenceKey, type TutorialPreferenceDto, type TutorialPreferenceStore, type TutorialAutostartDto } from '../../application/tutorial/tutorial-preferences.js'

export class PrismaTutorialPreferenceStore implements TutorialPreferenceStore {
  constructor(private readonly database: PrismaClient) {}
  async claimAutostart(playerId: string): Promise<TutorialAutostartDto> {
    return this.database.$transaction(async tx => {
      // ON CONFLICT waits for a concurrent claim; only the inserting transaction launches.
      const inserted = await tx.playerPreference.createMany({ data: [{ playerId, preferenceKey: tutorialAutostartKey, value: { version: 1, claimed: true } }], skipDuplicates: true })
      if (!inserted.count) return { shouldLaunch: false }
      const saved = await tx.playerPreference.findUnique({ where: { playerId_preferenceKey: { playerId, preferenceKey: tutorialPreferenceKey } }, select: { value: true } })
      const preference = autostartPreference(saved?.value)
      const value = preference as unknown as Prisma.InputJsonValue
      await tx.playerPreference.upsert({ where: { playerId_preferenceKey: { playerId, preferenceKey: tutorialPreferenceKey } }, create: { playerId, preferenceKey: tutorialPreferenceKey, value }, update: { value } })
      return { shouldLaunch: true, preference }
    })
  }
  async read(playerId: string) {
    return (await this.database.playerPreference.findUnique({ where: { playerId_preferenceKey: { playerId, preferenceKey: tutorialPreferenceKey } }, select: { value: true } }))?.value ?? null
  }
  async write(playerId: string, value: TutorialPreferenceDto) {
    const stored = value as unknown as Prisma.InputJsonValue
    await this.database.playerPreference.upsert({ where: { playerId_preferenceKey: { playerId, preferenceKey: tutorialPreferenceKey } }, create: { playerId, preferenceKey: tutorialPreferenceKey, value: stored }, update: { value: stored } })
  }
}
