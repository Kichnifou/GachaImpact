import { useState } from 'react'
import { createPortal } from 'react-dom'
import AppButton from '../components/AppButton'
import ModalCloseButton from '../components/ModalCloseButton'
import { useModalDialog } from '../components/useModalDialog'

const tabs = ['Général', 'Memory', 'Puissance 4', 'Morpion'] as const
export default function ArcadeRulesModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<typeof tabs[number]>('Général')
  const dialog = useModalDialog<HTMLElement>(onClose)
  return createPortal(<div className="arcade-records-overlay" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialog} tabIndex={-1} className="arcade-rules panel" role="dialog" aria-modal="true" aria-label="Règles & gains">
      <header><h2>Règles & gains</h2><ModalCloseButton onClose={onClose} /></header>
      <nav aria-label="Règles Arcade">{tabs.map(value => <AppButton key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value}</AppButton>)}</nav>
      <div className="arcade-rules-body">
        {tab === 'Général' ? <>
          <div className="arcade-rule-cards"><article><h3>Première fin du jour</h3><p>XP + score pour chaque jeu.</p><strong>Jusqu’à 10 XP par jeu · 30 XP par jour</strong></article>
            <article><h3>Parties suivantes</h3><p>Score uniquement. Les difficultés partagent le quota du jeu, renouvelé à minuit en Europe/Paris.</p></article>
            <article><h3>Interruption</h3><p>La partie se conserve et reprend automatiquement à votre retour.</p></article>
            <article><h3>Quitter</h3><p>Un abandon ne donne ni score, ni XP, ni récompense. Il libère les trois jeux.</p></article></div>
          <p>Une seule partie active à la fois. Le premier participant est choisi au hasard. Le score est cumulatif et ne donne aucune récompense de classement.</p>
          <p>Jouez à la souris, au toucher, ou avec les flèches puis Entrée ou Espace.</p>
        </> : <>
          {tab === 'Memory' ? <><p>Retrouvez les paires de portraits. Une paire trouvée permet de rejouer ; sinon, mémorisez les deux cartes avant qu’elles soient masquées. Le plus grand nombre de paires gagne.</p>
            <table><caption>Plateau et mémoire de l’adversaire</caption><thead><tr><th>Difficulté</th><th>Plateau</th><th>Mémoire observée</th></tr></thead><tbody>
              <tr><th>Facile</th><td>4 × 4 · 8 paires</td><td>4 cartes · utilisation 50 %</td></tr>
              <tr><th>Moyen</th><td>5 × 5 · 12 paires, centre décoratif</td><td>12 cartes · utilisation 85 %</td></tr>
              <tr><th>Difficile</th><td>6 × 6 · 18 paires</td><td>36 cartes · utilisation 100 %</td></tr>
            </tbody></table><p>L’adversaire ne connaît que les cartes déjà révélées. Plus de paires améliore vos points ; une victoire rapporte toujours plus qu’une égalité, puis qu’une défaite.</p></>
            : <><p>{tab === 'Puissance 4' ? 'Alignez quatre jetons horizontalement, verticalement ou en diagonale. Choisissez une colonne : la gravité place le jeton sur sa case libre la plus basse.' : 'Alignez trois symboles horizontalement, verticalement ou en diagonale. Vous jouez le cercle cyan, l’adversaire la croix violette.'}</p>
              <p>En Facile, l’adversaire anticipe peu et fait davantage d’erreurs. En Moyen, il prépare plusieurs coups. En Difficile, il explore plus loin et fait moins d’erreurs.</p></>}
          <table><caption>Points par partie — score et XP si le quota est disponible</caption><thead><tr><th>Résultat</th><th>Facile</th><th>Moyen</th><th>Difficile</th></tr></thead><tbody>
            <tr><th>Défaite</th>{(tab === 'Memory' ? ['1–2', '1–4', '1–6'] : ['2', '3', '4']).map(value => <td key={value}>{value}</td>)}</tr>
            <tr><th>Égalité</th><td>3</td><td>5</td><td>7</td></tr>
            <tr><th>Victoire</th>{(tab === 'Memory' ? ['4–6', '6–8', '8–10'] : ['6', '8', '10']).map(value => <td key={value}>{value}</td>)}</tr>
          </tbody></table>
        </>}
      </div>
    </section>
  </div>, document.body)
}
