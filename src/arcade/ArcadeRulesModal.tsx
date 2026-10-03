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
      <div data-tutorial-anchor="arcade-rules" className="arcade-rules-body">
        {tab === 'Général' ? <>
          <p>En multijoueur, chaque participant gagne son score. Aucune XP ni récompense de progression ; un abandon ne compte pour personne. La difficulté fixe le plateau Memory et le barème. Les XP ci-dessous concernent le solo.</p><div className="arcade-rule-cards"><article><h3>XP par jour</h3><p>Jusqu’à 10 XP par jeu</p><strong>30 XP maximum</strong></article>
            <article><h3>Parties suivantes</h3><p>Score uniquement. Obtenable à l’infini.</p><em>Deviens le plus fort de tes amis !</em></article>
            <article><h3>Interruption</h3><p>La partie se conserve tant qu’elle n’est pas terminée.</p><p>Impossible de jouer à un autre jeu tant qu’une partie n’est pas finie.</p></article>
            <article><h3>Quitter</h3><p>Un abandon ne donne ni score ni XP.</p></article></div>
        </> : <>
          {tab === 'Memory' ? <><p>Retrouvez les paires de portraits. Une paire trouvée permet de rejouer ; sinon, mémorisez les deux cartes avant qu’elles soient masquées. Le plus grand nombre de paires gagne.</p>
            <table><caption>Plateau et mémoire de l’IA en solo</caption><thead><tr><th>Difficulté</th><th>Plateau</th><th>Mémoire de l’IA (solo)</th></tr></thead><tbody>
              <tr><th>Facile</th><td>4 × 4 · 8 paires</td><td>4 cartes</td></tr>
              <tr><th>Moyen</th><td>5 × 5 · 12 paires, centre décoratif</td><td>12 cartes</td></tr>
              <tr><th>Difficile</th><td>6 × 6 · 18 paires</td><td>Toutes les cartes révélées</td></tr>
            </tbody></table><p>En solo, l’adversaire ne connaît que les cartes déjà révélées. Plus de paires améliore vos points ; une victoire rapporte toujours plus qu’une égalité, puis qu’une défaite.</p></>
            : <><p>{tab === 'Puissance 4' ? 'Alignez quatre jetons horizontalement, verticalement ou en diagonale. Choisissez une colonne : la gravité place le jeton sur sa case libre la plus basse.' : 'Alignez trois symboles horizontalement, verticalement ou en diagonale. En solo, vous jouez le cercle cyan, l’adversaire la croix violette. En multijoueur, le cercle cyan appartient à l’invitant et la croix violette à l’invité.'}</p>
              <p>En solo : en Facile, l’adversaire anticipe peu et fait davantage d’erreurs. En Moyen, il prépare plusieurs coups. En Difficile, il explore plus loin et fait moins d’erreurs.</p></>}
          <table><caption>Points par partie — score, et XP en solo si le quota est disponible</caption><thead><tr><th>Résultat</th><th>Facile</th><th>Moyen</th><th>Difficile</th></tr></thead><tbody>
            <tr><th>Défaite</th>{(tab === 'Memory' ? ['1–2', '1–4', '1–6'] : ['2', '3', '4']).map(value => <td key={value}>{value}</td>)}</tr>
            <tr><th>Égalité</th><td>3</td><td>5</td><td>7</td></tr>
            <tr><th>Victoire</th>{(tab === 'Memory' ? ['4–6', '6–8', '8–10'] : ['6', '8', '10']).map(value => <td key={value}>{value}</td>)}</tr>
          </tbody></table>
        </>}
      </div>
    </section>
  </div>, document.body)
}
