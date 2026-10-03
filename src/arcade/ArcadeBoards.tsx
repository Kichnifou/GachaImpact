import type { CSSProperties, KeyboardEvent } from 'react'
import type { ArcadeBoard, ArcadeSide } from '../api/arcade-types'
import AppButton from '../components/AppButton'
import CharacterPortraitFrame from '../components/CharacterPortraitFrame'

function navigate(event: KeyboardEvent<HTMLElement>, width: number) {
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -width, ArrowDown: width }[event.key]
  if (delta === undefined) return
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, .arcade-memory-decorative'))
  const current = buttons.indexOf(document.activeElement as HTMLElement)
  if (current < 0) return
  event.preventDefault()
  for (let distance = 1; distance <= buttons.length; distance++) {
    const next = buttons[(current + delta * distance % buttons.length + buttons.length) % buttons.length]!
    if (next instanceof HTMLButtonElement && !next.disabled) { next.focus(); break }
  }
}
type Props = { viewerSide?: ArcadeSide; board: ArcadeBoard; disabled: boolean; onMove: (position: number) => void }
export default function ArcadeBoards({ board, disabled, onMove, viewerSide = 'PLAYER' }: Props) {
  // Immutable V1 receipts predate the layout DTO; a replay is followed by a fresh overview.
  const columns = board.kind === 'MEMORY' ? board.columns ?? 6 : 0
  if (board.kind === 'MEMORY') return <div className="arcade-memory" style={{ '--memory-columns': columns } as CSSProperties} role="group" aria-label={`Memory, ${columns} lignes et ${columns} colonnes`} onKeyDown={event => navigate(event, columns)}>
    {board.cards.map(card => card.status === 'BLOCKED' ? <span key={card.position} className="arcade-memory-decorative" role="img" aria-label="Case centrale décorative">✦</span> : <AppButton key={card.position} className={`arcade-memory-card ${card.status.toLowerCase()} ${'owner' in card ? card.owner?.toLowerCase() ?? '' : ''}`}
      disabled={disabled || card.status !== 'HIDDEN' || board.phase !== 'PICK'} onClick={() => onMove(card.position)}
      aria-label={!('face' in card) ? `Carte cachée ${card.position + 1}` : `${card.face.name}${card.status === 'MATCHED' ? card.owner === viewerSide ? ', paire à vous' : ', paire adverse' : ', révélée'}`}>
      {!('face' in card) ? <span className="arcade-card-back" aria-hidden="true">✦</span> : <><CharacterPortraitFrame characterName={card.face.name} element={card.face.elementKey} assetPaths={card.face.assetPaths}
        frameClassName="arcade-portrait" imageClassName="arcade-portrait-image" /><span className="arcade-card-name">{card.face.name}</span>{card.status === 'MATCHED' && <span className="arcade-card-owner" aria-hidden="true">{card.owner === 'PLAYER' ? '●' : '◆'}</span>}</>}
    </AppButton>)}
  </div>
  if (board.kind === 'TIC_TAC_TOE') return <div className="arcade-tic" role="group" aria-label="Morpion, 3 lignes et 3 colonnes" onKeyDown={event => navigate(event, 3)}>
    {board.cells.map((side, index) => <AppButton key={index} className={`arcade-cell ${side?.toLowerCase() ?? ''}${board.winningCells.includes(index) ? ' winning' : ''}`}
      disabled={disabled || side !== null} onClick={() => onMove(index)} aria-label={`Case ${index + 1}, ${side === viewerSide ? (side === 'PLAYER' ? 'votre cercle' : 'votre croix') : side ? (side === 'PLAYER' ? 'cercle adverse' : 'croix adverse') : 'libre'}`}>{side && <span className={`arcade-mark ${side.toLowerCase()}`} aria-hidden="true" />}</AppButton>)}
  </div>
  return <div className="arcade-connect" role="group" aria-label="Puissance 4, 7 colonnes et 6 lignes">
    <div className="arcade-columns" onKeyDown={event => navigate(event, 7)}>{Array.from({ length: 7 }, (_, column) => <AppButton key={column} disabled={disabled || board.cells[column] !== null}
      onClick={() => onMove(column)} aria-label={`Jouer colonne ${column + 1}`}>↓</AppButton>)}</div>
    <div className="arcade-connect-grid">{board.cells.map((side, index) => <span key={index} className={`arcade-disc ${side?.toLowerCase() ?? ''}${board.winningCells.includes(index) ? ' winning' : ''}${board.lastMove === index ? ' last' : ''}`}
      aria-label={`Ligne ${Math.floor(index / 7) + 1}, colonne ${index % 7 + 1} : ${side === viewerSide ? 'vous' : side ? 'adversaire' : 'vide'}`}>{side && <span className={`arcade-token ${side.toLowerCase()}`} aria-hidden="true" />}</span>)}</div>
  </div>
}
