import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ElementKey, GachaHistoryDto, GachaHistoryResultDto, PlayerTeamsDto, TeamPassiveDto } from '../api/types'
import { historyDateLabel, historyResultLabel } from '../gacha/history-presentation'
import GachaDetailModal, { HistoryPanel, PassivesPanel } from './GachaDetailModal'

const historyResult: GachaHistoryResultDto = {
  operationId: 'op', operationPullCount: 1, occurredAt: '2026-09-06T20:25:20.778Z', index: 1,
  resultType: 'resource', character: null, rarity: null, resourceKey: 'moras', resourceAmount: '6614',
  wasNewCharacter: null, constellationAfter: null, copiesAfter: null, wasFiftyFifty: false, wonFiftyFifty: null,
  guaranteeConsumed: false, captureTriggered: false, bonusRewards: [], c6Progression: null, pity5AtPull: 74, pity4AtPull: 9,
}
const history: GachaHistoryDto = { page: 1, pageSize: 10, totalResults: 1, totalPages: 1, hasPrevious: false, hasNext: false, results: [historyResult] }
const elements: readonly ElementKey[] = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']
const displayNames: Readonly<Record<ElementKey, string>> = { pyro: 'Pyro', hydro: 'Hydro', cryo: 'Cryo', electro: 'Électro', anemo: 'Anémo', geo: 'Géo', dendro: 'Dendro' }
const passiveReference = elements.map((elementKey) => ({
  elementKey,
  displayName: displayNames[elementKey],
  levelOne: elementKey === 'anemo' ? '1 chance sur 12 de récupérer 80 Primos' : elementKey === 'dendro' ? '1 chance sur 25 : 40 Primos, 1 000 Moras et 5 particules de chaque élément' : `${elementKey} I`,
  levelTwo: elementKey === 'anemo' ? '1 chance sur 8 de récupérer 80 Primos' : elementKey === 'dendro' ? '1 chance sur 15 : 40 Primos, 1 000 Moras et 5 particules de chaque élément' : `${elementKey} II`,
}))
const passive = (elementKey: ElementKey, stacks: 1 | 2): TeamPassiveDto => ({ ...passiveReference.find((entry) => entry.elementKey === elementKey)!, stacks, description: `${elementKey} ${stacks === 1 ? 'I' : 'II'}` })
const teams = (activePassives: readonly TeamPassiveDto[] = [], inactivePassives: readonly TeamPassiveDto[] = []): PlayerTeamsDto => ({
  teams: [
    { id: 'active', position: 1, name: null, active: true, slots: [], passives: activePassives },
    { id: 'inactive', position: 2, name: null, active: false, slots: [], passives: inactivePassives },
  ],
  availableCharacters: [],
  passiveReference,
})

describe('GachaDetailModal', () => {
  it('renders as an internal overlay with accessible tabs and close control', () => {
    const html = renderToStaticMarkup(<GachaDetailModal teams={teams()} onClose={vi.fn()} onGetHistory={vi.fn()} />)
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

  it('removes the general notice and leaves every reference level neutral without an active passive', () => {
    const html = renderToStaticMarkup(<PassivesPanel teams={teams()} />)
    expect(html).not.toContain('Les passifs de votre Team active sont appliqués à vos Invocations.')
    expect(html).not.toContain('passive-level active')
    expect(html).not.toContain('>Actif<')
  })

  it('renders the seven textual passive headings without decorative assets and uses Primos copy', () => {
    const html = renderToStaticMarkup(<PassivesPanel teams={teams([passive('anemo', 1), passive('dendro', 2)])} />)
    for (const displayName of Object.values(displayNames)) expect(html).toContain(`<h3>${displayName}</h3>`)
    expect((html.match(/<h3>/g) ?? [])).toHaveLength(7)
    expect(html).not.toContain('gacha-passive-element-icon')
    expect(html).not.toMatch(/assets\/genshin\/elements/)
    expect(html).not.toContain('Primogemmes')
    expect((html.match(/Primos/g) ?? [])).toHaveLength(4)
    expect((html.match(/>Niveau I<\/strong>/g) ?? [])).toHaveLength(7)
    expect((html.match(/>Niveau II<\/strong>/g) ?? [])).toHaveLength(7)
    expect((html.match(/>Actif</g) ?? [])).toHaveLength(2)
  })

  it('highlights only Geo level I for one active stack', () => {
    const html = renderToStaticMarkup(<PassivesPanel teams={teams([passive('geo', 1)])} />)
    expect(html).toMatch(/data-element="geo"[\s\S]*passive-level active[\s\S]*Niveau I[\s\S]*>Actif<[\s\S]*passive-level"[\s\S]*Niveau II/)
  })

  it('highlights only Geo level II for two active stacks', () => {
    const html = renderToStaticMarkup(<PassivesPanel teams={teams([passive('geo', 2)])} />)
    const geo = html.slice(html.indexOf('data-element="geo"'), html.indexOf('data-element="dendro"'))
    expect(geo.match(/passive-level active/g)).toHaveLength(1)
    expect(geo).toMatch(/passive-level"[\s\S]*Niveau I[\s\S]*passive-level active[\s\S]*Niveau II[\s\S]*>Actif</)
  })

  it('highlights the precise levels for multiple active elements', () => {
    const html = renderToStaticMarkup(<PassivesPanel teams={teams([passive('pyro', 1), passive('geo', 2)])} />)
    expect((html.match(/passive-level active/g) ?? [])).toHaveLength(2)
    expect((html.match(/>Actif</g) ?? [])).toHaveLength(2)
  })

  it('ignores passives from a non-active Team', () => {
    const html = renderToStaticMarkup(<PassivesPanel teams={teams([], [passive('geo', 2)])} />)
    expect(html).not.toContain('passive-level active')
  })

  it('reflects an active-Team change from the supplied snapshot', () => {
    const first = renderToStaticMarkup(<PassivesPanel teams={teams([passive('pyro', 1)])} />)
    const next = renderToStaticMarkup(<PassivesPanel teams={teams([passive('geo', 2)])} />)
    expect(first).toMatch(/data-element="pyro"[\s\S]*passive-level active/)
    expect(next).toMatch(/data-element="geo"[\s\S]*passive-level"[\s\S]*passive-level active/)
  })

  it('keeps history progression and pagination while hiding persisted passive effects', () => {
    const withPassives: GachaHistoryResultDto = {
      ...historyResult,
      passiveEffects: [
        { elementKey: 'geo', type: 'secondary_reward_multiplier', numerator: 5, denominator: 4, amountBefore: '5000', amountAfter: '6250' },
        { elementKey: 'electro', type: 'pity5', amount: 2, requestedAmount: 2 },
      ],
    }
    const html = renderToStaticMarkup(<HistoryPanel history={{ ...history, results: [withPassives] }} loading={false} error={null} onPage={vi.fn()} />)
    expect(html).toContain('history-pagination')
    expect(html).toContain('Page 1 / 1')
    expect(html).not.toContain('Geo ·')
    expect(html).not.toContain('Electro ·')
    expect(html).toContain('<td>—</td>')
  })
})
