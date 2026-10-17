import './contest-title-badge.css'

export const contestStatThemes = { strength: 'STRENGTH', intelligence: 'INTELLIGENCE', beauty: 'BEAUTY', charisma: 'CHARISMA', popularity: 'POPULARITY' } as const

export default function ContestTitleBadge({ title, rank }: { title: string | null | undefined; rank: number }) {
  if (!title || rank < 1 || rank > 4) return null
  return <span className="contest-title-badge" data-rank={rank}>{title}</span>
}
