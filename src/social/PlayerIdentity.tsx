import AppButton from '../components/AppButton'
import { elementLabels } from '../utils/formatters'
import type { SocialIdentity } from './types'

export default function PlayerIdentity({ player, onOpen, status }: { player: SocialIdentity; onOpen: () => void; status?: string }) {
  return <AppButton className="social-player-identity" onClick={onOpen} aria-label={`Ouvrir le profil de ${player.displayName}`}>
    <span className={`mini-avatar ${player.elementKey ?? ''}`} aria-hidden="true">{player.displayName.slice(0, 1).toUpperCase()}</span>
    <span><strong>{player.displayName}</strong><small>Niveau {player.level} · {player.elementKey ? elementLabels[player.elementKey] : 'Élément non choisi'}</small></span>
    {status && <small>{status}</small>}
  </AppButton>
}
