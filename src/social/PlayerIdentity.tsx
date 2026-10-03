import PresenceDot from '../components/PresenceDot'
import type { Access, PresenceStatus } from './types'
import AppButton from '../components/AppButton'
import { elementLabels } from '../utils/formatters'
import type { SocialIdentity } from './types'
import PlayerAvatar from '../components/PlayerAvatar'

export default function PlayerIdentity({ player, onOpen, status }: { player: SocialIdentity & { presence?: Access<PresenceStatus> }; onOpen: () => void; status?: string }) {
  return <AppButton className="social-player-identity" onClick={onOpen} aria-label={`Ouvrir le profil de ${player.displayName}`}>
    <PlayerAvatar {...player} />
    <span><strong>{player.displayName}<PresenceDot presence={player.presence} /></strong><small>Niveau {player.level} · {player.elementKey ? elementLabels[player.elementKey] : 'Élément non choisi'}</small></span>
    <small className="social-presence-label">{status ?? ''}</small>
  </AppButton>
}
