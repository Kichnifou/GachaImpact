import { onlinePlayers } from '../data/mockData'

type OnlinePlayersPanelProps = {
  onClose: () => void
}

function OnlinePlayersPanel({ onClose }: OnlinePlayersPanelProps) {
  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="floating-panel players-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="players-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="floating-panel-heading">
          <div>
            <span className="eyebrow">Communauté</span>
            <h2 id="players-title">Joueurs connectés</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button>
        </div>

        <div className="players-summary">
          <span className="status-dot" />
          28 joueurs en ligne · aperçu fictif
        </div>

        <div className="online-player-list">
          {onlinePlayers.map((onlinePlayer) => (
            <article className="online-player" key={onlinePlayer.name}>
              <div className={`mini-avatar ${onlinePlayer.tone}`} aria-hidden="true">
                {onlinePlayer.name.slice(0, 1)}
              </div>
              <div>
                <strong>{onlinePlayer.name}</strong>
                <small>Niveau {onlinePlayer.level} · {onlinePlayer.status}</small>
              </div>
              <button type="button" className="compact-button">
                {onlinePlayer.friend ? '✓ Ami' : '+ Ajouter'}
              </button>
            </article>
          ))}
        </div>

        <button type="button" className="panel-link-button">Accéder au futur espace social →</button>
      </section>
    </div>
  )
}

export default OnlinePlayersPanel
