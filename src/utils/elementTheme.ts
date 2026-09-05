import type { ElementKey } from '../api/types'

export type ElementTheme = {
  color: string
  surfaceTintStrength: string
  watermarkOpacity: number
  watermarkBrightness: number
}

export const elementThemes: Readonly<Record<ElementKey, ElementTheme>> = {
  hydro: { color: '#4fc7ff', surfaceTintStrength: '7%', watermarkOpacity: 0.25, watermarkBrightness: 1.5 },
  pyro: { color: '#ff795d', surfaceTintStrength: '5%', watermarkOpacity: 0.29, watermarkBrightness: 1.95 },
  electro: { color: '#b77aff', surfaceTintStrength: '7%', watermarkOpacity: 0.26, watermarkBrightness: 1.55 },
  dendro: { color: '#70cf76', surfaceTintStrength: '6%', watermarkOpacity: 0.25, watermarkBrightness: 1.5 },
  cryo: { color: '#9ddfff', surfaceTintStrength: '7%', watermarkOpacity: 0.24, watermarkBrightness: 1.4 },
  anemo: { color: '#63dab8', surfaceTintStrength: '6%', watermarkOpacity: 0.25, watermarkBrightness: 1.5 },
  geo: { color: '#dfad4f', surfaceTintStrength: '6%', watermarkOpacity: 0.27, watermarkBrightness: 1.6 },
}

export const elementColors: Readonly<Record<ElementKey, string>> = Object.fromEntries(
  Object.entries(elementThemes).map(([key, theme]) => [key, theme.color]),
) as Record<ElementKey, string>
