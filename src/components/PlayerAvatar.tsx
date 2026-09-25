import { useState } from 'react'
import { getElementAssetPath } from '../utils/gameAssets'

const official = (path: string | null | undefined) => path && /^\/assets\/[A-Za-z0-9/_-]+\.(?:png|webp|svg)$/.test(path) ? path : null

export default function PlayerAvatar({ displayName, elementKey, avatarAssetPath, className = 'mini-avatar' }: { displayName: string; elementKey: string | null; avatarAssetPath?: string | null; className?: string }) {
  const [failed, setFailed] = useState<readonly string[]>([])
  const custom = official(avatarAssetPath)
  const element = elementKey && ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'].includes(elementKey) ? getElementAssetPath(elementKey, 'badge') : null
  const source = custom && !failed.includes(custom) ? custom : element && !failed.includes(element) ? element : null
  return <span className={`${className} player-avatar ${elementKey ?? ''}`} aria-hidden="true">{source ? <img src={source} alt="" onError={() => setFailed(previous => [...previous, source])} /> : Array.from(displayName.trim())[0]?.toLocaleUpperCase('fr-FR') ?? '✦'}</span>
}
