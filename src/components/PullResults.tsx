import type { CSSProperties } from 'react'
import type { GachaPullDto, GachaPullResultItemDto } from '../api/types'
import { elementThemes } from '../utils/elementTheme'
import { formatResourceAmount } from '../utils/formatters'
import { c6StatLabel, pullDisplayRarity, pullEventLabel, pullResourcePresentation } from '../gacha/pull-result-presentation'
import CharacterAssetImage from './CharacterAssetImage'
import GameAssetIcon from './GameAssetIcon'

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
  const characterAssetPaths = result.character
    ? compact
      ? [result.character.iconPath, result.character.fullbodyPath, result.character.wishPath, result.character.splashPath]
      : [result.character.splashPath, result.character.wishPath, result.character.fullbodyPath, result.character.iconPath]
    : []
  const bonusContent = <>
    {result.bonusRewards.map((reward) => <small className="pull-bonus" key={`${reward.resourceKey}-${reward.causeKey}`}>+{formatResourceAmount(reward.amount)} {pullResourcePresentation(reward.resourceKey).label}</small>)}
    {result.c6Progression?.type === 'stat' && <small className="pull-bonus">{c6StatLabel(result.c6Progression.stat)} +1</small>}
    {result.c6Progression?.type === 'maxed' && <small className="pull-bonus">Progression C6 maxée</small>}
  </>
  return (
    <article className={`pull-result-card ${result.character ? 'character-result' : 'resource-result'} rarity-${rarity}${!compact && result.character?.splashPath ? ' has-character-splash' : ''}${compact ? ' compact' : ' reveal'}`} style={{ '--pull-order': order } as CSSProperties}>
      <span className="pull-result-index">#{result.index}</span>
      {result.character ? <>
        {!compact && <CharacterAssetImage characterName={result.character.name} className="pull-result-backdrop-image" assetPaths={characterAssetPaths} fallback={null} alt="" />}
        <div className="pull-result-portrait" style={{ '--character-color': elementThemes[result.character.elementKey].color } as CSSProperties}>
          <CharacterAssetImage characterName={result.character.name} className="pull-result-image" assetPaths={characterAssetPaths} fallback={<span>{result.character.name.slice(0, 1)}</span>} alt={result.character.name} />
        </div>
        <div className="pull-result-copy">
          <strong>{result.character.name}</strong>
          <span className="pull-result-rarity">{'★'.repeat(rarity)}</span>
          <small>{result.wasNewCharacter ? 'Nouveau · C0' : `Copie ${result.copiesAfter} · C${result.constellationAfter}`}</small>
          {event && <small className="pull-event">{event}</small>}
          {bonusContent}
        </div>
      </> : <div className="pull-resource-content">
          <div className="pull-resource-symbol">
            {resource.assetPath ? <GameAssetIcon className="pull-resource-asset" src={resource.assetPath} fallback={resource.fallback} /> : <span>{resource.fallback}</span>}
          </div>
          <strong>{resource.label}</strong>
          <span className="pull-result-rarity">★★★</span>
          <span className="pull-resource-amount">+{formatResourceAmount(result.resourceAmount ?? '0')}</span>
          {bonusContent}
        </div>}
    </article>
  )
}

export default PullResults
