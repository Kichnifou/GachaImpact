import type { GachaHistoryResultDto } from '../api/types'
import { formatResourceAmount } from '../utils/formatters'
import { c6StatLabel, pullEventLabel, pullResourcePresentation } from './pull-result-presentation'

export function historyResultLabel(result: GachaHistoryResultDto): string {
  if (result.character) return result.character.name
  const resource = pullResourcePresentation(result.resourceKey)
  return `${formatResourceAmount(result.resourceAmount ?? '0')} ${resource.label}`
}

export function historyPityLabel(result: GachaHistoryResultDto): string {
  return result.pity5AtPull === null ? '—' : String(result.pity5AtPull)
}

export function historyProgressionLabel(result: GachaHistoryResultDto): string {
  if (!result.character) return '—'
  const parts = [result.wasNewCharacter
    ? `Nouveau · C${result.constellationAfter ?? 0}`
    : `Copie ${result.copiesAfter ?? '—'} · C${result.constellationAfter ?? '—'}`]
  for (const reward of result.bonusRewards) {
    parts.push(`+${formatResourceAmount(reward.amount)} ${pullResourcePresentation(reward.resourceKey).label}`)
  }
  if (result.c6Progression?.type === 'stat') parts.push(`${c6StatLabel(result.c6Progression.stat)} +1`)
  if (result.c6Progression?.type === 'maxed') parts.push('Progression C6 maxée')
  return parts.join(' · ')
}

export function historyEventLabel(result: GachaHistoryResultDto): string {
  return pullEventLabel(result) ?? '—'
}

export function historyDateLabel(occurredAt: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(occurredAt))
}
