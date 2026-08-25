import { useState } from 'react'
import BannerHero from '../components/BannerHero'
import GameAssetIcon from '../components/GameAssetIcon'
import ScreenHeader from '../components/ScreenHeader'
import { currencyAssetPaths } from '../utils/gameAssets'

function InvocationScreen() {
  const [bannerType, setBannerType] = useState<'permanent' | 'temporary'>('permanent')

  return (
    <div className="screen-content invocation-screen">
      <ScreenHeader
        eyebrow="Portail des vœux"
        title="Invocation"
        description="Parcourez les bannières disponibles et consultez leur progression fictive."
        meta="15 vœux possibles"
      />

      <div className="banner-tabs panel" role="tablist" aria-label="Types de bannière">
        <button
          type="button"
          className={bannerType === 'permanent' ? 'active' : ''}
          onClick={() => setBannerType('permanent')}
          role="tab"
          aria-selected={bannerType === 'permanent'}
        >
          <span aria-hidden="true">✦</span>
          <strong>Permanente</strong>
          <small>Éclat des astres</small>
        </button>
        <button
          type="button"
          className={bannerType === 'temporary' ? 'active temporary' : 'temporary'}
          onClick={() => setBannerType('temporary')}
          role="tab"
          aria-selected={bannerType === 'temporary'}
        >
          <span aria-hidden="true">⌛</span>
          <strong>Temporaire</strong>
          <small>Bientôt disponible</small>
        </button>
        <button type="button" className="future-banner" disabled>
          <span aria-hidden="true">＋</span>
          <strong>Emplacement futur</strong>
          <small>Autres bannières temporaires</small>
        </button>
      </div>

      {bannerType === 'permanent' ? (
        <BannerHero showDetails />
      ) : (
        <section className="temporary-banner-placeholder panel">
          <div className="temporary-symbol" aria-hidden="true">⌛</div>
          <span className="eyebrow">Bannière temporaire</span>
          <h2>Le prochain chapitre approche</h2>
          <p>Cet emplacement pourra accueillir plusieurs bannières limitées lors d’une future étape.</p>
          <div className="placeholder-banner-slots">
            <span>Personnage vedette</span><span>Durée</span><span>Progression dédiée</span>
          </div>
        </section>
      )}

      <section className="invocation-info-grid">
        <article className="panel info-card"><span>✦</span><div><strong>Capture de brillance</strong><p>Inactive · information visuelle fictive</p></div></article>
        <article className="panel info-card"><GameAssetIcon className="info-currency-icon" src={currencyAssetPaths.primogem} fallback="◈" /><div><strong>Coût d’une invocation</strong><p>160 primogemmes ou 1 vœu astral</p></div></article>
        <article className="panel info-card"><span>★</span><div><strong>Garantie actuelle</strong><p>Le prochain 5★ n’est pas garanti</p></div></article>
      </section>
    </div>
  )
}

export default InvocationScreen
