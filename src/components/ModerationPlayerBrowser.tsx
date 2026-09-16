import type { ModerationPlayerListQuery, ModerationPlayerPageDto } from '../api/types'
import PlayerSelectionBrowser from './PlayerSelectionBrowser'

type Props = {
  selectedPlayerId: string
  onListPlayers: (query: ModerationPlayerListQuery) => Promise<ModerationPlayerPageDto>
  onConfirm: (playerId: string) => void
  onClose: () => void
}

export default function ModerationPlayerBrowser({ selectedPlayerId, onListPlayers, onConfirm, onClose }: Props) {
  return <PlayerSelectionBrowser eyebrow="Modération" title="Choisir un joueur" selectedPlayerId={selectedPlayerId} onListPlayers={onListPlayers} onConfirm={(player) => onConfirm(player.id)} onClose={onClose} showTesterFilter renderBadge={(player) => player.tester && <span className="moderation-tester-badge">Testeur</span>} />
}
