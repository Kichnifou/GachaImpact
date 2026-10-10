import type { EventHistoryDto } from '../api/types'

export default function EventDrawResult({ draw }: { draw: EventHistoryDto['entries'][number]['draw'] }) {
  return <section className="history-event-draw" aria-label="Résultat du tirage"><h3>Tirage mensuel</h3>
    {draw?.status === 'COMPLETED' && draw.winnerName ? <><p><strong>🏆 Gagnant du tirage : {draw.winnerName}</strong></p>{draw.reward && <p>✨ +{draw.reward.amount} {draw.reward.displayName}</p>}</>
      : draw?.status === 'NO_ELIGIBLE' ? <p>Aucun gagnant — aucun participant éligible.</p>
        : draw && ['PENDING', 'FROZEN'].includes(draw.status) ? <p>Tirage en cours de finalisation.</p>
          : draw?.status === 'COMPLETED' ? <p>Résultat du tirage indisponible.</p>
            : <p>Aucun tirage enregistré pour cette édition.</p>}
  </section>
}
