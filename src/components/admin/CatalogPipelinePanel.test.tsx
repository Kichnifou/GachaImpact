// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CatalogCandidate, CatalogOverview } from '../../api/catalog-types'
const api = vi.hoisted(() => ({ getCatalogCandidates: vi.fn(), getCatalogCandidate: vi.fn(), editCatalogCandidate: vi.fn(), checkCatalogCandidate: vi.fn(), checkCatalogCandidates:vi.fn(), setCatalogTracking:vi.fn(), uploadCatalogImage: vi.fn(), overrideCatalogWindow: vi.fn() }))
vi.mock('../../api/game-api', () => ({ getGameApiClient: () => api }))
import CatalogPipelinePanel from './CatalogPipelinePanel'
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const candidate: CatalogCandidate = { id: '00000000-0000-4000-8000-000000000001', characterId: null, name: 'Mitya', status: 'INCOMPLETE',
  fields: { originalName: { value: 'Mitya', provider: 'hoyoverse', url: 'https://www.hoyolab.com/article/46884007', fetchedAt: '2026-10-11T10:00:00Z', reliability: 'OFFICIAL' } },
  missing: ['rarity', 'officialReleaseDate', 'icon'], assets: [], discoveredAt: '2026-10-11T10:00:00Z', checkedAt: null, nextCheckAt: '2026-10-12T10:00:00Z', publishedAt: null,
  officialReleaseDate: null, revision: 0, identities: [], attempts: [], trackingState:'ACTIVE',trackingElements:['rarity','icon'] }
const overview: CatalogOverview = { entries: [candidate], runs: [], job: null, enabled: true, dryRun: false, publicationEnabled: false, storageConfigured: false }
let root: Root, container: HTMLDivElement
async function mount(initialId?: string) { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => { root.render(<CatalogPipelinePanel initialId={initialId} />) }) }
const button = (name: string) => Array.from((document.body.querySelector('[role=dialog]')??document.body).querySelectorAll<HTMLButtonElement>('button')).find(value => (value.getAttribute('aria-label')??value.textContent)?.includes(name))!
const dialog = () => document.body.querySelector<HTMLElement>('[role=dialog]')!
async function click(element: HTMLElement) { await act(async () => element.click()) }
async function tab(name:string){await click(Array.from(dialog().querySelectorAll<HTMLElement>('[role=tab]')).find(value=>value.textContent===name)!)}
async function edit(){await tab('Informations');await click(button('Corriger volontairement'))}
beforeEach(() => { vi.resetAllMocks(); api.getCatalogCandidates.mockResolvedValue(overview); api.getCatalogCandidate.mockResolvedValue(candidate)
  for (const action of [api.editCatalogCandidate, api.checkCatalogCandidate, api.uploadCatalogImage, api.overrideCatalogWindow]) action.mockResolvedValue({ operationId: 'fixture', alreadyProcessed: false }) })
afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove() })
describe('Character import ADMIN surface', () => {
  it('wraps keyboard focus through a closed advanced summary without targeting its invisible fields',async()=>{
    await mount(candidate.id);const close=dialog().querySelector<HTMLButtonElement>('[aria-label="Fermer la fiche"]')!,summary=dialog().querySelector<HTMLElement>('summary')!;
    close.focus();await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true})));
    expect(document.activeElement).toBe(summary);
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));
    expect(document.activeElement).toBe(close);
  })
  it('supports roving keyboard tabs and shows current information before voluntary editing',async()=>{
    await mount(candidate.id);const tabs=dialog().querySelectorAll<HTMLButtonElement>('[role=tab]');
    await act(async()=>tabs[0]!.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})));
    expect(tabs[3]!.getAttribute('aria-selected')).toBe('true');expect(document.activeElement).toBe(tabs[3]);
    await act(async()=>tabs[3]!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');await tab('Informations');
    expect(dialog().textContent).toContain('Mitya');expect(dialog().querySelector('form')).toBeNull();
  })
  it('refreshes stored detail once while pending and announces completion',async()=>{
    await mount(candidate.id);let resolve!:(value:CatalogCandidate)=>void;
    api.getCatalogCandidate.mockReturnValueOnce(new Promise<CatalogCandidate>(done=>{resolve=done}));
    const refresh=button('Actualiser');await act(async()=>{refresh.click();refresh.click()});
    expect(api.getCatalogCandidate).toHaveBeenCalledTimes(2);expect(refresh.disabled).toBe(true);
    await act(async()=>resolve(candidate));expect(dialog().textContent).toContain('Lecture terminée.');expect(dialog().querySelector('.moderation-feedback')).toBeNull();
  })
  it('disables collection on a protected fiche and never promises an old daily deadline when OFF',async()=>{
    api.getCatalogCandidates.mockResolvedValue({...overview,enabled:false});api.getCatalogCandidate.mockResolvedValue({...candidate,trackingState:'PROTECTED',trackingElements:[]});
    await mount(candidate.id);expect(button('Rechercher des mises à jour').disabled).toBe(true);expect(button('Vérifier sans appliquer').disabled).toBe(true);
    expect(dialog().textContent).toContain('Suivi suspendu');expect(dialog().textContent).not.toContain('12/10/2026');
  })
  it('explains found/missing/retry and blocked storage without offering a blind publication', async () => {
    await mount(); expect(container.textContent).toContain('Stockage : à configurer'); await click(button('Consulter'))
    expect(dialog().textContent).toContain('Date officielle'); expect(dialog().textContent).toContain('En préparation')
    expect(button('Autoriser la publication anticipée').disabled).toBe(true)
    await tab('Informations')
    expect(dialog().querySelector('a')?.getAttribute('href')).toContain('hoyolab.com/article/46884007')
    await tab('Images'); expect(button('Valider et téléverser').disabled).toBe(true)
    expect(dialog().querySelector('textarea')).toBeNull()
  })
  it('opens the exact candidate intent, traps focus and restores the background on close', async () => {
    await mount(candidate.id); expect(api.getCatalogCandidate).toHaveBeenCalledWith(candidate.id)
    expect(container.hasAttribute('inert')).toBe(true); expect(dialog().contains(document.activeElement)).toBe(true)
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.body.querySelector('[role=dialog]')).toBeNull(); expect(container.hasAttribute('inert')).toBe(false)
  })
  it('queues audit separately from retry, retaining the exact key on ambiguous failure', async () => {
    await mount(candidate.id); api.checkCatalogCandidate.mockRejectedValueOnce({ code: 'NETWORK_ERROR' })
    await click(button('Vérifier sans appliquer')); expect(dialog().textContent).toContain('momentanément inaccessible')
    await click(button('Vérifier sans appliquer'))
    expect(api.checkCatalogCandidate.mock.calls[0]).toEqual(api.checkCatalogCandidate.mock.calls[1]); expect(api.checkCatalogCandidate.mock.calls[1]?.[1]).toBe('audit')
    await click(button('Rechercher des mises à jour')); expect(api.checkCatalogCandidate.mock.calls.at(-1)?.[1]).toBe('retry')
  })
  it('shows loading, empty and failed lists with a recoverable refresh', async () => {
    let resolve!: (value: CatalogOverview) => void
    api.getCatalogCandidates.mockReturnValueOnce(new Promise<CatalogOverview>(done => { resolve = done }))
    await mount(); expect(container.textContent).toContain('Chargement des candidats')
    await act(async () => resolve({ ...overview, entries: [] })); expect(container.textContent).toContain('Aucun candidat')
    api.getCatalogCandidates.mockRejectedValueOnce({ code: 'NETWORK_ERROR' }); await click(button('Actualiser'))
    expect(container.querySelector('[role=alert]')?.textContent).toContain('momentanément inaccessible')
    await click(button('Actualiser')); expect(container.textContent).toContain('Mitya')
  })
  it('sends a typed metadata patch and blocks controls while the request is pending', async () => {
    await mount(candidate.id); await edit()
    const rarity = Array.from(dialog().querySelectorAll('select')).find(value => value.parentElement?.textContent?.includes('Rareté'))!
    await act(async () => { rarity.value = '5'; rarity.dispatchEvent(new Event('change', { bubbles: true })) })
    let resolve!: () => void; api.editCatalogCandidate.mockReturnValueOnce(new Promise<void>(done => { resolve = done }))
    await act(async () => dialog().querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.editCatalogCandidate).toHaveBeenCalledWith(candidate.id, { rarity: 5 }, expect.any(String))
    expect(button('Enregistrer les corrections').disabled).toBe(true)
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(dialog()).not.toBeNull(); await act(async () => resolve())
  })
  it('shows existing local assets as available in a historical Character fiche', async () => {
    api.getCatalogCandidate.mockResolvedValue({ ...candidate, characterId: 'character', character: { iconPath: '/assets/icon.png', splashPath: '/assets/splash.png', wishPath: null, fullbodyPath: null } })
    await mount(candidate.id); await tab('Images'); expect(dialog().textContent?.match(/Disponible dans le catalogue/g)).toHaveLength(2)
  })
  it('keeps candidate controls usable when closing during a post-edit refresh', async () => {
    await mount(candidate.id); await edit()
    let resolveDetail!: (value: CatalogCandidate) => void
    api.getCatalogCandidate.mockReturnValueOnce(new Promise<CatalogCandidate>(done => { resolveDetail = done }))
    const rarity = dialog().querySelector<HTMLSelectElement>('form select')!
    await act(async () => { rarity.value = '5'; rarity.dispatchEvent(new Event('change', { bubbles: true })) })
    await act(async () => dialog().querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(api.getCatalogCandidate).toHaveBeenCalledTimes(2)
    await click(dialog().querySelector<HTMLButtonElement>('button[aria-label="Fermer la fiche"]')!)
    expect(document.body.querySelector('[role=dialog]')).toBeNull()
    expect(button('Consulter').disabled).toBe(false)
    await act(async () => resolveDetail(candidate))
    expect(button('Consulter').disabled).toBe(false)
    expect(document.body.querySelector('[role=dialog]')).toBeNull()
    await click(button('Consulter'))
    expect(dialog().textContent).toContain('Mitya')
  })
  it('uploads a selected image through the authenticated typed API and shows storage failure without losing the fiche', async () => {
    api.getCatalogCandidates.mockResolvedValue({ ...overview, storageConfigured: true })
    api.uploadCatalogImage.mockRejectedValueOnce({ code: 'CATALOG_STORAGE_UNAVAILABLE' })
    await mount(candidate.id); await tab('Images')
    const input = dialog().querySelector<HTMLInputElement>('input[type=file]')!
    Object.defineProperty(input, 'files', { value: [new File(['private-image'], 'portrait.png', { type: 'image/png' })] })
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
    expect(button('Valider et téléverser').disabled).toBe(false)
    await click(button('Valider et téléverser'))
    await vi.waitFor(() => expect(api.uploadCatalogImage).toHaveBeenCalledWith(candidate.id,
      expect.objectContaining({ role: 'icon', mime: 'image/png', base64: btoa('private-image'), idempotencyKey: expect.any(String) })))
    expect(dialog().textContent).toContain('Le stockage des images doit être configuré')
    expect(dialog().textContent).toContain('Mitya')
  })
})
