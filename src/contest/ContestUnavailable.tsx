import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import AppButton from '../components/AppButton'
import type { ContestAvailability } from './contest-request-coordinator'

export default function ContestUnavailable({ availability, onRetry }: {
  availability: ContestAvailability
  onRetry?: () => Promise<unknown>
}) {
  return <div className="screen-content activity-shell">
    <ScreenHeader eyebrow="Activités" title="Concours" description="Compétition de vos Légendes." />
    <ScrollableScreenPanel>
      <div className="unavailable-shell" role="status">
        <strong>{availability.phase === 'loading' ? 'Chargement du Concours…' : 'Concours indisponible'}</strong>
        <p>{availability.pending ? 'La lecture est encore en cours. Vous pouvez continuer à jouer dans les autres activités.' : 'Le Concours n’a pas pu être chargé. Vous pouvez réessayer.'}</p>
        <AppButton disabled={availability.pending || !onRetry} onClick={() => { void onRetry?.().catch(() => undefined) }}>
          {availability.pending ? 'Lecture en cours…' : 'Réessayer'}
        </AppButton>
      </div>
    </ScrollableScreenPanel>
  </div>
}
