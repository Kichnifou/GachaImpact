import type { BoxCharacterDto, StellaUseDto } from '../api/types'
import { c6StatLabel } from '../gacha/pull-result-presentation'

type StellaStatKey = Extract<NonNullable<StellaUseDto['c6Progression']>, { type: 'stat' }>['stat']

export type StellaVisualFeedback =
  | Readonly<{ operationId: string; characterId: string; type: 'constellation' }>
  | Readonly<{ operationId: string; characterId: string; type: 'stat'; stat: StellaStatKey }>

export type StellaResultPresentation = Readonly<{
  message: string
  visual: StellaVisualFeedback | null
}>

export function presentStellaResult(previous: BoxCharacterDto, result: StellaUseDto): StellaResultPresentation {
  if (result.c6Progression?.type === 'stat') {
    return {
      message: `Stella utilisée · ${c6StatLabel(result.c6Progression.stat)} passe à ${result.c6Progression.valueAfter}.`,
      visual: { operationId: result.operation.id, characterId: result.character.id, type: 'stat', stat: result.c6Progression.stat },
    }
  }

  if (result.c6Progression?.type === 'unlocked') {
    return {
      message: 'Stella utilisée avec succès.',
      visual: { operationId: result.operation.id, characterId: result.character.id, type: 'constellation' },
    }
  }

  return {
    message: 'Stella utilisée avec succès.',
    visual: result.character.constellation > previous.constellation
      ? { operationId: result.operation.id, characterId: result.character.id, type: 'constellation' }
      : null,
  }
}
