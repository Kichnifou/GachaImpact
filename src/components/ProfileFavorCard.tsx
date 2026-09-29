import type { Access, ProfileFavor } from '../social/types'

export default function ProfileFavorCard({ favor, own }: { favor: Access<ProfileFavor>; own: boolean }) {
  return <section className={`profile-statistics-group profile-favor${own ? ' profile-favor-own' : ''}`} aria-label="Faveur de l’Astre">
    <h2>Faveur de l’Astre</h2>
    {!favor || favor.access === 'PRIVATE' ? <p>Cette information est privée.</p> : favor.data.active ? <>
      <p className="profile-favor-status">Faveur active</p>
      <p className={favor.data.daysRemaining >= 1 && favor.data.daysRemaining <= 3 ? 'profile-favor-expiring' : undefined}>Reste : {favor.data.daysRemaining} jour{favor.data.daysRemaining === 1 ? '' : 's'}</p>
      {own && <><p className="profile-favor-reward">Récompense : +{favor.data.dailyPrimogems} Primos par jour</p><p className={favor.data.claimedToday ? 'profile-favor-claimed' : 'profile-favor-available'}>{favor.data.claimedToday ? "✅ Récupérée aujourd'hui" : "Récompense disponible aujourd'hui"}</p></>}
    </> : <p>Aucune Faveur active.</p>}
    {own && <a className="profile-favor-twitch-link" href="https://www.twitch.tv/kichnifou" target="_blank" rel="noopener noreferrer">Voir la chaîne Twitch →</a>}
  </section>
}
