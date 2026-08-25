const teamMembers = [
  { name: 'Lyra', element: '✦', tone: 'violet' },
  { name: 'Kael', element: '❄', tone: 'blue' },
  { name: 'Mira', element: '✿', tone: 'green' },
  { name: 'Soren', element: '♨', tone: 'gold' },
]

function PlayerSidebar() {
  return (
    <aside className="player-sidebar" aria-label="Informations du joueur">
      <section className="panel profile-card">
        <div className="avatar-placeholder" aria-label="Avatar fictif de Kichnifou">
          <span>K</span>
        </div>
        <div className="profile-copy">
          <span className="eyebrow">Voyageur</span>
          <h2>Kichnifou</h2>
          <div className="level-line">
            <span>Niveau 42</span>
            <small>1 260 / 1 260 XP</small>
          </div>
          <div className="progress-track" aria-label="Expérience : 1 260 sur 1 260">
            <span className="progress-fill full" />
          </div>
        </div>
      </section>

      <section className="panel resource-card">
        <div className="section-heading">
          <span>Ressources</span>
          <small>Mise à jour fictive</small>
        </div>
        <div className="resource-grid">
          <div className="resource-item">
            <span className="resource-icon cyan" aria-hidden="true">✦</span>
            <div><strong>2 480</strong><small>Primogemmes</small></div>
          </div>
          <div className="resource-item">
            <span className="resource-icon gold" aria-hidden="true">●</span>
            <div><strong>560 250</strong><small>Moras</small></div>
          </div>
          <div className="resource-item wide">
            <span className="resource-icon violet" aria-hidden="true">◈</span>
            <div><strong>15</strong><small>Vœux disponibles</small></div>
          </div>
        </div>
      </section>

      <section className="panel team-card">
        <div className="section-heading">
          <span>Équipe active</span>
          <small>4 / 4</small>
        </div>
        <div className="team-grid">
          {teamMembers.map((member) => (
            <div className={`team-member ${member.tone}`} key={member.name}>
              <span className="member-element" aria-hidden="true">{member.element}</span>
              <div className="member-portrait" aria-hidden="true">
                <span>{member.name.slice(0, 1)}</span>
              </div>
              <small>{member.name}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel objective-card">
        <div className="section-heading"><span>Objectif actuel</span></div>
        <div className="objective-content">
          <div className="objective-art" aria-hidden="true">✧</div>
          <div>
            <span className="stars">★★★★★</span>
            <h3>Éclat des astres</h3>
            <p>Bannière permanente</p>
            <div className="pity-row"><span>Progression</span><strong>42 / 90</strong></div>
            <div className="progress-track"><span className="progress-fill pity" /></div>
          </div>
        </div>
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
