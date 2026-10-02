import { createContext, useContext } from 'react'
import type { TutorialStepDefinition } from './tutorial-catalog'
import type { ScreenId } from '../types'

export type TutorialPresentation = Readonly<{ active: boolean; step: TutorialStepDefinition | null }>
export const TutorialPresentationContext = createContext<TutorialPresentation>({ active: false, step: null })
export const useTutorialPresentation = () => useContext(TutorialPresentationContext)
// Derived presentation preserves normal selections and never invokes their mutation handlers.
export function useTutorialView<T extends string>(screen: ScreenId, normal: T, allowed: readonly T[]): T {
  const { active, step } = useTutorialPresentation()
  return active && step?.screen === screen && allowed.includes(step.view as T) ? step.view as T : normal
}
export function useTutorialPanel(panel: TutorialStepDefinition['panel']) {
  const { active, step } = useTutorialPresentation()
  return active && step?.panel === panel
}
