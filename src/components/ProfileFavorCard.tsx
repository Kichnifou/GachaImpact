import type { Access, ProfileFavor } from '../social/types'

export default function ProfileFavorCard({ favor, own }: { favor: Access<ProfileFavor>; own: boolean }) {
  return <section className="profile-statistics-group profile-favor" aria-label="Faveur de l’Astre">
    <h2>Faveur de l’Astre</h2>
    {!favor || favor.access === 'PRIVATE' ? <p>Cette information est privée.</p> : favor.data.active ? <>
      <p>Faveur active</p>
      <p>{favor.data.daysRemaining} jours restants{own ? ` / ${favor.data.maxDays}` : ''}</p>
      {own && <><p>+{favor.data.dailyPrimogems} Primogemmes par jour</p><p>{favor.data.claimedToday ? '✓ Récompense du jour reçue' : 'Récompense du jour disponible'}</p></>}
    </> : <p>Aucune Faveur active.</p>}
    {own && <a className="profile-favor-twitch-link" href="https://www.twitch.tv/kichnifou" target="_blank" rel="noopener noreferrer">Voir la chaîne Twitch →</a>}
  </section>
}
