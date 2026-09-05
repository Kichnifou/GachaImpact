import type { CSSProperties } from 'react'
import type { CurrentGachaDto, DailyRewardClaimDto, DailyRewardTodayDto, PlayerDto, PlayerProgressionDto, PlayerResourcesDto } from '../api/types'
import { activeTeam } from '../data/mockData'
import { getProgressionPercent } from '../progression/presentation'
import type { ScreenId } from '../types'
import { currencyAssetPaths, getElementAssetPath } from '../utils/gameAssets'
import { elementLabels, formatResourceAmount } from '../utils/formatters'
import CharacterAssetImage from './CharacterAssetImage'
import GameAssetIcon from './GameAssetIcon'
import DailyRewardCard from './DailyRewardCard'
import { elementColors } from '../utils/elementTheme'

type PlayerSidebarProps = {
  isOpen: boolean
  onClose: () => void
  onNavigate: (screen: ScreenId) => void
  playerData: PlayerDto
  resources: PlayerResourcesDto
  progression: PlayerProgressionDto
  dailyRewardToday: DailyRewardTodayDto
  onClaimDailyReward: () => Promise<DailyRewardClaimDto>
  gacha: CurrentGachaDto
}

const particleElements = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'] as const

function PlayerSidebar({ isOpen, onClose, onNavigate, playerData, resources, progression, dailyRewardToday, onClaimDailyReward, gacha }: PlayerSidebarProps) {
  const featuredCharacter = gacha.banner.featuredFiveStars.find(({ id }) => id === gacha.playerState.selectedBannerCharacterId)
  const progressionPercent = getProgressionPercent(progression)

  return (
    <aside className={`player-sidebar${isOpen ? ' mobile-open' : ''}`} aria-label="Informations du joueur">
      <div className="mobile-sidebar-heading">
        <strong>Profil du joueur</strong>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button>
      </div>

      <section className="panel profile-card" style={playerData.elementKey ? { '--profile-element': elementColors[playerData.elementKey] } as CSSProperties : undefined}>
        {playerData.elementKey && <GameAssetIcon className="profile-element-watermark" src={getElementAssetPath(playerData.elementKey)} fallback="" />}
        <div className="avatar-placeholder" aria-label={`Avatar de ${playerData.displayName}`}>
          <span>{playerData.displayName.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="profile-copy">
          <h2>{playerData.displayName}</h2>
          <div className="level-line">
            <span>Niveau {progression.level}</span>
            <small>{formatResourceAmount(progression.xpIntoCurrentStep)} / {formatResourceAmount(progression.xpPerStep)} XP</small>
          </div>
          <div className="progress-track" aria-label={`Progression d’expérience : ${progressionPercent.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`}>
            <span className="progress-fill" style={{ width: `${progressionPercent}%` }} />
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
            <div><strong>{formatResourceAmount(resources.primogems)}</strong><small>Primogemmes</small></div>
          </div>
          <div className="resource-item">
            <GameAssetIcon className="resource-icon gold" src={currencyAssetPaths.mora} fallback="●" />
            <div><strong>{formatResourceAmount(resources.moras)}</strong><small>Moras</small></div>
          </div>
        </div>

        <div className="particles-heading">Particules</div>
        <div className="particles-grid">
          {particleElements.map((elementKey) => (
            <div
              className={`particle-value ${elementKey}${playerData.elementKey === elementKey ? ' personal' : ''}`}
              key={elementKey}
              title={`${elementLabels[elementKey]}${playerData.elementKey === elementKey ? ' — élément personnel' : ''}`}
            >
              <GameAssetIcon
                className="particle-element-icon"
                src={getElementAssetPath(elementLabels[elementKey])}
                fallback="✦"
              />
              <strong>{formatResourceAmount(resources.particles[elementKey])}</strong>
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
        {featuredCharacter ? <div className="objective-content">
          <div className="objective-art" aria-label={`Portrait de ${featuredCharacter.name}`}>
            <CharacterAssetImage
              characterName={featuredCharacter.name}
              assetPaths={[featuredCharacter.iconPath, featuredCharacter.fullbodyPath]}
              className="objective-asset-image"
              fallback={featuredCharacter.name.slice(0, 1)}
              alt={featuredCharacter.name}
            />
          </div>
          <div>
            <div className="objective-name-line">
              <h3>{featuredCharacter.name}</h3>
              <span className="stars">★★★★★</span>
            </div>
            <p className="objective-guarantee">Garantie 5★ : {gacha.playerState.guaranteedFeatured5 ? 'Oui' : 'Non'}</p>
            <p className="objective-brilliance">Capture : <strong>{gacha.playerState.captureProgress} / 3</strong></p>
            <div className="pity-row"><span>Pity 5★</span><strong>{gacha.playerState.pity5} / 90</strong></div>
            <div className="progress-track"><span className="progress-fill pity" style={{ width: `${gacha.playerState.pity5 / 90 * 100}%` }} /></div>
            <div className="pity-row objective-secondary"><span>Pity 4★</span><strong>{gacha.playerState.pity4} / 10</strong></div>
            <div className="progress-track"><span className="progress-fill pity-four" style={{ width: `${gacha.playerState.pity4 / 10 * 100}%` }} /></div>
          </div>
        </div> : <button type="button" className="objective-empty" onClick={() => onNavigate('invocation')}><strong>Aucune cible sélectionnée</strong><span>Choisir parmi les quatre 5★ →</span></button>}
      </section>

      {playerData.elementKey && <DailyRewardCard today={dailyRewardToday} elementKey={playerData.elementKey} onClaim={onClaimDailyReward} />}
    </aside>
  )
}

export default PlayerSidebar
