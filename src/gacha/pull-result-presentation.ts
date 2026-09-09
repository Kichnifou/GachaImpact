import type { GachaPassiveEffectDto, GachaPullResultItemDto } from '../api/types'
import { currencyAssetPaths, getElementAssetPath } from '../utils/gameAssets'

export type PullDisplayRarity = 3 | 4 | 5

const elementLabels = {
  pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Electro',
  anemo: 'Anemo', geo: 'Geo', dendro: 'Dendro',
} as const

export type PullResourcePresentation = Readonly<{
  label: string
  assetPath: string | null
  fallback: string
}>

export function pullResourcePresentation(resourceKey: string | null): PullResourcePresentation {
  if (resourceKey === 'primogems') {
    return { label: 'Primos', assetPath: currencyAssetPaths.primogem, fallback: '✦' }
  }
  if (resourceKey === 'moras') {
    return { label: 'Moras', assetPath: currencyAssetPaths.mora, fallback: 'M' }
  }
  const match = /^particles_(pyro|hydro|cryo|electro|anemo|geo|dendro)$/.exec(resourceKey ?? '')
  if (match) {
    const element = match[1] as keyof typeof elementLabels
    return {
      label: `Particules ${elementLabels[element]}`,
      assetPath: getElementAssetPath(element),
      fallback: elementLabels[element].slice(0, 1),
    }
  }
  return { label: 'Ressource', assetPath: null, fallback: '✦' }
}

export function pullDisplayRarity(result: GachaPullResultItemDto): PullDisplayRarity {
  return result.resultType === 'resource' ? 3 : result.rarity ?? 3
}

export function characterProgressionLabel(wasNewCharacter: boolean | null, constellationAfter: number | null): string {
  if (wasNewCharacter) return 'Nouveau'
  return `C${Math.min(Math.max(constellationAfter ?? 0, 0), 6)}`
}

export function bestPullRarity(results: readonly GachaPullResultItemDto[]): PullDisplayRarity {
  return results.reduce<PullDisplayRarity>(
    (best, result) => Math.max(best, pullDisplayRarity(result)) as PullDisplayRarity,
    3,
  )
}

export function pullEventLabel(result: GachaPullResultItemDto): string | null {
  if (result.captureTriggered) return 'Capture'
  if (result.guaranteeConsumed) return 'Garantie'
  if (result.wasFiftyFifty && result.wonFiftyFifty === true) return '50/50 gagné'
  if (result.wasFiftyFifty && result.wonFiftyFifty === false) return '50/50 perdu'
  return null
}

export function passiveEffectLabel(effect: GachaPassiveEffectDto): string | null {
  if (effect.type === 'five_star_chance_bonus') return null
  if (effect.type === 'secondary_reward_multiplier') {
    const multiplier = effect.numerator === 5 ? '1,25' : '1,5'
    return `${elementLabels[effect.elementKey]} · ${effect.elementKey === 'pyro' ? 'Particules' : 'Moras'} ×${multiplier}`
  }
  if (effect.type === 'xp') return `Cryo · +${effect.amount} XP`
  if (effect.type === 'pity5') return effect.amount > 0 ? `Electro · +${effect.amount} Pity 5★` : null
  if (effect.type === 'primogem_recovery') return `Anemo · +${effect.amount} Primos`
  return 'Dendro · Bundle élémentaire'
}

export function visiblePullBonusRewards(result: GachaPullResultItemDto): GachaPullResultItemDto['bonusRewards'] {
  const passiveEffects = result.passiveEffects ?? []
  const anemoRepresented = passiveEffects.some((effect) => effect.type === 'primogem_recovery')
  const dendroRepresented = passiveEffects.some((effect) => effect.type === 'resource_bundle')

  return result.bonusRewards.filter((reward) => {
    if (reward.causeKey === 'team.passive.anemo.primogem-recovery') return !anemoRepresented
    if (reward.causeKey === 'team.passive.dendro.bundle') return !dendroRepresented
    return true
  })
}

export function c6StatLabel(stat: 'strength' | 'intelligence' | 'beauty' | 'charisma' | 'popularity'): string {
  return { strength: 'Force', intelligence: 'Intelligence', beauty: 'Beauté', charisma: 'Charisme', popularity: 'Popularité' }[stat]
}
