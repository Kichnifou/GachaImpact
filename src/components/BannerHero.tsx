import { useReducer, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CurrentGachaDto, GachaCharacterDto, GachaHistoryDto, GachaPullDto } from '../api/types'
import { currencyAssetPaths, getElementAssetPath } from '../utils/gameAssets'
import { elementThemes } from '../utils/elementTheme'
import CharacterAssetImage from './CharacterAssetImage'
import CharacterShowcaseCard from './CharacterShowcaseCard'
import GameAssetIcon from './GameAssetIcon'
import GachaDetailModal from './GachaDetailModal'
import InvocationSequence from './InvocationSequence'
import { apiErrorMessage } from '../utils/formatters'
import { selectGachaPullIntent, settleGachaPullIntent, type GachaPullIntent } from '../gacha/perform-gacha-pull'
import { acquirePullLock, idleInvocationSequence, invocationSequenceReducer } from '../gacha/invocation-sequence'

type Props = {
  gacha: CurrentGachaDto
  compact?: boolean
  showDetails?: boolean
  onSetTarget: (id: string) => Promise<void>
  onOpen?: () => void
  onPull?: (count: 1 | 10, idempotencyKey: string) => Promise<GachaPullDto>
  onGetHistory?: (page: number) => Promise<GachaHistoryDto>
}

function BannerHero({ gacha, compact = false, showDetails = false, onSetTarget, onOpen, onPull, onGetHistory }: Props) {
  const [choosing, setChoosing] = useState(!gacha.playerState.selectedBannerCharacterId)
  const [pending, setPending] = useState<string | null>(null)
  const [sequence, dispatchSequence] = useReducer(invocationSequenceReducer, idleInvocationSequence)
  const [pullError, setPullError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const pullLocked = useRef(false)
  const retryIntent = useRef<GachaPullIntent | null>(null)
  const selected = gacha.banner.featuredFiveStars.find(({ id }) => id === gacha.playerState.selectedBannerCharacterId)
  const pullPending = sequence.phase === 'submitting' ? sequence.count : null

  const choose = async (character: GachaCharacterDto) => {
    setPending(character.id)
    try { await onSetTarget(character.id); setChoosing(false) } finally { setPending(null) }
  }
  const pull = async (count: 1 | 10) => {
    if (!onPull) return
    const selection = selectGachaPullIntent(retryIntent.current, count, () => crypto.randomUUID())
    if (selection.status === 'blocked') {
      setPullError(`Une Invocation x${selection.intent.count} précédente doit d’abord être confirmée. Réessayez x${selection.intent.count}.`)
      return
    }
    if (!acquirePullLock(pullLocked)) return
    const intent = selection.intent
    retryIntent.current = intent
    dispatchSequence({ type: 'submit', count, idempotencyKey: intent.key })
    setPullError(null)
    try {
      const result = await onPull(count, intent.key)
      dispatchSequence({ type: 'resolved', pull: result })
      retryIntent.current = settleGachaPullIntent(intent, { status: 'success' })
    } catch (error) {
      retryIntent.current = settleGachaPullIntent(intent, { status: 'failure', error })
      setPullError(apiErrorMessage(error))
      dispatchSequence({ type: 'failed' })
    } finally {
      pullLocked.current = false
    }
  }

  if (choosing || !selected) {
    return <section className={`invocation-panel target-picker${compact ? ' home-banner home-banner-preview' : ''}`} aria-labelledby="invocation-title">
      <div className="banner-copy-column">
        <div className="banner-content"><h1 id="invocation-title">Choisissez votre cible</h1><p>Définissez le personnage 5★ que vous visez pour cette rotation hebdomadaire.</p><span className="banner-period">Jusqu’au {new Date(gacha.banner.endsAt).toLocaleDateString('fr-FR')}</span></div>
      </div>
      <div className="target-choice-grid">{gacha.banner.featuredFiveStars.map((character) => <CharacterShowcaseCard variant="gacha" name={character.name} rarity={5} element={character.elementKey} tone={character.elementKey} assetPaths={[character.iconPath, character.fullbodyPath, character.wishPath, character.splashPath]} fallback={character.name.slice(0, 1)} style={{ '--character-element': elementThemes[character.elementKey].color, '--character-color': elementThemes[character.elementKey].color } as CSSProperties} disabled={compact || pending !== null} onClick={() => void choose(character)} key={character.id} />)}</div>
      {compact && onOpen && <button type="button" className="home-banner-hit-area" onClick={onOpen} aria-label="Ouvrir l’écran Invocation" />}
    </section>
  }

  if (!compact && sequence.phase !== 'idle') {
    return <section className="invocation-panel invocation-sequence-panel">
      <InvocationSequence
        state={sequence}
        onAdvance={() => dispatchSequence({ type: 'advance' })}
        onSkip={() => dispatchSequence({ type: 'skip' })}
        onClose={() => dispatchSequence({ type: 'close' })}
      />
    </section>
  }

  return <section className={`invocation-panel${compact ? ' home-banner home-banner-preview' : ''}`} aria-labelledby="invocation-title">
    <div className="banner-glow banner-glow-one" /><div className="banner-glow banner-glow-two" />
    <div className="banner-copy-column">
      <div className="banner-content">
        <div className="banner-title-lockup">
          <GameAssetIcon className="banner-element-watermark" src={getElementAssetPath(selected.elementKey)} fallback="" />
          <h1 id="invocation-title">{selected.name}</h1>
        </div>
        <div className="banner-description">
          <p>Cible 5★ de la rotation hebdomadaire.</p>
          <p>Pity, Garantie et Capture sont conservées entre les rotations.</p>
        </div>
        <div className="banner-meta-actions">
          <span className="banner-end-date">Fin le {new Date(gacha.banner.endsAt).toLocaleDateString('fr-FR')}</span>
          {showDetails && <button type="button" className="banner-change-button" onClick={() => setChoosing(true)}>Changer</button>}
        </div>
        {!compact && showDetails && onGetHistory && <div className="banner-detail-row"><button type="button" className="banner-change-button detail" onClick={() => setDetailOpen(true)}>Détail</button></div>}
      </div>
      {!compact && <FeaturedFourStars characters={gacha.banner.featuredFourStars} />}
    </div>
    <div className="celestial-placeholder" aria-label={`Illustration de ${selected.name}`}><CharacterAssetImage characterName={selected.name} className="banner-character-asset" assetPaths={[selected.splashPath, selected.fullbodyPath, selected.wishPath, selected.iconPath]} fallback={<span className="celestial-star">✦</span>} alt={selected.name} /><div className="banner-featured-character"><strong>{selected.name}</strong><span>★★★★★</span></div></div>
    <div className="invocation-footer"><div className="gacha-state-summary"><Progress className="primary-pity" label="Pity 5★" value={gacha.playerState.pity5} maximum={90} /><div className="gacha-state-secondary"><Progress className="secondary-pity" label="Pity 4★" value={gacha.playerState.pity4} maximum={10} /><div className="banner-status"><span>Garantie 5★</span><strong>{gacha.playerState.guaranteedFeatured5 ? 'Oui' : 'Non'}</strong></div><div className="banner-status"><span>Capture</span><strong>{gacha.playerState.captureProgress} / 3</strong></div></div></div><div className="wish-actions" aria-label={onPull ? 'Actions d’Invocation' : 'Aperçu des Invocations'}><WishButton count={1} cost="160" disabled={!onPull || pullPending !== null} pending={pullPending === 1} onClick={() => void pull(1)} /><WishButton count={10} cost="1 600" disabled={!onPull || pullPending !== null} pending={pullPending === 10} onClick={() => void pull(10)} /></div></div>
    {pullError && <p className="pull-error invocation-pull-error" role="alert">{pullError}</p>}
    {compact && onOpen && <button type="button" className="home-banner-hit-area" onClick={onOpen} aria-label="Ouvrir l’écran Invocation" />}
    {detailOpen && onGetHistory && <GachaDetailModal onClose={() => setDetailOpen(false)} onGetHistory={onGetHistory} />}
  </section>
}

function Progress({ className = '', label, value, maximum }: { className?: string; label: string; value: number; maximum: number }) { return <div className={`banner-progress ${className}`}><div className="pity-row"><span>{label}</span><strong>{value} / {maximum}</strong></div><div className="progress-track"><span className="progress-fill pity" style={{ width: `${value / maximum * 100}%` }} /></div></div> }
function WishButton({ count, cost, disabled, pending, onClick }: { count: 1 | 10; cost: string; disabled: boolean; pending: boolean; onClick: () => void }) { return <button type="button" className={`wish-button ${count === 10 ? 'primary' : 'secondary'}`} disabled={disabled} onClick={onClick}><span>{pending ? 'Invocation…' : `Invocation x${count}`}</span><small><GameAssetIcon className="inline-currency-icon" src={currencyAssetPaths.primogem} fallback="✦" /> × {cost}</small></button> }
function FeaturedFourStars({ characters }: { characters: readonly GachaCharacterDto[] }) { return <div className="featured-four-stars" aria-label="Personnages quatre étoiles de la semaine"><div>{characters.map((character) => <CharacterShowcaseCard variant="featured" name={character.name} rarity={4} element={character.elementKey} tone={character.elementKey} assetPaths={[character.iconPath, character.fullbodyPath, character.wishPath, character.splashPath]} fallback={character.name.slice(0, 1)} style={{ '--character-element': elementThemes[character.elementKey].color, '--character-color': elementThemes[character.elementKey].color } as CSSProperties} key={character.id} />)}</div></div> }
export default BannerHero
