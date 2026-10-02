import type { TutorialPreferenceDto, TutorialStepId } from '../api/types'
import { tutorialSteps } from './tutorial-catalog'
export { tutorialSteps } from './tutorial-catalog'
export type PreparedTutorialTarget = Readonly<{ anchor?: string; fallback?: boolean }>
export type PrepareTutorial = (id: TutorialStepId, signal: AbortSignal) => Promise<PreparedTutorialTarget>
export type TutorialApi = { get: () => Promise<TutorialPreferenceDto>; put: (value: TutorialPreferenceDto) => Promise<TutorialPreferenceDto> }
export type TutorialAction = 'launch' | 'previous' | 'next' | 'finish'
type Snapshot = Readonly<{ active: boolean; stepId: TutorialStepId | null; confirmedStepId: TutorialStepId | null; phase: 'idle' | 'writing' | 'preparing'; anchor?: string; fallback?: boolean; pending: boolean; error: string; retryAction: TutorialAction | null }>

// One controller per Player. A failed write retains its exact intention for retry.
export class TutorialController {
  private snapshot: Snapshot = { active: false, stepId: null, confirmedStepId: null, phase: 'idle', pending: false, error: '', retryAction: null }
  private listeners = new Set<() => void>()
  private retry: { action: TutorialAction; execute: () => Promise<void> } | null = null
  private disposed = false
  private pauseRequested = false
  private readonly api: TutorialApi
  private generation = 0
  private abort: AbortController | null = null
  private readonly prepare: PrepareTutorial
  constructor(api: TutorialApi, prepare: PrepareTutorial = async () => ({})) { this.api = api; this.prepare = prepare }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(patch: Partial<Snapshot>) { if (this.disposed) return; this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener()) }
  private async run(action: TutorialAction, intent: () => Promise<void>) {
    if (this.disposed || this.snapshot.pending) return
    const generation = ++this.generation
    this.abort = new AbortController()
    this.update({ pending: true, phase: 'writing', error: '' })
    try { await intent(); if (generation !== this.generation || this.disposed) return; this.retry = null; this.update({ retryAction: null }) }
    catch {
      if (generation !== this.generation || this.disposed) return
      this.retry = { action, execute: intent }
      const control = action === 'previous' ? 'Précédent' : action === 'finish' ? 'Terminer' : 'Suivant'
      this.update({ retryAction: action, error: `Tutoriel indisponible. Réessayez avec ${control}.` })
    }
    finally {
      if (generation === this.generation && !this.disposed) {
        this.abort = null
        this.update({ pending: false, phase: 'idle' })
        if (this.pauseRequested) { this.pauseRequested = false; this.pause() }
      }
    }
  }
  launch = () => {
    if (this.snapshot.active || this.disposed) return
    this.update({ active: true, stepId: null })
    let saved: TutorialPreferenceDto | null = null
    let execute: (() => Promise<void>) | null = null
    return this.run('launch', async () => {
      const generation = this.generation
      if (!saved) saved = await this.api.get()
      if (this.disposed || generation !== this.generation) return
      if (saved.status === 'IN_PROGRESS') await this.present(saved.stepId)
      else { execute ??= this.transition({ version: 1, status: 'IN_PROGRESS', stepId: 'profile' }); await execute() }
    })
  }
  private async present(id: TutorialStepId) {
    if (this.disposed || !this.abort || this.abort.signal.aborted) return
    const signal = this.abort.signal
    this.update({ phase: 'preparing', stepId: null, confirmedStepId: id, anchor: undefined, fallback: false })
    const target = await this.prepare(id, signal)
    if (this.disposed || signal.aborted) return
    this.update({ stepId: id, ...target })
  }
  private transition(value: TutorialPreferenceDto) {
    let confirmed: TutorialPreferenceDto | null = null
    return async () => {
      const generation = this.generation
      if (!confirmed) confirmed = await this.api.put(value)
      if (this.disposed || generation !== this.generation || !this.abort || this.abort.signal.aborted) return
      if (confirmed.status === 'IN_PROGRESS') { if (this.pauseRequested) this.update({ stepId: confirmed.stepId, confirmedStepId: confirmed.stepId }); else await this.present(confirmed.stepId) }
      else this.update({ active: false, stepId: null, confirmedStepId: null })
    }
  }
  next = () => {
    if (!this.snapshot.active || this.snapshot.pending) return
    if (this.retry) return this.retry.action === 'next' || this.retry.action === 'launch' ? this.run(this.retry.action, this.retry.execute) : undefined
    const index = tutorialSteps.findIndex(step => step.id === this.snapshot.stepId)
    if (index < 0) return
    const next = tutorialSteps[index + 1]
    return this.run('next', this.transition(next ? { version: 1, status: 'IN_PROGRESS', stepId: next.id } : { version: 1, status: 'COMPLETED', stepId: null }))
  }
  previous = () => {
    if (!this.snapshot.active || this.snapshot.pending) return
    if (this.retry) return this.retry.action === 'previous' ? this.run('previous', this.retry.execute) : undefined
    const index = tutorialSteps.findIndex(step => step.id === this.snapshot.stepId)
    if (index <= 0) return
    return this.run('previous', this.transition({ version: 1, status: 'IN_PROGRESS', stepId: tutorialSteps[index - 1]!.id }))
  }
  finish = () => {
    if (!this.snapshot.active || this.snapshot.pending) return
    if (this.retry) return this.retry.action === 'finish' ? this.run('finish', this.retry.execute) : undefined
    return this.run('finish', this.transition({ version: 1, status: 'COMPLETED', stepId: null }))
  }
  pause = () => {
    if (this.snapshot.pending && this.snapshot.phase === 'writing') { this.pauseRequested = true; return }
    this.abort?.abort(); this.abort = null; this.generation++; this.pauseRequested = false
    this.retry = null
    this.update({ active: false, pending: false, phase: 'idle', error: '', retryAction: null })
  }
  activate = () => { this.disposed = false }
  dispose = () => { this.disposed = true; this.generation++; this.abort?.abort(); this.abort = null; this.listeners.clear() }
}
