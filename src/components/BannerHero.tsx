import { useState } from 'react'
import type { CurrentGachaDto, GachaCharacterDto } from '../api/types'
import { currencyAssetPaths } from '../utils/gameAssets'
import CharacterAssetImage from './CharacterAssetImage'
import GameAssetIcon from './GameAssetIcon'

type Props = { gacha: CurrentGachaDto; compact?: boolean; showDetails?: boolean; onSetTarget: (id: string) => Promise<void> }

function BannerHero({ gacha, compact = false, showDetails = false, onSetTarget }: Props) {
  const [choosing, setChoosing] = useState(!gacha.playerState.selectedBannerCharacterId)
  const [pending, setPending] = useState<string | null>(null)
  const selected = gacha.banner.featuredFiveStars.find(({ id }) => id === gacha.playerState.selectedBannerCharacterId)
  const choose = async (character: GachaCharacterDto) => {
    setPending(character.id)
    try { await onSetTarget(character.id); setChoosing(false) } finally { setPending(null) }
  }

  if (choosing || !selected) {
    return <section className={`invocation-panel target-picker${compact ? ' home-banner' : ''}`} aria-labelledby="invocation-title">
      <div className="banner-content"><h1 id="invocation-title">Choisissez votre cible</h1><p>Définissez le personnage 5★ que vous visez pour cette rotation hebdomadaire.</p><span className="banner-period">Jusqu’au {new Date(gacha.banner.endsAt).toLocaleDateString('fr-FR')}</span></div>
      <div className="target-choice-grid">{gacha.banner.featuredFiveStars.map((character) => <button type="button" className={`target-choice ${character.elementKey}`} disabled={pending !== null} onClick={() => void choose(character)} key={character.id}><CharacterAssetImage characterName={character.name} className="target-choice-image" assetPaths={[character.iconPath, character.fullbodyPath]} fallback={character.name.slice(0, 1)} alt="" /><strong>{character.name}</strong><span>★★★★★</span></button>)}</div>
      <FeaturedFourStars characters={gacha.banner.featuredFourStars} />
    </section>
  }

  return <section className={`invocation-panel${compact ? ' home-banner' : ''}`} aria-labelledby="invocation-title">
    <div className="banner-glow banner-glow-one" /><div className="banner-glow banner-glow-two" />
    <div className="banner-content"><h1 id="invocation-title">{selected.name}</h1><p>Cible 5★ de la rotation hebdomadaire. Votre progression est conservée entre les rotations.</p><div className="banner-tags"><span>{selected.elementKey}</span><span>Fin le {new Date(gacha.banner.endsAt).toLocaleDateString('fr-FR')}</span></div>{showDetails && <div className="banner-secondary-actions"><button type="button" onClick={() => setChoosing(true)}>Changer</button></div>}</div>
    <div className="celestial-placeholder" aria-label={`Illustration de ${selected.name}`}><CharacterAssetImage characterName={selected.name} className="banner-character-asset" assetPaths={[selected.splashPath, selected.fullbodyPath, selected.wishPath, selected.iconPath]} fallback={<span className="celestial-star">✦</span>} alt={selected.name} /><div className="banner-featured-character"><strong>{selected.name}</strong><span>★★★★★</span></div></div>
    <div className="invocation-footer"><div className="pity-summary"><Progress label="Pity 5★" value={gacha.playerState.pity5} maximum={90} /><Progress label="Pity 4★" value={gacha.playerState.pity4} maximum={10} /><div className="banner-status"><span>Garantie 5★</span><strong>{gacha.playerState.guaranteedFeatured5 ? 'Oui' : 'Non'}</strong></div><div className="banner-status"><span>Capture</span><strong>{gacha.playerState.captureProgress} / 3</strong></div></div><div className="wish-actions" aria-label="Invocations indisponibles dans ce lot"><WishButton count="x1" cost="160" /><WishButton count="x10" cost="1 600" /></div></div>
    {!compact && <FeaturedFourStars characters={gacha.banner.featuredFourStars} />}
  </section>
}

function Progress({ label, value, maximum }: { label: string; value: number; maximum: number }) { return <div className="banner-progress"><div className="pity-row"><span>{label}</span><strong>{value} / {maximum}</strong></div><div className="progress-track"><span className="progress-fill pity" style={{ width: `${value / maximum * 100}%` }} /></div></div> }
function WishButton({ count, cost }: { count: string; cost: string }) { return <button type="button" className="wish-button secondary" disabled><span>Invocation {count}</span><small><GameAssetIcon className="inline-currency-icon" src={currencyAssetPaths.primogem} fallback="✦" /> × {cost}</small></button> }
function FeaturedFourStars({ characters }: { characters: readonly GachaCharacterDto[] }) { return <div className="featured-four-stars" aria-label="Personnages 4 étoiles de la semaine"><small>Personnages 4★</small><div>{characters.map((character) => <span key={character.id} title={character.name}><CharacterAssetImage characterName={character.name} className="featured-four-image" assetPaths={[character.iconPath, character.fullbodyPath]} fallback={character.name.slice(0, 1)} alt={character.name} /></span>)}</div></div> }
export default BannerHero
