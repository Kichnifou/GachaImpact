import PresenceDot from '../components/PresenceDot'
import type { Access, PresenceStatus } from './types'
import AppButton from '../components/AppButton'
import { elementLabels } from '../utils/formatters'
import type { SocialIdentity } from './types'
import PlayerAvatar from '../components/PlayerAvatar'
import GameAssetIcon from '../components/GameAssetIcon'
import { getElementAssetPath } from '../utils/gameAssets'

export default function PlayerIdentity({ player, onOpen, status }: { player: SocialIdentity & { presence?: Access<PresenceStatus> }; onOpen: () => void; status?: string }) {
  return <AppButton className="social-player-identity" onClick={onOpen} aria-label={`Ouvrir le profil de ${player.displayName}`}>
    <PlayerAvatar {...player} />
    <span><strong><span className="social-player-name">{player.displayName}</span>{player.elementKey&&<span className="social-player-element" role="img" aria-label={elementLabels[player.elementKey]}><GameAssetIcon src={getElementAssetPath(player.elementKey)} fallback="✦" title={elementLabels[player.elementKey]}/></span>}<PresenceDot presence={player.presence} /></strong><small>Niveau {player.level}</small></span>
    <small className="social-presence-label">{status ?? ''}</small>
  </AppButton>
}
