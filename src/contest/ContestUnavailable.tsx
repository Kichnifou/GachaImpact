import { useContestRefresh } from './use-contest-refresh'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import AppButton from '../components/AppButton'
import type { ContestAvailability } from './contest-request-coordinator'

export default function ContestUnavailable({ availability, onRetry }: {
  availability: ContestAvailability
  onRetry?: () => Promise<unknown>
}) {
  const syncError = useContestRefresh(onRetry)
  return <div className="screen-content activity-shell">
    <ScreenHeader eyebrow="Activités" title="Concours" description="Compétition de vos Légendes." />
    <ScrollableScreenPanel>
      <div className="unavailable-shell" role="status">
        <strong>{availability.phase === 'loading' ? 'Chargement du Concours…' : 'Concours indisponible'}</strong>
        <p>{availability.pending ? 'La lecture est encore en cours. Vous pouvez continuer à jouer dans les autres activités.' : (syncError ?? 'Le Concours n’a pas pu être chargé. Nouvelle tentative automatique.')}</p>
        <AppButton disabled={availability.pending || !onRetry} onClick={() => { void onRetry?.().catch(() => undefined) }}>
          {availability.pending ? 'Lecture en cours…' : 'Réessayer'}
        </AppButton>
      </div>
    </ScrollableScreenPanel>
  </div>
}
