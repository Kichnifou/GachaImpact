import { activeBanner } from '../data/mockData'
import { BANNER_CHARACTER_ASSET_ORDER, currencyAssetPaths } from '../utils/gameAssets'
import CharacterAssetImage from './CharacterAssetImage'
import GameAssetIcon from './GameAssetIcon'

type BannerHeroProps = {
  compact?: boolean
  showDetails?: boolean
}

function BannerHero({ compact = false, showDetails = false }: BannerHeroProps) {
  const { featuredCharacter, pityFiveStar, pityFourStar, guaranteeFiveStar, brilliance } = activeBanner

  return (
    <section className={`invocation-panel${compact ? ' home-banner' : ''}`} aria-labelledby="invocation-title">
      <div className="banner-glow banner-glow-one" />
      <div className="banner-glow banner-glow-two" />
      <div className="banner-content">
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

      <div className="celestial-placeholder" aria-label={`Illustration de ${featuredCharacter.name}`}>
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <CharacterAssetImage
          characterName={featuredCharacter.name}
          className="banner-character-asset"
          order={BANNER_CHARACTER_ASSET_ORDER}
          fallback={<span className="celestial-star">✦</span>}
          alt={featuredCharacter.name}
        />
        <div className="banner-featured-character">
          <strong>{featuredCharacter.name}</strong>
          <span aria-label={`${featuredCharacter.rarity} étoiles`}>{'★'.repeat(featuredCharacter.rarity)}</span>
        </div>
        <span className="spark spark-one">✧</span>
        <span className="spark spark-two">·</span>
        <span className="spark spark-three">✦</span>
      </div>

      <div className="invocation-footer">
        <div className="pity-summary">
          <div className="banner-progress">
            <div className="pity-row"><span>Pity 5★</span><strong>{pityFiveStar.current} / {pityFiveStar.maximum}</strong></div>
            <div className="progress-track"><span className="progress-fill pity" /></div>
          </div>
          <div className="banner-progress">
            <div className="pity-row"><span>Pity 4★</span><strong>{pityFourStar.current} / {pityFourStar.maximum}</strong></div>
            <div className="progress-track"><span className="progress-fill pity-four" /></div>
          </div>
          <div className="banner-status"><span>Garantie 5★</span><strong>{guaranteeFiveStar}</strong></div>
          <div className="banner-status"><span>Brillance</span><strong>{brilliance.current} / {brilliance.maximum}</strong></div>
        </div>
        <div className="wish-actions" aria-label="Actions d’invocation fictives">
          <button type="button" className="wish-button secondary"><span>Invocation x1</span><small><GameAssetIcon className="inline-currency-icon" src={currencyAssetPaths.primogem} fallback="✦" /> × 160</small></button>
          <button type="button" className="wish-button primary"><span>Invocation x10</span><small><GameAssetIcon className="inline-currency-icon" src={currencyAssetPaths.primogem} fallback="✦" /> × 1 600</small></button>
        </div>
      </div>
    </section>
  )
}

export default BannerHero
