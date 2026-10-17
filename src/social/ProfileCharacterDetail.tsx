import BoxCharacterDetailModal from '../components/BoxCharacterDetailModal'
import type { BoxCharacterDto } from '../api/types'
import type { Profile } from './types'

/** Only already-authorized Profile data; never calls the private /me/box API. */
export default function ProfileCharacterDetail({ profile, characterId, onClose }: { profile: Profile; characterId: string; onClose: () => void }) {
  if (profile.box.access !== 'ALLOWED') return null
  const character = profile.box.data.find(row => row.id === characterId)
  if (!character) return null
  const legend = profile.statistics.access === 'ALLOWED' && profile.legends?.access === 'ALLOWED'
    ? profile.legends.data.legends.find(row => row.character.id === characterId) : undefined
  const value: BoxCharacterDto = { ...character, favorite: false, c6CompetitionStats: null, ...(legend ? { c6CompetitionStats: { ...legend.stats, max: 20 as const, titles: Object.entries(legend.themes).flatMap(([theme, value]) => value.title && value.titleRank >= 1 && value.titleRank <= 4 ? [{ theme: theme as keyof typeof legend.themes, rank: value.titleRank, title: value.title }] : []) } } : {}) }
  return <BoxCharacterDetailModal character={value} readOnly statisticsPrivate={profile.statistics.access === 'PRIVATE'} stellaQuantity="0" stellaRetryAvailable={false} favoritePending={false} stellaPending={false} stellaFeedback={null} onUseStella={() => undefined} onClose={onClose} />
}
