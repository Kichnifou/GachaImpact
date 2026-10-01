import type { ArcadeDifficulty, ArcadeGame } from '../api/arcade-types'
export const arcadeLabels: Record<ArcadeGame, string> = { MEMORY: 'Memory', CONNECT_FOUR: 'Puissance 4', TIC_TAC_TOE: 'Morpion' }
export const difficultyLabels: Record<ArcadeDifficulty, string> = { EASY: 'Facile', MEDIUM: 'Moyen', HARD: 'Difficile' }
export const outcomeLabels = { WIN: 'Victoire', DRAW: 'Égalité', LOSS: 'Défaite' }
export const scoreText = (value: string) => BigInt(value).toLocaleString('fr-FR')
