import type { ElementKey } from '../api/types'

export type ElementTheme = {
  color: string
  profileTintStrength: string
  watermarkOpacity: number
  watermarkBrightness: number
}

export const elementThemes: Readonly<Record<ElementKey, ElementTheme>> = {
  hydro: { color: '#4fc7ff', profileTintStrength: '8%', watermarkOpacity: 0.2, watermarkBrightness: 1.35 },
  pyro: { color: '#ff795d', profileTintStrength: '7%', watermarkOpacity: 0.24, watermarkBrightness: 1.75 },
  electro: { color: '#b77aff', profileTintStrength: '8%', watermarkOpacity: 0.21, watermarkBrightness: 1.45 },
  dendro: { color: '#70cf76', profileTintStrength: '7%', watermarkOpacity: 0.2, watermarkBrightness: 1.35 },
  cryo: { color: '#9ddfff', profileTintStrength: '8%', watermarkOpacity: 0.19, watermarkBrightness: 1.25 },
  anemo: { color: '#63dab8', profileTintStrength: '7%', watermarkOpacity: 0.2, watermarkBrightness: 1.35 },
  geo: { color: '#dfad4f', profileTintStrength: '7%', watermarkOpacity: 0.22, watermarkBrightness: 1.45 },
}

export const elementColors: Readonly<Record<ElementKey, string>> = Object.fromEntries(
  Object.entries(elementThemes).map(([key, theme]) => [key, theme.color]),
) as Record<ElementKey, string>
