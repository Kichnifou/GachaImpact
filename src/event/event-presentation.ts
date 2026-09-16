import type { EventDto } from '../api/types'

export type EventPresentation = Readonly<{
  games: readonly [string, string, string]
  gameAFailure: string
}>

const presentations = {
  'new-year': { games: ['Feu', 'Coffre', 'Vœu'], gameAFailure: 'Pas cette fois ! La mèche du feu d’artifice s’éteint... réessaie bientôt !' },
  hearts: { games: ['Cœur', 'Cadeau', 'Mot doux'], gameAFailure: 'Pas cette fois ! La magie du cœur ne prend pas encore... réessaie bientôt !' },
  spring: { games: ['Pousse', 'Racine', 'Graine'], gameAFailure: 'Pas cette fois ! Rien ne pousse encore... réessaie bientôt !' },
  bells: { games: ['Œuf', 'Panier', 'Chocolat'], gameAFailure: 'Pas cette fois ! Aucun œuf enchanté en vue... réessaie bientôt !' },
  flowers: { games: ['Fleur', 'Bouquet', 'Mot printanier'], gameAFailure: 'Pas cette fois ! La fleur rare reste introuvable... réessaie bientôt !' },
  summer: { games: ['Pêche', 'Trésor', 'Lettre'], gameAFailure: 'Pas cette fois ! Rien ne mord à la ligne... réessaie bientôt !' },
  stars: { games: ['Étoile', 'Constellation', 'Vœu'], gameAFailure: 'Pas cette fois ! Aucune étoile filante n’apparaît... réessaie bientôt !' },
  adventurers: { games: ['Expédition', 'Ruine', 'Carnet'], gameAFailure: 'Pas cette fois ! L’expédition ne révèle encore rien... réessaie bientôt !' },
  harvest: { games: ['Récolte', 'Grenier', 'Panier'], gameAFailure: 'Pas cette fois ! Rien n’est encore prêt à être récolté... réessaie bientôt !' },
  shadows: { games: ['Fantôme', 'Crypte', 'Sort'], gameAFailure: 'Pas cette fois ! Aucun fantôme ne se montre... réessaie bientôt !' },
  mists: { games: ['Feuille', 'Relique', 'Murmure'], gameAFailure: 'Pas cette fois ! La feuille disparaît dans la brume... réessaie bientôt !' },
  christmas: { games: ['Cadeau', 'Hotte', 'Carte'], gameAFailure: 'Pas cette fois ! Il manque encore quelque chose au cadeau... réessaie bientôt !' },
} as const satisfies Readonly<Record<string, EventPresentation>>

export function eventPresentation(festivalKey: string): EventPresentation {
  const presentation = presentations[festivalKey as keyof typeof presentations]
  if (!presentation) throw new Error(`Festival Event inconnu : ${festivalKey}`)
  return presentation
}

export function eventCurrencyLabel(amount: number | string, currency: EventDto['festival']['currency']): string {
  return BigInt(amount) === 1n ? currency.unit : currency.label
}

export function eventGameAHasRemainingWindow(event: EventDto): boolean {
  return event.gameA.windows.some(({ state }) => state === 'ACTIVE' || state === 'FUTURE')
}

export function eventGameAExpiredToday(event: EventDto): boolean {
  return event.participation.joined && !event.gameA.completedToday && !eventGameAHasRemainingWindow(event)
}

export function eventHasActionableContentToday(event: EventDto): boolean {
  return event.canJoin || event.dailyBonus.canClaim || (!event.gameA.completedToday && eventGameAHasRemainingWindow(event)) || event.gameB.canAttempt || event.gameC.canSend || event.gameC.unviewedCount > 0
}

export function eventDailyDetail(event: EventDto): string {
  if (event.gameC.unviewedCount > 0) return `${event.gameC.unviewedCount} message${event.gameC.unviewedCount > 1 ? 's' : ''} du Festival à consulter`
  if (!event.participation.joined) return 'Participation disponible'
  if (event.dailyBonus.canClaim && !event.gameC.canSend && !event.gameB.canAttempt && (event.gameA.completedToday || !eventGameAHasRemainingWindow(event))) return 'Bonus quotidien à réclamer'
  if (event.gameC.canSend && !event.gameB.canAttempt && (event.gameA.completedToday || !eventGameAHasRemainingWindow(event))) return 'Message du Festival disponible'
  if (event.gameB.canAttempt && (event.gameA.completedToday || !eventGameAHasRemainingWindow(event))) return 'Énigme du jour disponible'
  if (event.gameA.completedToday) return 'Jeu du jour réussi'
  return eventGameAHasRemainingWindow(event) ? 'Jeu du jour disponible' : 'Délai dépassé'
}
