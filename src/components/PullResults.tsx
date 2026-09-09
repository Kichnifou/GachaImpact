import type { CSSProperties } from 'react'
import type { GachaPullDto, GachaPullResultItemDto } from '../api/types'
import { elementThemes } from '../utils/elementTheme'
import { formatResourceAmount } from '../utils/formatters'
import { c6StatLabel, characterProgressionLabel, passiveEffectLabel, pullDisplayRarity, pullEventLabel, pullResourcePresentation, visiblePullBonusRewards } from '../gacha/pull-result-presentation'
import CharacterAssetImage from './CharacterAssetImage'
import GameAssetIcon from './GameAssetIcon'
import { getElementAssetPath } from '../utils/gameAssets'

const individualRevealNameStyle = { lineHeight: 1.12, paddingBottom: '0.12em' } satisfies CSSProperties

function PullResults({ pull }: { pull: GachaPullDto }) {
  return (
    <div className="pull-results-grid pull-results-10" aria-label={`Récapitulatif de l’Invocation x${pull.operation.pullCount}`}>
      {pull.results.map((result, order) => <PullResultCard result={result} order={order} compact key={result.index} />)}
    </div>
  )
}

export function PullResultCard({ result, order = 0, compact = false }: { result: GachaPullResultItemDto; order?: number; compact?: boolean }) {
  const rarity = pullDisplayRarity(result)
  const resource = pullResourcePresentation(result.resourceKey)
  const event = pullEventLabel(result)
  const revealProgression = characterProgressionLabel(result.wasNewCharacter, result.constellationAfter)
  const passiveEffects = (result.passiveEffects ?? []).flatMap((effect) => {
    const label = passiveEffectLabel(effect, compact ? 'compact' : 'reveal')
    return label ? [{ effect, label }] : []
  })
  const visibleBonusRewards = visiblePullBonusRewards(result)
  const characterAssetPaths = result.character
    ? compact
      ? [result.character.iconPath, result.character.fullbodyPath, result.character.wishPath, result.character.splashPath]
      : [result.character.splashPath, result.character.wishPath, result.character.fullbodyPath, result.character.iconPath]
    : []
  const compactBonusContent = <>
    {visibleBonusRewards.map((reward) => <small className={`pull-bonus${compact && reward.causeKey === 'gacha.c6-duplicate-refund' ? ' pull-c6-refund' : ''}`} key={`${reward.resourceKey}-${reward.causeKey}`}>+{formatResourceAmount(reward.amount)} {pullResourcePresentation(reward.resourceKey).label}</small>)}
    {result.c6Progression?.type === 'stat' && <small className="pull-bonus">{c6StatLabel(result.c6Progression.stat)} +1</small>}
    {result.c6Progression?.type === 'maxed' && <small className="pull-bonus">Progression C6 maxée</small>}
    {passiveEffects.length > 0 && <PassiveEffects effects={passiveEffects} alignment="centered" />}
  </>
  return (
    <article className={`pull-result-card ${result.character ? 'character-result' : 'resource-result'} rarity-${rarity}${compact ? ' compact' : ' reveal'}`} style={{ '--pull-order': order } as CSSProperties}>
      {(compact || !result.character) && <span className="pull-result-index">#{result.index}</span>}
      {result.character ? <>
        <div className="pull-result-portrait" style={{ '--character-color': elementThemes[result.character.elementKey].color } as CSSProperties}>
          <CharacterAssetImage characterName={result.character.name} className="pull-result-image" assetPaths={characterAssetPaths} fallback={<span>{result.character.name.slice(0, 1)}</span>} alt={result.character.name} />
        </div>
        <div className="pull-result-copy">
          <span className="pull-character-identity">
            {!compact && <small className="pull-result-progression">{revealProgression}</small>}
            <strong style={compact ? undefined : individualRevealNameStyle}>{result.character.name}</strong>
            <span className="pull-result-rarity">{'★'.repeat(rarity)}</span>
            {compact && <small>{revealProgression}</small>}
            {compact && event && <small className="pull-event">{event}</small>}
          </span>
          {!compact && passiveEffects.length > 0 && <PassiveEffects effects={passiveEffects} alignment="character" />}
          {compact && compactBonusContent}
        </div>
      </> : <div className="pull-resource-content">
          <div className="pull-resource-symbol">
            {resource.assetPath ? <GameAssetIcon className="pull-resource-asset" src={resource.assetPath} fallback={resource.fallback} /> : <span>{resource.fallback}</span>}
          </div>
          <strong>{resource.label}</strong>
          <span className="pull-result-rarity">★★★</span>
          <span className="pull-resource-amount">+{formatResourceAmount(result.resourceAmount ?? '0')}</span>
          {!compact && passiveEffects.length > 0 && <PassiveEffects effects={passiveEffects} alignment="centered" />}
          {compact && compactBonusContent}
        </div>}
    </article>
  )
}

function PassiveEffects({ effects, alignment }: { effects: readonly { effect: NonNullable<GachaPullResultItemDto['passiveEffects']>[number]; label: string }[]; alignment: 'centered' | 'character' }) {
  return <span className={`pull-passive-effects passive-feedback-${alignment}`}>{effects.map(({ effect, label }, index) => <span className="pull-passive-effect-line" key={`${effect.elementKey}-${effect.type}-${index}`}><small className="pull-passive-effect"><span className="pull-passive-label"><GameAssetIcon className="pull-passive-icon" src={getElementAssetPath(effect.elementKey)} fallback="✦" /><span className="pull-passive-text">{label}</span></span></small></span>)}</span>
}

export default PullResults
