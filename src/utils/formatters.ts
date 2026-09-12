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
    return `+${formatResourceAmount(result.amount ?? '0')} Primos`
  }

  const element = result.resourceKey?.replace('particles_', '') as ElementKey | undefined
  const label = element && element in elementLabels ? elementLabels[element] : 'inconnues'
  return `+${formatResourceAmount(result.amount ?? '0')} particules ${label}`
}

export function formatWheelOverviewResult(result: WheelRewardDto): string {
  return result.resultType === 'nothing' ? 'Rien' : formatWheelResult(result)
}

export function formatFreshWheelResult(result: WheelRewardDto): string {
  if (result.resultType === 'nothing') return 'Pas de gain cette fois. Retente ta chance demain !'
  if (result.resultType === 'primogems') return `🌟 JACKPOT ! ${formatWheelResult(result)} !`
  const symbol = result.resultType === 'moras' ? '🎉' : '✨'
  return `${symbol} Félicitations ! Tu obtiens ${formatWheelResult(result)} !`
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
    INSUFFICIENT_PRIMOGEMS: 'Vous ne possédez pas assez de Primos.',
    GACHA_TARGET_REQUIRED: 'Choisissez une cible 5★ avant d’invoquer.',
    GACHA_TARGET_INVALID: 'Votre cible ne fait plus partie de la bannière active.',
    GACHA_BANNER_UNAVAILABLE: 'Aucune bannière Invocation n’est disponible actuellement.',
    GACHA_BANNER_INVALID: 'La bannière active est momentanément invalide.',
    GACHA_PULL_IN_PROGRESS: 'Une Invocation est déjà en cours.',
    GACHA_PULL_INTENT_CONFLICT: 'Une Invocation précédente doit d’abord être confirmée avec le même nombre de vœux.',
    BANK_AMOUNT_INVALID: 'Saisissez un montant entier strictement positif.',
    BANK_WALLET_INSUFFICIENT: 'Votre portefeuille ne contient pas assez de Moras.',
    BANK_BALANCE_INSUFFICIENT: 'Votre Banque ne contient pas assez de Moras.',
    BANK_IDEMPOTENCY_CONFLICT: 'Cette opération Banque ne peut pas être rejouée.',
    BANK_TRANSFER_IN_PROGRESS: 'Une opération Banque est déjà en cours.',
    BANK_TRANSFER_INTENT_CONFLICT: 'Une opération Banque précédente doit d’abord être vérifiée ou réessayée avec le même montant.',
    MODERATION_IN_PROGRESS: 'Une opération de test est déjà en cours.',
    MODERATION_INTENT_CONFLICT: 'Une opération de test précédente a un résultat incertain. Réessayez la même action pour vérifier son résultat avant d’en lancer une autre.',
    DAILY_COMBAT_POSITION_INVALID: 'Cet emplacement de Combat est invalide.',
    DAILY_COMBAT_CHARACTER_NOT_OWNED: 'Ce personnage ne fait pas partie de votre Box.',
    DAILY_COMBAT_CHARACTER_INACTIVE: 'Ce personnage n’est plus disponible.',
    DAILY_COMBAT_CHARACTER_DUPLICATE: 'Ce personnage est déjà sélectionné.',
    DAILY_COMBAT_LOADOUT_INCOMPLETE: 'Sélectionnez 4 personnages.',
    DAILY_COMBAT_CHARACTER_KO: 'Un personnage sélectionné est KO jusqu’à demain.',
    DAILY_COMBAT_ALREADY_COMPLETED: 'Le Combat quotidien est déjà terminé.',
    DAILY_COMBAT_NOT_ENOUGH_AVAILABLE: 'Vous n’avez plus assez de personnages disponibles aujourd’hui.',
    DAILY_COMBAT_ENCOUNTER_UNAVAILABLE: 'Le Combat du jour est momentanément indisponible.',
    DAILY_COMBAT_IDEMPOTENCY_CONFLICT: 'Une tentative précédente doit d’abord être vérifiée ou reprise avant de continuer.',
  }

  return typeof code === 'string' && messages[code]
    ? messages[code]
    : 'La demande n’a pas pu être traitée.'
}
