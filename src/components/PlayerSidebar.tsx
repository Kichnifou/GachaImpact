import type { CSSProperties } from 'react'
import type { CurrentGachaDto, DailyRewardClaimDto, DailyRewardTodayDto, PlayerDto, PlayerProgressionDto, PlayerResourcesDto, PlayerTeamsDto } from '../api/types'
import { getProgressionPercent } from '../progression/presentation'
import type { ScreenId } from '../types'
import { currencyAssetPaths, getElementAssetPath } from '../utils/gameAssets'
import { elementLabels, formatResourceAmount } from '../utils/formatters'
import CharacterAssetImage from './CharacterAssetImage'
import CharacterShowcaseCard from './CharacterShowcaseCard'
import GameAssetIcon from './GameAssetIcon'
import DailyRewardCard from './DailyRewardCard'
import { elementThemes } from '../utils/elementTheme'

type PlayerSidebarProps = {
  isOpen: boolean
  onClose: () => void
  onNavigate: (screen: ScreenId) => void
  playerData: PlayerDto
  resources: PlayerResourcesDto
  progression: PlayerProgressionDto
  levelUpDelta?: number | null
  profileLevelUpActive?: boolean
  dailyRewardToday: DailyRewardTodayDto
  onClaimDailyReward: () => Promise<DailyRewardClaimDto>
  gacha: CurrentGachaDto
  teams: PlayerTeamsDto
}

const particleElements = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'] as const

function PlayerSidebar({ isOpen, onClose, onNavigate, playerData, resources, progression, levelUpDelta = null, profileLevelUpActive = false, dailyRewardToday, onClaimDailyReward, gacha, teams }: PlayerSidebarProps) {
  const featuredCharacter = gacha.banner.featuredFiveStars.find(({ id }) => id === gacha.playerState.selectedBannerCharacterId)
  const progressionPercent = getProgressionPercent(progression)
  const elementTheme = playerData.elementKey ? elementThemes[playerData.elementKey] : null
  const profileStyle = elementTheme ? {
    '--profile-element': elementTheme.color,
    '--profile-tint-strength': elementTheme.surfaceTintStrength,
    '--profile-watermark-opacity': elementTheme.watermarkOpacity,
    '--profile-watermark-brightness': elementTheme.watermarkBrightness,
  } as CSSProperties : undefined
  const objectiveTheme = featuredCharacter ? elementThemes[featuredCharacter.elementKey] : null
  const objectiveStyle = objectiveTheme ? {
    '--objective-element': objectiveTheme.color,
    '--objective-tint-strength': objectiveTheme.surfaceTintStrength,
    '--objective-watermark-opacity': objectiveTheme.watermarkOpacity,
    '--objective-watermark-brightness': objectiveTheme.watermarkBrightness,
  } as CSSProperties : undefined
  const activeTeam = teams.teams.find(({ active }) => active) ?? teams.teams[0]
  const activeMembers = activeTeam?.slots.filter(({ character }) => character !== null).length ?? 0

  return (
    <aside className={`player-sidebar${isOpen ? ' mobile-open' : ''}`} aria-label="Informations du joueur">
      <div className="mobile-sidebar-heading">
        <strong>Profil du joueur</strong>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button>
      </div>

      <div className="player-priority">
        <section className={`panel profile-card${profileLevelUpActive ? ' level-up-active' : ''}`} style={profileStyle}>
          {playerData.elementKey && <GameAssetIcon className="profile-element-watermark" src={getElementAssetPath(playerData.elementKey)} fallback="" />}
          <div className="avatar-placeholder" aria-label={`Avatar de ${playerData.displayName}`}>
            <span>{playerData.displayName.slice(0, 1).toUpperCase()}</span>
          </div>
          <div className="profile-copy">
            <h2>{playerData.displayName}</h2>
            <div className="level-line">
              <span>Niveau {progression.level}{levelUpDelta ? <em className="level-up-delta">+{levelUpDelta}</em> : null}</span>
              <small>{formatResourceAmount(progression.xpIntoCurrentStep)} / {formatResourceAmount(progression.xpPerStep)} XP</small>
            </div>
            <div className="progress-track" aria-label={`Progression d’expérience : ${progressionPercent.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`}>
              <span className="progress-fill" style={{ width: `${progressionPercent}%` }} />
            </div>
          </div>
        </section>

        <section className="panel resource-card currency-summary-card">
          <button type="button" className="section-heading section-link" onClick={() => onNavigate('inventory')}>
            <span>Ressources principales</span>
          </button>
          <div className="resource-grid">
            <div className="resource-item">
              <GameAssetIcon className="resource-icon cyan" src={currencyAssetPaths.primogem} fallback="✦" />
              <div><strong>{formatResourceAmount(resources.primogems)}</strong><small>Primos</small></div>
            </div>
            <button type="button" className="resource-item resource-item-action" onClick={() => onNavigate('bank')} aria-label={`Ouvrir la Banque, ${formatResourceAmount(resources.moras)} Moras`}>
              <GameAssetIcon className="resource-icon gold" src={currencyAssetPaths.mora} fallback="●" />
              <div><strong>{formatResourceAmount(resources.moras)}</strong><small>Moras</small></div>
            </button>
          </div>
        </section>
      </div>

      <div className="player-secondary">
        <section className="panel resource-card particles-card">
          <button type="button" className="section-heading section-link" onClick={() => onNavigate('inventory')}>
            <span>Particules</span>
          </button>
          <div className="particles-grid">
            {particleElements.map((elementKey) => (
              <div className={`particle-value ${elementKey}${playerData.elementKey === elementKey ? ' personal' : ''}`} key={elementKey} title={`${elementLabels[elementKey]}${playerData.elementKey === elementKey ? ' — élément personnel' : ''}`}>
                <GameAssetIcon className="particle-element-icon" src={getElementAssetPath(elementLabels[elementKey])} fallback="✦" />
                <strong>{formatResourceAmount(resources.particles[elementKey])}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel team-card team-card-navigable">
        <button type="button" className="team-card-navigation" onClick={() => onNavigate('team')} aria-label={`Ouvrir l’Équipe active${activeTeam ? `, Team ${activeTeam.position}` : ''}`} />
        <div className="section-heading">
          <span>Équipe active</span><small>{activeTeam ? `Team ${activeTeam.position}${activeTeam.name ? ` · ${activeTeam.name}` : ''} · ` : ''}{activeMembers} / 4</small>
        </div>
        <div className="team-grid">
          {(activeTeam?.slots ?? []).map(({ position, character }) => character ? (
              <CharacterShowcaseCard
                variant="sidebar"
                name={character.name}
                rarity={character.rarity}
                element={character.elementKey}
                tone={character.elementKey}
                assetPaths={[character.iconPath, character.fullbodyPath, character.wishPath, character.splashPath]}
                fallback={<span>{character.name.slice(0, 1)}</span>}
                constellation={character.constellation}
                key={position}
              />
            ) : <article className="team-member empty-sidebar-team-slot" aria-label={`Emplacement ${position} vide`} key={position}><span aria-hidden="true">＋</span><small>Vide</small></article>)}
        </div>
        </section>

        <section className="panel objective-card" style={objectiveStyle}>
        {featuredCharacter && <GameAssetIcon className="objective-element-watermark" src={getElementAssetPath(featuredCharacter.elementKey)} fallback="" />}
        <button type="button" className="section-heading section-link" onClick={() => onNavigate('invocation')}>
          <span>Objectif actuel</span>
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
      </div>
    </aside>
  )
}

export default PlayerSidebar
