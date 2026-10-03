import { useState } from 'react'
import { createPortal } from 'react-dom'
import AppButton from '../components/AppButton'
import ModalCloseButton from '../components/ModalCloseButton'
import { useModalDialog } from '../components/useModalDialog'
import { chatCommandRegistry } from '../../server/src/application/chat/chat-command-metadata'
import './help.css'

const tabs = ['Démarrage', 'Systèmes', 'Commandes', 'Twitch'] as const
const systems = [
  ['Progression', 'Votre niveau suit les gains d’XP autorisés. Les titres débloqués sont purement cosmétiques.', 'Profil > Aperçu et Personnalisation'],
  ['Gacha', 'Choisissez une cible, consultez la rotation et vos indicateurs avant une Invocation.', 'Invocation'],
  ['Personnages', 'Retrouvez vos possessions, consultez leurs fiches et composez une équipe de quatre emplacements.', 'Personnages > Box, Équipe, Catalogue'],
  ['Activités', 'Le suivi Quotidiennes rassemble les activités du jour. Chaque activité possède ses propres conditions.', 'Activités > Quotidiennes, Missions, Combat, Arcade et Concours'],
  ['Ressources', 'Consultez vos stocks, votre Banque et les achats disponibles. Un échange ou un achat utilise vos ressources réelles.', 'Sac, Banque, Boutique et Échanges'],
  ['Social', 'Retrouvez vos amis, les profils autorisés et vos conversations. La confidentialité contrôle ce que chacun peut consulter.', 'Amis, Profil et Communauté > Chat / Messages privés'],
  ['Événements', 'Consultez le Festival, ses jeux, sa boutique et son classement selon la période et votre participation.', 'Activités > Événement et Codes'],
  ['Classements / Historique', 'Comparez les statistiques publiques et retrouvez les opérations disponibles dans votre historique.', 'Classements et Historique'],
] as const
const discovery = [
  ['Votre élément', 'Choisissez votre élément permanent à l’entrée du jeu ; votre Profil permet de le retrouver.'],
  ['Accueil', 'Retrouvez vos ressources, votre équipe active et votre objectif d’Invocation.'],
  ['Quotidiennes', 'Consultez les activités du jour depuis le suivi de la sidebar ou Activités > Quotidiennes.'],
  ['Invocation', 'Consultez votre cible, vos ressources et les indicateurs avant d’invoquer.'],
  ['Box / Équipe', 'Vos possessions sont dans la Box ; Équipe permet de préparer votre formation.'],
  ['Sac / Banque / Boutique', 'Consultez vos ressources et les actions proposées par chaque écran.'],
  ['Social', 'Amis et Communauté donnent accès aux profils autorisés et aux échanges de messages.'],
  ['Événements', 'Consultez les activités temporaires et leur disponibilité dans Événement.'],
  ['Tutoriel', 'La visite guidée met en lumière la vraie interface. Lancez-la quand votre action en cours est terminée.'],
] as const
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr-FR')
export default function HelpGuide({ onClose, onTutorial, notice = '' }: { onClose: () => void; onTutorial: () => void; notice?: string }) {
  const [tab, setTab] = useState<typeof tabs[number]>('Démarrage')
  const [search, setSearch] = useState('')
  const dialog = useModalDialog<HTMLElement>(onClose)
  const query = normalize(search.trim())
  const matches = (...values: string[]) => values.some(value => normalize(value).includes(query))
  const guides = discovery.filter(([title, text]) => matches(title, text, 'Démarrage'))
  const cards = systems.filter(([title, text, location]) => matches(title, text, location, 'Systèmes'))
  const commands = chatCommandRegistry.filter(command => command.permission === 'PLAYER' && command.internalChat === 'READY' && matches(command.name, command.category, command.syntax, command.summary, 'Commandes'))
  const twitch = chatCommandRegistry.filter(command => command.permission === 'PLAYER' && command.internalChat === 'TWITCH_ONLY' && matches(command.name, command.category, command.syntax, command.summary, 'Twitch'))
  const all = Boolean(query)
  const empty = all && !guides.length && !cards.length && !commands.length && !twitch.length
  return createPortal(<div className="modal-layer help-guide-layer" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="help-guide-title" className="floating-panel help-guide">
      <header className="floating-panel-heading"><div><span className="eyebrow">Guide du joueur</span><h2 id="help-guide-title">Aide</h2></div><ModalCloseButton onClose={onClose} /></header>
      <label className="help-search"><span>Rechercher dans l’aide</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Système, catégorie ou commande…" /></label>
      <div className="help-guide-layout"><nav aria-label="Rubriques de l’aide">{tabs.map(value => <AppButton key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setSearch('') }}>{value}</AppButton>)}</nav>
        <div className="help-guide-body" aria-live="polite">
          {empty && <p>Aucun résultat. Essayez un autre mot.</p>}
          {(all || tab === 'Démarrage') && guides.length > 0 && <section><h3>Démarrage</h3><ol className="help-discovery">{guides.map(([title, text]) => <li key={title}><strong>{title}</strong><p>{text}</p></li>)}</ol></section>}
          {(all || tab === 'Systèmes') && cards.length > 0 && <section><h3>Systèmes</h3><div className="help-system-grid">{cards.map(([title, text, location]) => <article key={title}><h4>{title}</h4><p>{text}</p><small>Où : {location}</small></article>)}</div></section>}
          {(all || tab === 'Commandes') && commands.length > 0 && <section><h3>Commandes du Chat interne</h3><p>À saisir dans le Chat de GachaImpact. Cette aide n’envoie aucune commande.</p><div className="help-command-list">{commands.map(command => <article key={command.name}><h4>!{command.name}</h4><code>{command.syntax}</code><p>{command.summary}</p><small>{command.category} · Chat interne</small></article>)}</div></section>}
          {(all ? twitch.length > 0 : tab === 'Twitch') && <section><h3>Twitch</h3><p>Ces commandes sont réservées à Twitch. La réception de ce canal dépend de son activation ; elles ne sont pas exécutables dans le Chat interne.</p><div className="help-command-list">{twitch.map(command => <article key={command.name}><h4>!{command.name}</h4><code>{command.syntax}</code><p>{command.summary}</p><small>Twitch uniquement</small></article>)}</div>{!all && <p>Faveur s’acquiert via les subscriptions compatibles. Gift Suprême est une récompense de chaîne ; aucune commande dédiée n’est nécessaire.</p>}</section>}
        </div></div>
      <footer><p>{notice || 'Le Tutoriel présente la vraie interface, sans effectuer d’action de jeu.'}</p><AppButton variant="primary" onClick={onTutorial}>Lancer le Tutoriel</AppButton></footer>
    </section>
  </div>, document.body)
}
