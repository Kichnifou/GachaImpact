import type { ConnectedPlayers } from '../social/types'
import { presenceLabels } from '../social/types'
import PlayerIdentity from '../social/PlayerIdentity'
import AppButton from './AppButton'
import ModalCloseButton from './ModalCloseButton'
import { useModalDialog } from './useModalDialog'

export default function OnlinePlayersPanel({ value, error, onClose, onProfile, onDirectory }: { value: ConnectedPlayers | null; error: boolean; onClose: () => void; onProfile: (id: string) => void; onDirectory: () => void }) {
  const ref = useModalDialog<HTMLElement>(onClose)
  return <div className="modal-layer" onMouseDown={onClose}><section ref={ref} tabIndex={-1} className="floating-panel players-panel" role="dialog" aria-modal="true" aria-labelledby="players-title" onMouseDown={e => e.stopPropagation()}>
    <header className="floating-panel-heading"><div><span className="eyebrow">Communauté</span><h2 id="players-title">Joueurs connectés</h2></div><ModalCloseButton onClose={onClose} /></header>
    <div className="players-summary">{value ? `${value.total} joueur${value.total > 1 ? 's' : ''} connecté${value.total > 1 ? 's' : ''}` : error ? 'Présence indisponible.' : 'Chargement…'}</div>
    <div className="online-player-list">{value?.players.map(player => <PlayerIdentity key={player.id} player={player} onOpen={() => onProfile(player.id)} status={presenceLabels[player.status]} />)}{value?.total === 0 && <p>Aucun joueur connecté visible.</p>}</div>
    <AppButton onClick={onDirectory}>Voir tous les joueurs →</AppButton>
  </section></div>
}
