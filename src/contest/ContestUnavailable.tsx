import { useContestRefresh } from './use-contest-refresh'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import ContestConnectionStatus from './ContestConnectionStatus'
import type { ContestAvailability } from './contest-request-coordinator'

export default function ContestUnavailable({ availability, onRetry }: {
  availability: ContestAvailability
  onRetry?: () => Promise<unknown>
}) {
  const error = useContestRefresh(onRetry)
  return <div className="screen-content contest-screen long-screen-layout">
    <ScreenHeader eyebrow="Activités" title="Concours" />
    <ScrollableScreenPanel className="contest-frame" bodyClassName="contest-scroll-body">
      <div className="contest-neutral" aria-busy="true" aria-label="Concours">
        <ContestConnectionStatus waiting error={error} pending={availability.pending} retry={onRetry} />
      </div>
    </ScrollableScreenPanel>
  </div>
}
