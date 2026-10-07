import { useState } from 'react'
import type { TwitchLinkResolutionDto, TwitchProgressionSummary } from '../api/types'
import { elementLabels } from '../utils/formatters'
import AppButton from '../components/AppButton'

function Summary({ title, value }: { title: string; value: TwitchProgressionSummary }) {
  return <section className="twitch-progression-summary"><h4>{title}</h4><p>{value.displayName}</p><dl>
    <div><dt>Niveau</dt><dd>{value.level}</dd></div>
    <div><dt>Élément</dt><dd>{value.elementKey ? elementLabels[value.elementKey as keyof typeof elementLabels] ?? value.elementKey : 'Non choisi'}</dd></div>
    <div><dt>Primos</dt><dd>{value.resources.primogems ?? '0'}</dd></div>
    <div><dt>Moras</dt><dd>{value.resources.moras ?? '0'}</dd></div>
    <div><dt>Personnages</dt><dd>{value.characters}</dd></div>
    <div><dt>Messages</dt><dd>{value.totalMessages}</dd></div>
    <div><dt>Activité récente</dt><dd>{value.recentActivityAt ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value.recentActivityAt)) : 'Aucune activité enregistrée'}</dd></div>
  </dl></section>
}

/** Inline resolution screen keeps the account dialog's own focus and scroll owner. */
export default function TwitchProgressionChoice({ resolution, pending, onChoose }: { resolution: TwitchLinkResolutionDto; pending: boolean; onChoose: (choice: 'WEB' | 'TWITCH') => void }) {
  const [acknowledged, setAcknowledged] = useState(false)
  const webBlocked = resolution.safety.WEB.status === 'OPERATOR_REQUIRED'
  const twitchBlocked = resolution.safety.TWITCH.status === 'OPERATOR_REQUIRED'
  return <section className="twitch-progression-choice" aria-labelledby="twitch-progression-title">
    <h3 id="twitch-progression-title">Choisis la progression à conserver</h3>
    <p>Deux progressions existent pour tes comptes. Une seule sera conservée comme progression principale dans Twitch et l’application web.</p>
    <div className="twitch-progression-comparison"><Summary title="Application Web" value={resolution.web} /><Summary title="Twitch" value={resolution.twitch} /></div>
    <p className="twitch-progression-warning">Ce choix est définitif. Les ressources et les personnages des deux progressions ne seront pas fusionnés. Tu ne pourras pas basculer ensuite vers la progression écartée.</p>
    {webBlocked && twitchBlocked && <p role="status">{resolution.safety.WEB.reason === 'TWITCH_PROGRESSION_NATIVE_AUTHORITY_REQUIRES_OPERATOR' ? 'Les deux choix nécessitent une résolution opérateur. L’autorité Twitch est active et la progression Web contient des données partagées.' : 'Ces deux progressions possèdent des données partagées. Une résolution opérateur est nécessaire.'}</p>}
    <label className="twitch-progression-ack"><input type="checkbox" checked={acknowledged} disabled={pending || webBlocked && twitchBlocked} onChange={event => setAcknowledged(event.target.checked)} /> J’ai compris : une seule progression, sans fusion ni retour libre.</label>
    <div className="twitch-progression-actions">
      <div>{webBlocked && <p id="twitch-web-choice-reason">{resolution.safety.WEB.reason === 'TWITCH_PROGRESSION_NATIVE_AUTHORITY_REQUIRES_OPERATOR' ? 'L’autorité Twitch est active. Abandonner cette progression nécessite une résolution opérateur.' : 'Cette progression Twitch contient des relations partagées qui nécessitent une résolution opérateur.'}</p>}<AppButton disabled={!acknowledged || pending || webBlocked} aria-describedby={webBlocked ? 'twitch-web-choice-reason' : undefined} aria-busy={pending} onClick={() => onChoose('WEB')}>Conserver ma progression de l’application Web</AppButton></div>
      <div>{twitchBlocked && <p id="twitch-twitch-choice-reason">Cette progression de l’application Web contient des relations partagées qui nécessitent une résolution opérateur.</p>}<AppButton disabled={!acknowledged || pending || twitchBlocked} aria-describedby={twitchBlocked ? 'twitch-twitch-choice-reason' : undefined} aria-busy={pending} onClick={() => onChoose('TWITCH')}>Utiliser ma progression Twitch</AppButton></div>
    </div>
  </section>
}
