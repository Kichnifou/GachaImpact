import { useState } from 'react'
import type { DailyRewardClaimDto, DailyRewardTodayDto, ElementKey, WheelSpinDto, WheelTodayDto } from '../api/types'
import WheelCard from '../components/WheelCard'
import DailyRewardCard from '../components/DailyRewardCard'
import ScreenHeader from '../components/ScreenHeader'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import type { ScreenId } from '../types'

type ActivitiesScreenProps = {
  screen: ScreenId
  wheelToday: WheelTodayDto
  onSpinWheel: () => Promise<WheelSpinDto>
  dailyRewardToday: DailyRewardTodayDto
  elementKey: ElementKey
  onClaimDailyReward: () => Promise<DailyRewardClaimDto>
  onNavigate: (screen: ScreenId) => void
}

function ActivitiesScreen({ screen, wheelToday, onSpinWheel, dailyRewardToday, elementKey, onClaimDailyReward, onNavigate }: ActivitiesScreenProps) {
  if (screen === 'activities-dailies') return <DailiesScreen wheelToday={wheelToday} onSpinWheel={onSpinWheel} dailyRewardToday={dailyRewardToday} elementKey={elementKey} onClaimDailyReward={onClaimDailyReward} onNavigate={onNavigate} />
  const content = screen === 'activities-missions' ? { title: 'Missions', description: 'Les missions permanentes seront disponibles ici.', tabs: ['B', 'A', 'S', 'Z'] } : screen === 'activities-combat' ? { title: 'Combat', description: 'Le domaine Combat n’est pas encore disponible dans cette version.', tabs: ['Entraînement', 'Boss'] } : screen === 'activities-event' ? { title: 'Événement', description: 'Les événements mensuels seront accessibles ici.', tabs: ['Jeux', 'Shop', 'Classement'] } : { title: 'Concours', description: 'Le Concours C6 sera accessible ici lorsqu’il sera implémenté.', tabs: [] }
  return <div className="screen-content activity-shell"><ScreenHeader eyebrow="Activités" title={content.title} description={content.description} /><nav className="activity-inner-tabs" aria-label={`Sections ${content.title}`}>{content.tabs.map((tab) => <button type="button" disabled key={tab}>{tab}</button>)}</nav><section className="panel unavailable-shell"><strong>Bientôt disponible</strong><p>Aucune progression fictive n’est affichée.</p></section></div>
}

type DailyOverviewCardProps = {
  title: string
  status: string
  onAccess?: () => void
  accessLabel?: string
}

function DailyOverviewCard({ title, status, onAccess, accessLabel }: DailyOverviewCardProps) {
  return (
    <section className="panel daily-overview-card" data-daily-activity={title}>
      <div>
        <h2>{title}</h2>
        <p>{status}</p>
      </div>
      <button type="button" className="small-primary-button" onClick={onAccess} disabled={!onAccess} aria-label={accessLabel ?? `Accéder à ${title}`}>Accéder</button>
    </section>
  )
}

function DailiesScreen({ wheelToday, onSpinWheel, dailyRewardToday, elementKey, onClaimDailyReward, onNavigate }: Omit<ActivitiesScreenProps, 'screen'>) {
  const [tab, setTab] = useState<'overview' | 'wheel' | 'challenge'>('overview')
  const tabs = <nav className="activity-inner-tabs" aria-label="Sections Quotidiennes"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Aperçu</button><button className={tab === 'wheel' ? 'active' : ''} onClick={() => setTab('wheel')}>Roue</button><button className={tab === 'challenge' ? 'active' : ''} onClick={() => setTab('challenge')}>Défi</button></nav>
  return <div className="screen-content activity-shell dailies-shell long-screen-layout"><ScreenHeader eyebrow="Activités" title="Quotidiennes" description="Retrouvez les activités du jour et leur disponibilité réelle." /><ScrollableScreenPanel className="dailies-frame" fixed={tabs}>{tab === 'overview' && <div className="dailies-overview"><div className="daily-overview-item" data-daily-activity="Récompense quotidienne"><DailyRewardCard today={dailyRewardToday} elementKey={elementKey} onClaim={onClaimDailyReward} /></div><DailyOverviewCard title="Roue" status={wheelToday.spun ? 'Déjà utilisée aujourd’hui.' : 'Une tentative disponible aujourd’hui.'} onAccess={() => setTab('wheel')} /><DailyOverviewCard title="Défi" status="Bientôt disponible. Aucune progression n’est simulée." onAccess={() => setTab('challenge')} /><DailyOverviewCard title="Combat" status="Bientôt disponible. Entraînement et Boss sont indisponibles." onAccess={() => onNavigate('activities-combat')} /><DailyOverviewCard title="Expédition" status="Bientôt disponible. Le système Expédition n’est pas encore implémenté." onAccess={() => onNavigate('characters-box')} /><DailyOverviewCard title="Amitié" status="Bientôt disponible. Social et Amis ne sont pas encore implémentés." accessLabel="Accéder à Amitié — Social et Amis bientôt disponibles" /><DailyOverviewCard title="Événement" status="Bientôt disponible. Le système Événement n’est pas encore implémenté." onAccess={() => onNavigate('activities-event')} /></div>}{tab === 'wheel' && <WheelCard today={wheelToday} onSpin={onSpinWheel} />}{tab === 'challenge' && <section className="panel unavailable-shell"><strong>Défi indisponible</strong><p>Cette activité n’est pas encore implémentée. Aucune progression n’est simulée.</p></section>}</ScrollableScreenPanel></div>
}
export default ActivitiesScreen
