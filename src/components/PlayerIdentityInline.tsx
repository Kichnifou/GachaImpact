import PlayerAvatar from './PlayerAvatar'

export default function PlayerIdentityInline({ displayName, elementKey, avatarAssetPath, detail, className = '' }: {
  displayName: string
  elementKey: string | null
  avatarAssetPath?: string | null
  detail?: string
  className?: string
}) {
  return <span className={`player-identity-inline${className ? ` ${className}` : ''}`}><PlayerAvatar displayName={displayName} elementKey={elementKey} avatarAssetPath={avatarAssetPath} /><span className="moderation-player-identity"><strong>{displayName}</strong>{detail && <small>{detail}</small>}</span></span>
}
