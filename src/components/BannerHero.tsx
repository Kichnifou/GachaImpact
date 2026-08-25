type BannerHeroProps = {
  compact?: boolean
  showDetails?: boolean
}

function BannerHero({ compact = false, showDetails = false }: BannerHeroProps) {
  return (
    <section className={`invocation-panel${compact ? ' home-banner' : ''}`} aria-labelledby="invocation-title">
      <div className="banner-glow banner-glow-one" />
      <div className="banner-glow banner-glow-two" />
      <div className="banner-content">
        <span className="banner-kicker">Bannière permanente</span>
        <h1 id="invocation-title">Éclat des astres</h1>
        <p>Invoquez des compagnons venus d’horizons lointains et écrivez une nouvelle page de votre voyage.</p>
        <div className="banner-tags">
          <span>Personnage 5★ garanti à 90 vœux</span>
          <span>Disponible en permanence</span>
        </div>
        {showDetails && (
          <div className="banner-secondary-actions">
            <button type="button">Détails</button>
            <button type="button">Historique</button>
          </div>
        )}
      </div>

      <div className="celestial-placeholder" aria-label="Illustration temporaire de la bannière">
        <span className="featured-character-shadow">L</span>
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <span className="celestial-star">✦</span>
        <span className="spark spark-one">✧</span>
        <span className="spark spark-two">·</span>
        <span className="spark spark-three">✦</span>
      </div>

      <div className="invocation-footer">
        <div className="pity-summary">
          <div className="banner-progress">
            <div className="pity-row"><span>Pity 5★</span><strong>42 / 90</strong></div>
            <div className="progress-track"><span className="progress-fill pity" /></div>
          </div>
          <div className="banner-progress">
            <div className="pity-row"><span>Pity 4★</span><strong>7 / 10</strong></div>
            <div className="progress-track"><span className="progress-fill pity-four" /></div>
          </div>
          <div className="guarantee-summary"><strong>5★</strong><span>non garanti</span></div>
        </div>
        <div className="wish-actions" aria-label="Actions d’invocation fictives">
          <button type="button" className="wish-button secondary"><span>Invocation x1</span><small>✦ × 160</small></button>
          <button type="button" className="wish-button primary"><span>Invocation x10</span><small>✦ × 1 600</small></button>
        </div>
      </div>
    </section>
  )
}

export default BannerHero
