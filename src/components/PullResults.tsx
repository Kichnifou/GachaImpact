import type { CSSProperties } from 'react'
import type { GachaPullDto } from '../api/types'
import { elementThemes } from '../utils/elementTheme'
import { formatResourceAmount } from '../utils/formatters'
import CharacterAssetImage from './CharacterAssetImage'

function PullResults({ pull, onClose }: { pull: GachaPullDto; onClose: () => void }) {
  return (
    <section className="pull-results" aria-live="polite" aria-label={`Résultats de l’Invocation x${pull.operation.pullCount}`}>
      <header><div><span>Invocation validée</span><h2>Résultats x{pull.operation.pullCount}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fermer les résultats">×</button></header>
      <div className={`pull-results-grid pull-results-${pull.operation.pullCount}`}>
        {pull.results.map((result, order) => (
          <article className={`pull-result-card rarity-${result.rarity ?? 'resource'}`} style={{ '--pull-order': order } as CSSProperties} key={result.index}>
            <span className="pull-result-index">#{result.index}</span>
            {result.character ? <>
              <div className="pull-result-portrait" style={{ '--character-color': elementThemes[result.character.elementKey].color } as CSSProperties}>
                <CharacterAssetImage characterName={result.character.name} className="pull-result-image" assetPaths={[result.character.iconPath, result.character.fullbodyPath, result.character.wishPath]} fallback={<span>{result.character.name.slice(0, 1)}</span>} alt={result.character.name} />
              </div>
              <strong>{result.character.name}</strong>
              <span className="pull-result-rarity">{'★'.repeat(result.rarity ?? 0)}</span>
              <small>{result.wasNewCharacter ? 'Nouveau · C0' : `Copie ${result.copiesAfter} · C${result.constellationAfter}`}</small>
            </> : <>
              <div className="pull-resource-symbol" aria-hidden="true">✦</div>
              <strong>{resourceLabel(result.resourceKey)}</strong>
              <span className="pull-resource-amount">+{formatResourceAmount(result.resourceAmount ?? '0')}</span>
            </>}
            {result.bonusRewards.map((reward) => <small className="pull-bonus" key={`${reward.resourceKey}-${reward.causeKey}`}>Bonus +{formatResourceAmount(reward.amount)} {resourceLabel(reward.resourceKey)}</small>)}
          </article>
        ))}
      </div>
    </section>
  )
}

function resourceLabel(resourceKey: string | null): string {
  if (resourceKey === 'primogems') return 'Primogemmes'
  if (resourceKey === 'moras') return 'Moras'
  return `Particules ${resourceKey?.replace('particles_', '') ?? ''}`
}

export default PullResults
