const navigationItems = [
  { label: 'Invocation', icon: '✦', active: true },
  { label: 'Personnages', icon: '♙' },
  { label: 'Équipe', icon: '♟' },
  { label: 'Sac', icon: '◇' },
  { label: 'Missions', icon: '▤' },
  { label: 'Combat', icon: '⚔' },
  { label: 'Activités', icon: '⌁' },
  { label: 'Boutique', icon: '♢' },
]

function MainPanel() {
  return (
    <main className="main-panel" id="main-content">
      <nav className="game-navigation" aria-label="Navigation principale">
        {navigationItems.map((item) => (
          <button
            type="button"
            className={`navigation-tile${item.active ? ' active' : ''}`}
            aria-current={item.active ? 'page' : undefined}
            key={item.label}
          >
            <span aria-hidden="true">{item.icon}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </nav>

      <section className="invocation-panel" aria-labelledby="invocation-title">
        <div className="banner-glow banner-glow-one" />
        <div className="banner-glow banner-glow-two" />
        <div className="banner-content">
          <span className="banner-kicker">Bannière permanente</span>
          <h1 id="invocation-title">Éclat des astres</h1>
          <p>
            Invoquez des compagnons venus d'horizons lointains et écrivez une
            nouvelle page de votre voyage.
          </p>
          <div className="banner-tags">
            <span>Personnage 5★ garanti à 90 vœux</span>
            <span>Disponible en permanence</span>
          </div>
        </div>

        <div className="celestial-placeholder" aria-label="Illustration temporaire de la bannière">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="celestial-star">✦</span>
          <span className="spark spark-one">✧</span>
          <span className="spark spark-two">·</span>
          <span className="spark spark-three">✦</span>
        </div>

        <div className="invocation-footer">
          <div className="banner-progress">
            <div className="pity-row"><span>Progression fictive</span><strong>42 / 90</strong></div>
            <div className="progress-track"><span className="progress-fill pity" /></div>
          </div>
          <div className="wish-actions" aria-label="Actions d'invocation fictives">
            <button type="button" className="wish-button secondary">
              <span>Vœu x1</span><small>✦ × 1</small>
            </button>
            <button type="button" className="wish-button primary">
              <span>Vœu x10</span><small>✦ × 10</small>
            </button>
          </div>
        </div>
      </section>

      <section className="notice-panel">
        <span className="notice-icon" aria-hidden="true">⌁</span>
        <div>
          <strong>Un monde en construction</strong>
          <p>Cette interface présente uniquement le futur espace de jeu.</p>
        </div>
        <span className="notice-badge">Prototype</span>
      </section>
    </main>
  )
}

export default MainPanel
