import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { GachaHistoryDto, GachaHistoryResultDto } from '../api/types'
import { historyDateLabel, historyResultLabel } from '../gacha/history-presentation'
import GachaDetailModal, { HistoryPanel, PassivesPanel } from './GachaDetailModal'

const historyResult: GachaHistoryResultDto = {
  operationId: 'op', operationPullCount: 1, occurredAt: '2026-09-06T20:25:20.778Z', index: 1,
  resultType: 'resource', character: null, rarity: null, resourceKey: 'moras', resourceAmount: '6614',
  wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null,
  guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null, pity5AtPull: 74, pity4AtPull: 9,
}
const history: GachaHistoryDto = { page: 1, pageSize: 10, totalResults: 1, totalPages: 1, hasPrevious: false, hasNext: false, results: [historyResult] }

describe('GachaDetailModal', () => {
  it('renders as an internal overlay with accessible tabs and close control', () => {
    const html = renderToStaticMarkup(<GachaDetailModal onClose={vi.fn()} onGetHistory={vi.fn()} />)
    expect(html).toContain('gacha-detail-overlay')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('>Historique<')
    expect(html).toContain('>Probabilités<')
    expect(html).toContain('>Passifs<')
    expect(html).toContain('aria-label="Fermer le détail"')
    expect(html).toContain('Chargement de l’historique')
  })

  it('keeps date and time while shortening columns and showing only five-star pity', () => {
    const html = renderToStaticMarkup(<HistoryPanel history={history} loading={false} error={null} onPage={vi.fn()} />)
    const dateLabel = historyDateLabel(historyResult.occurredAt)
    expect(html).toContain('<th>Date</th>')
    expect(html).toContain('<th>Événement</th>')
    expect(html).not.toContain('Date/heure')
    expect(html).not.toContain('Événement Gacha')
    expect(html).toContain('<td>74</td>')
    expect(html).not.toContain('5★ : 74')
    expect(html).not.toContain('4★ : 9')
    expect(dateLabel).toMatch(/06\/09\/2026[\s\S]*\d{2}:25/)
    expect(html).toContain(dateLabel)
  })

  it('renders an x10 history in the newest-first sequential order supplied by the API', () => {
    const results = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((index) => ({
      ...historyResult,
      operationId: 'x10-operation',
      operationPullCount: 10 as const,
      index,
      resourceAmount: String(6000 + index),
    }))
    const html = renderToStaticMarkup(<HistoryPanel history={{ ...history, totalResults: 10, results }} loading={false} error={null} onPage={vi.fn()} />)
    expect(html.indexOf(historyResultLabel(results[0]!))).toBeLessThan(html.indexOf(historyResultLabel(results[1]!)))
    expect(html.indexOf(historyResultLabel(results[1]!))).toBeLessThan(html.indexOf(historyResultLabel(results[9]!)))
    expect((html.match(/<tr>/g) ?? [])).toHaveLength(11)
  })

  it('keeps useful passives without implying that their Invocation effects are already active', () => {
    const html = renderToStaticMarkup(<PassivesPanel />)
    expect(html).toContain('Les effets de votre Team active sur les Invocations seront activés prochainement.')
    expect(html).not.toContain('passifs de votre Équipe active')
    expect(html).not.toContain('Équipe serveur')
    expect(html).not.toContain('Maximum 2 stacks')
    expect(html).not.toContain('après la résolution du Pull')
  })
})
