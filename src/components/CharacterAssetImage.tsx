import { useState, type ReactNode } from 'react'
import { DEFAULT_CHARACTER_ASSET_ORDER, useCharacterAssetPaths, type CharacterAssetKind } from '../utils/gameAssets'

type CharacterAssetImageProps = {
  characterName: string
  className: string
  fallback: ReactNode
  order?: readonly CharacterAssetKind[]
  alt?: string
  assetPaths?: readonly (string | null)[]
}

function CharacterAssetImage({
  characterName,
  className,
  fallback,
  order = DEFAULT_CHARACTER_ASSET_ORDER,
  alt = '',
  assetPaths: providedAssetPaths,
}: CharacterAssetImageProps) {
  const discoveredAssetPaths = useCharacterAssetPaths(characterName, order)
  const assetPaths = providedAssetPaths?.filter((path): path is string => Boolean(path)) ?? discoveredAssetPaths
  const assetKey = `${characterName}|${assetPaths.join('|')}`
  const [assetState, setAssetState] = useState({ key: assetKey, index: 0, isLoaded: false })
  const currentState = assetState.key === assetKey
    ? assetState
    : { key: assetKey, index: 0, isLoaded: false }
  const assetPath = assetPaths[currentState.index]

  return (
    <>
      {!currentState.isLoaded && fallback}
      {assetPath && (
        <img
          className={className}
          src={assetPath}
          alt={alt}
          onLoad={() => setAssetState({ ...currentState, isLoaded: true })}
          onError={() => {
            setAssetState({ key: assetKey, index: currentState.index + 1, isLoaded: false })
          }}
        />
      )}
    </>
  )
}

export default CharacterAssetImage
