import type { CSSProperties, ReactNode } from 'react'
import { getElementAssetPath } from '../utils/gameAssets'
import CharacterAssetImage from './CharacterAssetImage'
import GameAssetIcon from './GameAssetIcon'

type ShowcaseVariant = 'team' | 'sidebar' | 'gacha'

type CharacterShowcaseCardProps = {
  variant: ShowcaseVariant
  name: string
  rarity: number
  element: string
  tone: string
  assetPaths?: readonly (string | null)[]
  fallback: ReactNode
  slot?: string
  level?: number
  levelLabel?: 'Niveau' | 'Niv.'
  constellation?: number
  style?: CSSProperties
  disabled?: boolean
  onClick?: () => void
  children?: ReactNode
}

const variantClasses = {
  team: {
    root: 'large-team-card',
    badge: 'large-element',
    portrait: 'large-character-portrait',
    image: 'large-character-asset-image',
    copy: 'large-team-copy',
  },
  sidebar: {
    root: 'team-member',
    badge: 'member-element',
    portrait: 'member-portrait',
    image: 'member-asset-image',
    copy: 'team-member-copy',
  },
  gacha: {
    root: 'large-team-card target-choice',
    badge: 'large-element',
    portrait: 'large-character-portrait',
    image: 'large-character-asset-image',
    copy: 'large-team-copy',
  },
} satisfies Record<ShowcaseVariant, Record<string, string>>

function CharacterShowcaseCard({
  variant,
  name,
  rarity,
  element,
  tone,
  assetPaths,
  fallback,
  slot,
  level,
  levelLabel = 'Niv.',
  constellation,
  style,
  disabled,
  onClick,
  children,
}: CharacterShowcaseCardProps) {
  const classes = variantClasses[variant]
  const content = <>
    {slot && <span className="team-slot-number">{slot}</span>}
    <GameAssetIcon
      className={`${classes.badge} character-element-badge`}
      src={getElementAssetPath(element, 'badge')}
      fallback=""
    />
    <span className={`${classes.portrait} character-display-portrait`} aria-hidden="true">
      <CharacterAssetImage
        characterName={name}
        className={classes.image}
        assetPaths={assetPaths}
        fallback={fallback}
        alt=""
      />
    </span>
    <span className={`${classes.copy} character-display-copy`}>
      <strong className="character-showcase-name">{name}</strong>
      <span className="character-rarity">{'★'.repeat(rarity)}</span>
      {level !== undefined && constellation !== undefined && (
        <span className="character-display-meta character-showcase-meta">
          <span>{levelLabel} {level}</span>
          <span>C{constellation}</span>
        </span>
      )}
    </span>
    {children}
  </>
  const className = `${classes.root} character-display-card character-showcase-card character-showcase-${variant} ${tone}`

  return onClick
    ? <button type="button" className={className} style={style} disabled={disabled} onClick={onClick}>{content}</button>
    : <article className={className} style={style}>{content}</article>
}

export default CharacterShowcaseCard
