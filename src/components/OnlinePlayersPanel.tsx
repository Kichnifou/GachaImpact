import type { ConnectedPlayers } from '../social/types'
import { presenceLabels } from '../social/types'
import PlayerIdentity from '../social/PlayerIdentity'
import AppButton from './AppButton'
import ModalCloseButton from './ModalCloseButton'
import { useModalDialog } from './useModalDialog'
import type { FriendshipController } from '../social/use-friendships'
import { relationshipContext } from '../social/relationship'

export default function OnlinePlayersPanel({ value, error, ownerPlayerId, controller, onClose, onProfile, onDirectory }: { value: ConnectedPlayers | null; error: boolean; ownerPlayerId: string; controller: FriendshipController; onClose: () => void; onProfile: (id: string) => void; onDirectory: () => void }) {
  const ref = useModalDialog<HTMLElement>(onClose)
  const action = (playerId: string) => {
    const relation = relationshipContext(controller.value, ownerPlayerId, playerId)
    if (relation.state === 'NONE') return <AppButton disabled={controller.pending} onClick={() => void controller.mutate(playerId, 'ADD', undefined, 'connected')}>Ajouter</AppButton>
    if (relation.state === 'RECEIVED') return <AppButton disabled={controller.pending} onClick={() => void controller.mutate(playerId, 'ACCEPT', relation.requestId, 'connected')}>Accepter</AppButton>
    return <AppButton disabled>{relation.state === 'SELF' ? 'Toi' : relation.state === 'SENT' ? 'Envoyée' : 'Ami'}</AppButton>
  }
  return <div className="modal-layer" onMouseDown={onClose}><section ref={ref} tabIndex={-1} className="floating-panel players-panel" role="dialog" aria-modal="true" aria-labelledby="players-title" onMouseDown={e => e.stopPropagation()}>
    <header className="floating-panel-heading"><div><span className="eyebrow">Communauté</span><h2 id="players-title">Joueurs connectés</h2></div><ModalCloseButton onClose={onClose} /></header>
    <div className="players-summary">{value ? `${value.total} joueur${value.total > 1 ? 's' : ''} connecté${value.total > 1 ? 's' : ''}` : error ? 'Présence indisponible.' : 'Chargement…'}</div>
    <div className="social-feedback" role="status">{controller.feedbackScope === 'connected' ? controller.feedback : ''}</div>
    <div className="online-player-list">{value?.players.map(player => <div className="online-player-row" key={player.id}><PlayerIdentity player={player} onOpen={() => onProfile(player.id)} status={presenceLabels[player.status]} /><div className="online-player-action">{action(player.id)}</div></div>)}{value?.total === 0 && <p>Aucun joueur connecté visible.</p>}</div>
    <AppButton className="players-directory-button" onClick={onDirectory}>Voir tous les joueurs →</AppButton>
  </section></div>
}
