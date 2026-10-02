import type { TutorialPreferenceDto, TutorialStepId } from '../api/types'

export const tutorialSteps: readonly { id: TutorialStepId; title: string; text: string }[] = [
  { id: 'profile', title: 'Profil', text: 'Avatar, pseudo, niveau et élément. Un clic normal ouvre les détails du Profil.' },
  { id: 'resources', title: 'Ressources', text: 'Vos Primos, Moras et particules, avec des raccourcis contextuels.' },
  { id: 'active-team', title: 'Équipe active', text: 'Voici la Team actuellement utilisée.' },
  { id: 'objective', title: 'Objectif actuel', text: 'Retrouvez votre cible Invocation et ses principales informations.' },
  { id: 'daily-tracker', title: 'Quotidiennes', text: 'Parcourez les rappels et accédez aux activités du jour.' },
  { id: 'main-navigation', title: 'Navigation principale', text: 'Accueil, Invocation, Personnages, Activités, Sac, Boutique et Configuration : vos destinations principales.' },
  { id: 'home', title: 'Accueil', text: 'La bannière mène à Invocation. Quotidiennes résume ce qu’il reste à faire.' },
  { id: 'community', title: 'Communauté', text: 'Retrouvez ici le Chat global et les Messages privés.' },
]
export type TutorialApi = { get: () => Promise<TutorialPreferenceDto>; put: (value: TutorialPreferenceDto) => Promise<TutorialPreferenceDto> }
type Snapshot = Readonly<{ active: boolean; stepId: TutorialStepId | null; pending: boolean; error: string }>

// One controller per Player. A failed write retains its exact intention for retry.
export class TutorialController {
  private snapshot: Snapshot = { active: false, stepId: null, pending: false, error: '' }
  private listeners = new Set<() => void>()
  private retry: (() => Promise<void>) | null = null
  private disposed = false
  private pauseRequested = false
  private readonly api: TutorialApi
  constructor(api: TutorialApi) { this.api = api }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(patch: Partial<Snapshot>) { if (this.disposed) return; this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener()) }
  private async run(intent: () => Promise<void>) {
    if (this.disposed || this.snapshot.pending) return
    this.update({ pending: true, error: '' })
    try { await intent(); this.retry = null }
    catch { this.retry = intent; this.update({ error: 'Tutoriel indisponible. Suivant permet de réessayer.' }) }
    finally {
      this.update({ pending: false })
      if (this.pauseRequested) { this.pauseRequested = false; this.pause() }
    }
  }
  launch = () => {
    if (this.snapshot.active || this.disposed) return
    this.update({ active: true, stepId: null })
    return this.run(async () => {
      const saved = await this.api.get()
      if (this.disposed) return
      if (saved.status === 'IN_PROGRESS') this.update({ stepId: saved.stepId })
      else await this.persist({ version: 1, status: 'IN_PROGRESS', stepId: 'profile' })
    })
  }
  private async persist(value: TutorialPreferenceDto) {
    const confirmed = await this.api.put(value)
    this.update(confirmed.status === 'IN_PROGRESS' ? { stepId: confirmed.stepId } : { active: false, stepId: null })
  }
  next = () => {
    if (!this.snapshot.active || this.snapshot.pending) return
    if (this.retry) return this.run(this.retry)
    const index = tutorialSteps.findIndex(step => step.id === this.snapshot.stepId)
    if (index < 0) return
    const next = tutorialSteps[index + 1]
    return this.run(() => this.persist(next ? { version: 1, status: 'IN_PROGRESS', stepId: next.id } : { version: 1, status: 'COMPLETED', stepId: null }))
  }
  finish = () => {
    if (!this.snapshot.active || this.snapshot.pending || this.retry) return
    return this.run(() => this.persist({ version: 1, status: 'COMPLETED', stepId: null }))
  }
  pause = () => {
    if (this.snapshot.pending) { this.pauseRequested = true; return }
    this.retry = null
    this.update({ active: false, error: '' })
  }
  activate = () => { this.disposed = false }
  dispose = () => { this.disposed = true; this.listeners.clear() }
}
