import type { ElementKey, WheelRewardDto } from '../api/types'

export const elementLabels: Readonly<Record<ElementKey, string>> = {
  pyro: 'Pyro',
  hydro: 'Hydro',
  cryo: 'Cryo',
  electro: 'Électro',
  anemo: 'Anémo',
  geo: 'Géo',
  dendro: 'Dendro',
}

export function formatResourceAmount(value: string): string {
  try {
    return BigInt(value).toLocaleString('fr-FR')
  } catch {
    return value
  }
}

export function formatWheelResult(result: WheelRewardDto): string {
  if (result.resultType === 'nothing') return 'La Roue ne vous accorde rien aujourd’hui.'
  if (result.resultType === 'moras') return `+${formatResourceAmount(result.amount ?? '0')} Moras`
  if (result.resultType === 'primogems') {
    return `+${formatResourceAmount(result.amount ?? '0')} Primogemmes`
  }

  const element = result.resourceKey?.replace('particles_', '') as ElementKey | undefined
  const label = element && element in elementLabels ? elementLabels[element] : 'inconnues'
  return `+${formatResourceAmount(result.amount ?? '0')} particules ${label}`
}

export function apiErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return 'Une erreur inattendue est survenue.'
  }

  const code = error.code
  const messages: Record<string, string> = {
    NETWORK_ERROR: 'Le serveur GachaImpact est momentanément inaccessible.',
    UNAUTHORIZED: 'Votre session a expiré. Reconnectez-vous.',
    SESSION_REQUIRED: 'Votre session a expiré. Reconnectez-vous.',
    ONBOARDING_DISPLAY_NAME_REQUIRED: 'Choisissez un pseudo pour continuer.',
    ELEMENT_ALREADY_CHOSEN: 'Votre élément permanent a déjà été choisi.',
    ELEMENT_NOT_AVAILABLE: 'Cet élément n’est pas disponible.',
    PLAYER_ELEMENT_REQUIRED: 'Choisissez votre élément avant de continuer.',
  }

  return typeof code === 'string' && messages[code]
    ? messages[code]
    : 'La demande n’a pas pu être traitée.'
}
