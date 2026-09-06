import type { ReactNode } from 'react'
import type { CharacterAssetKind } from '../utils/gameAssets'
import { getElementAssetPath } from '../utils/gameAssets'
import CharacterAssetImage from './CharacterAssetImage'
import GameAssetIcon from './GameAssetIcon'

type CharacterPortraitFrameProps = {
  characterName: string
  element: string
  assetPaths?: readonly (string | null)[]
  order?: readonly CharacterAssetKind[]
  fallback: ReactNode
  frameClassName: string
  imageClassName: string
  badgeClassName: string
  badgeContainerClassName?: string
  alt?: string
}

function CharacterPortraitFrame({
  characterName,
  element,
  assetPaths,
  order,
  fallback,
  frameClassName,
  imageClassName,
  badgeClassName,
  badgeContainerClassName,
  alt = '',
}: CharacterPortraitFrameProps) {
  const badge = <GameAssetIcon
      className={`${badgeClassName} character-portrait-badge`}
      src={getElementAssetPath(element, 'badge')}
      fallback=""
    />

  return <>
    {badgeContainerClassName ? <span className={badgeContainerClassName}>{badge}</span> : badge}
    <span className={`${frameClassName} character-portrait-frame`} aria-hidden="true">
      <CharacterAssetImage
        characterName={characterName}
        className={`${imageClassName} character-portrait-image`}
        assetPaths={assetPaths}
        order={order}
        fallback={fallback}
        alt={alt}
      />
    </span>
  </>
}

export default CharacterPortraitFrame
