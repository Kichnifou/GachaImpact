import { useState } from 'react'

type GameAssetIconProps = {
  src: string
  fallback: string
  className: string
  title?: string
}

function GameAssetIcon({ src, fallback, className, title }: GameAssetIconProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const hasError = failedSource === src

  return (
    <span className={className} title={title} aria-hidden="true">
      {hasError ? fallback : <img src={src} alt="" onError={() => setFailedSource(src)} />}
    </span>
  )
}

export default GameAssetIcon
