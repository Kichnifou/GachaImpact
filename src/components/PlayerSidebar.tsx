import { activeTeam, particles, player } from '../data/mockData'
import type { ScreenId } from '../types'
import { currencyAssetPaths, getElementAssetPath } from '../utils/gameAssets'
import CharacterAssetImage from './CharacterAssetImage'
import GameAssetIcon from './GameAssetIcon'

type PlayerSidebarProps = {
  isOpen: boolean
  onClose: () => void
  onNavigate: (screen: ScreenId) => void
}

function PlayerSidebar({ isOpen, onClose, onNavigate }: PlayerSidebarProps) {
  return (
    <aside className={`player-sidebar${isOpen ? ' mobile-open' : ''}`} aria-label="Informations du joueur">
      <div className="mobile-sidebar-heading">
        <strong>Profil du joueur</strong>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button>
      </div>

      <section className="panel profile-card">
        <div className="avatar-placeholder" aria-label={`Avatar fictif de ${player.name}`}>
          <span>K</span>
        </div>
        <div className="profile-copy">
          <h2>{player.name}</h2>
          <div className="level-line">
            <span>Niveau {player.level}</span>
            <small>{player.currentXp.toLocaleString('fr-FR')} / {player.requiredXp.toLocaleString('fr-FR')} XP</small>
          </div>
          <div className="progress-track" aria-label="Expérience complète">
            <span className="progress-fill full" />
          </div>
        </div>
      </section>

      <section className="panel resource-card">
        <button type="button" className="section-heading section-link" onClick={() => onNavigate('inventory')}>
          <span>Ressources principales</span><span className="card-chevron" aria-hidden="true">›</span>
        </button>
        <div className="resource-grid">
          <div className="resource-item">
            <GameAssetIcon className="resource-icon cyan" src={currencyAssetPaths.primogem} fallback="✦" />
            <div><strong>{player.primogems.toLocaleString('fr-FR')}</strong><small>Primogemmes</small></div>
          </div>
          <div className="resource-item">
            <GameAssetIcon className="resource-icon gold" src={currencyAssetPaths.mora} fallback="●" />
            <div><strong>{player.moras.toLocaleString('fr-FR')}</strong><small>Moras</small></div>
          </div>
        </div>

        <div className="particles-heading">Particules</div>
        <div className="particles-grid">
          {particles.map((particle) => (
            <div className={`particle-value ${particle.tone}`} key={particle.label} title={particle.label}>
              <GameAssetIcon
                className="particle-element-icon"
                src={getElementAssetPath(particle.label)}
                fallback={particle.icon}
              />
              <strong>{particle.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="panel team-card">
        <button type="button" className="section-heading section-link" onClick={() => onNavigate('team')}>
          <span>Équipe active</span><span className="section-heading-trailing"><small>4 / 4</small><i className="card-chevron" aria-hidden="true">›</i></span>
        </button>
        <div className="team-grid">
          {activeTeam.map((member) => (
            <div className={`team-member ${member.tone}`} key={member.id}>
              <GameAssetIcon
                className="member-element"
                src={getElementAssetPath(member.element, 'badge')}
                fallback={member.elementIcon}
              />
              <div className="member-portrait" aria-hidden="true">
                <CharacterAssetImage
                  characterName={member.name}
                  className="member-asset-image"
                  fallback={<span>{member.name.slice(0, 1)}</span>}
                />
              </div>
              <small>{member.name}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel objective-card">
        <button type="button" className="section-heading section-link" onClick={() => onNavigate('invocation')}>
          <span>Objectif actuel</span><span className="card-chevron" aria-hidden="true">›</span>
        </button>
        <div className="objective-content">
          <div className="objective-art" aria-label={`Portrait de ${activeTeam[0].name}`}>
            <CharacterAssetImage
              characterName={activeTeam[0].name}
              className="objective-asset-image"
              fallback={activeTeam[0].name.slice(0, 1)}
              alt={activeTeam[0].name}
            />
          </div>
          <div>
            <div className="objective-name-line">
              <h3>{activeTeam[0].name}</h3>
              <span className="stars">★★★★★</span>
            </div>
            <p>Garantie 5★ : non garantie</p>
            <div className="pity-row"><span>Pity 5★</span><strong>42 / 90</strong></div>
            <div className="progress-track"><span className="progress-fill pity" /></div>
            <div className="pity-row objective-secondary"><span>Pity 4★</span><strong>7 / 10</strong></div>
            <div className="progress-track"><span className="progress-fill pity-four" /></div>
          </div>
        </div>
        <div className="brilliance-line"><span>Capture de brillance</span><strong>✦ Inactive</strong></div>
      </section>

      <section className="panel daily-card">
        <div className="daily-icon" aria-hidden="true">♢</div>
        <div>
          <span className="eyebrow">Récompense quotidienne</span>
          <p>Votre cadeau du jour est prêt.</p>
          <button type="button" className="small-primary-button">Récupérer</button>
        </div>
      </section>
    </aside>
  )
}

export default PlayerSidebar
