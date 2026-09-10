import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import type { ModerationPlayerDto, ModerationPlayerListQuery, ModerationPlayerPageDto, ModerationStateDto } from '../api/types'
import ModerationPlayerBrowser from '../components/ModerationPlayerBrowser'
import ScrollableScreenPanel from '../components/ScrollableScreenPanel'
import type { ModerationGachaInput, ModerationResourceInput, ModerationXpInput } from '../moderation/moderation-intent-coordinator'
import { apiErrorMessage } from '../utils/formatters'

type Props = {
  actorPlayerId: string
  capabilities: ModerationStateDto['permissions']['capabilities']
  onLoad: (targetPlayerId?: string) => Promise<ModerationStateDto>
  onListPlayers: (query: ModerationPlayerListQuery) => Promise<ModerationPlayerPageDto>
  onResource: (targetPlayerId: string, input: ModerationResourceInput) => Promise<ModerationStateDto>
  onXp: (targetPlayerId: string, input: ModerationXpInput) => Promise<ModerationStateDto>
  onGacha: (targetPlayerId: string, input: ModerationGachaInput) => Promise<ModerationStateDto>
  onStella: (targetPlayerId: string, quantity: string) => Promise<ModerationStateDto>
  onTester: (targetPlayerId: string, enabled: boolean) => Promise<ModerationStateDto>
  onApplied: (state: ModerationStateDto) => void
}

const resources = [['primogems', 'Primos'], ['moras', 'Moras'], ['particles_pyro', 'Pyro'], ['particles_hydro', 'Hydro'], ['particles_cryo', 'Cryo'], ['particles_electro', 'Electro'], ['particles_anemo', 'Anémo'], ['particles_geo', 'Géo'], ['particles_dendro', 'Dendro']] as const
const integerText = (value: string) => value.replace(/[^0-9]/g, '')

function ModerationScreen({ actorPlayerId, capabilities, onLoad, onListPlayers, onResource, onXp, onGacha, onStella, onTester, onApplied }: Props) {
  const [state, setState] = useState<ModerationStateDto | null>(null)
  const [selectedTargetId, setSelectedTargetId] = useState(actorPlayerId)
  const [query, setQuery] = useState('')
  const [players, setPlayers] = useState<readonly ModerationPlayerDto[]>([])
  const [browserOpen, setBrowserOpen] = useState(false)
  const [resourceKey, setResourceKey] = useState('primogems')
  const [amount, setAmount] = useState('160')
  const [xp, setXp] = useState('')
  const [pity5, setPity5] = useState('')
  const [pity4, setPity4] = useState('')
  const [capture, setCapture] = useState('')
  const [guarantee, setGuarantee] = useState(false)
  const [stella, setStella] = useState('0')
  const [pending, setPending] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const onLoadRef = useRef(onLoad)
  const onAppliedRef = useRef(onApplied)
  const requestRevision = useRef(0)
  const isSuper = capabilities.superTools
  const isSelf = selectedTargetId === actorPlayerId
  const canUseGameplayTools = capabilities.selfGameplayTools || isSuper

  useEffect(() => { onLoadRef.current = onLoad }, [onLoad])
  useEffect(() => { onAppliedRef.current = onApplied }, [onApplied])

  const hydrate = useCallback((value: ModerationStateDto) => {
    setXp(value.progression.totalXp)
    setPity5(String(value.gachaState.pity5))
    setPity4(String(value.gachaState.pity4))
    setCapture(String(value.gachaState.captureProgress))
    setGuarantee(value.gachaState.guaranteedFeatured5)
    setStella(value.stella.quantity)
  }, [])

  const accept = useCallback((value: ModerationStateDto) => {
    setState(value)
    setSelectedTargetId(value.player.id)
    hydrate(value)
    onAppliedRef.current(value)
    setMessage(null)
  }, [hydrate])

  useEffect(() => {
    const revision = ++requestRevision.current
    void onLoadRef.current()
      .then((value) => { if (requestRevision.current === revision) accept(value) })
      .catch((error) => { if (requestRevision.current === revision) setMessage(apiErrorMessage(error)) })
      .finally(() => { if (requestRevision.current === revision) setPending(false) })
    return () => { requestRevision.current += 1 }
  }, [accept, actorPlayerId])

  useEffect(() => {
    if (!isSuper || !query.trim()) return
    let active = true
    const timer = window.setTimeout(() => void onListPlayers({ query, page: 1, sort: 'name', direction: 'asc' }).then((value) => {
      if (active) setPlayers(value.players)
    }).catch((error) => {
      if (active) setMessage(apiErrorMessage(error))
    }), 120)
    return () => { active = false; window.clearTimeout(timer) }
  }, [isSuper, onListPlayers, query])

  const execute = async (action: () => Promise<ModerationStateDto>, afterSuccess?: () => void) => {
    if (pending) return
    const revision = ++requestRevision.current
    setPending(true)
    setMessage(null)
    try {
      const value = await action()
      if (requestRevision.current !== revision) return
      accept(value)
      afterSuccess?.()
    } catch (error) {
      if (requestRevision.current === revision) setMessage(apiErrorMessage(error))
    } finally {
      if (requestRevision.current === revision) setPending(false)
    }
  }
  const submit = (event: FormEvent, action: () => Promise<ModerationStateDto>) => { event.preventDefault(); void execute(action) }
  const selectTarget = (id: string) => {
    if (id === selectedTargetId) {
      setQuery('')
      setPlayers([])
      return
    }
    void execute(() => onLoadRef.current(id), () => { setQuery(''); setPlayers([]) })
  }

  return <div className="screen-content moderation-screen long-screen-layout">
    <ScrollableScreenPanel className="moderation-screen-panel">
      <section className="panel moderation-target" aria-busy={pending}>
        <div className="moderation-target-heading">
          <div><span className="eyebrow">Joueur ciblé</span><strong title={state?.player.displayName}>{state?.player.displayName ?? 'Chargement…'}</strong><small>Rang : {isSuper ? 'Super' : 'Testeur'}</small></div>
          {isSuper && <div className="moderation-target-actions"><button type="button" className="moderation-self-button" disabled={pending || isSelf} onClick={() => selectTarget(actorPlayerId)}>Moi</button><button type="button" className="moderation-self-button primary" disabled={pending} onClick={() => setBrowserOpen(true)}>Choisir</button></div>}
        </div>
        {isSuper && <label className="moderation-target-search"><span>Recherche rapide d’un joueur actif</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPlayers([]) }} placeholder="Saisir un pseudo…" autoComplete="off" /></label>}
        {isSuper && query.trim() && <div className="moderation-target-results" role="listbox" aria-label="Résultats de recherche">
          {players.length > 0 ? players.map((candidate) => <button type="button" role="option" aria-selected={candidate.id === selectedTargetId} className={candidate.id === selectedTargetId ? 'active' : ''} disabled={pending} onClick={() => selectTarget(candidate.id)} key={candidate.id}>
            <span className="moderation-player-identity"><strong title={candidate.displayName}>{candidate.displayName}</strong><small>Niveau {candidate.level}</small></span>
            {candidate.tester && <span className="moderation-tester-badge">Testeur</span>}
          </button>) : <p className="moderation-target-empty">Aucun joueur trouvé.</p>}
        </div>}
      </section>
      {message && <p className="moderation-feedback error" role="alert">{message}</p>}
      <div className="moderation-grid">
        <form className="panel moderation-tool" onSubmit={(event) => submit(event, () => onResource(selectedTargetId, { resourceKey, amount, direction: 'add' }))}><h2>Ressources</h2><label>Ressource<select value={resourceKey} onChange={(event) => setResourceKey(event.target.value)}>{resources.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Montant<input inputMode="numeric" pattern="[0-9]*" required value={amount} onChange={(event) => setAmount(integerText(event.target.value))} /></label><div className="moderation-actions"><button disabled={pending}>Ajouter</button><button type="button" disabled={pending} onClick={() => void execute(() => onResource(selectedTargetId, { resourceKey, amount, direction: 'remove' }))}>Retirer</button></div></form>
        {canUseGameplayTools && <>
          <form className="panel moderation-tool" onSubmit={(event) => submit(event, () => onXp(selectedTargetId, { totalXp: xp }))}><h2>Progression</h2><label>XP totale<input inputMode="numeric" pattern="[0-9]*" required value={xp} onChange={(event) => setXp(integerText(event.target.value))} /></label><div className="moderation-actions"><button disabled={pending}>Définir l’XP</button><button type="button" disabled={pending} onClick={() => void execute(() => onXp(selectedTargetId, { prepareNextLevel: true }))}>Préparer prochain niveau</button></div>{state && <small>Niveau {state.progression.level} · {state.progression.xpIntoCurrentStep} / {state.progression.xpPerStep} XP</small>}</form>
          <form className="panel moderation-tool" onSubmit={(event) => submit(event, () => onGacha(selectedTargetId, { pity5: Number(pity5), pity4: Number(pity4), captureProgress: Number(capture), guaranteedFeatured5: guarantee }))}><h2>Gacha</h2><div className="moderation-inline"><label>Pity 5★<input inputMode="numeric" pattern="[0-9]*" required value={pity5} onChange={(event) => setPity5(integerText(event.target.value))} /></label><button type="button" onClick={() => setPity5('89')}>89</button><label>Pity 4★<input inputMode="numeric" pattern="[0-9]*" required value={pity4} onChange={(event) => setPity4(integerText(event.target.value))} /></label><button type="button" onClick={() => setPity4('9')}>9</button></div><label>Capture (0–3)<input inputMode="numeric" pattern="[0-9]*" required value={capture} onChange={(event) => setCapture(integerText(event.target.value))} /></label><label className="moderation-check"><input type="checkbox" checked={guarantee} onChange={(event) => setGuarantee(event.target.checked)} />Garantie 5★</label><button disabled={pending}>Appliquer</button></form>
          <form className="panel moderation-tool" onSubmit={(event) => submit(event, () => onStella(selectedTargetId, stella))}><h2>Objets</h2><label>Masterless Stella Fortuna<input inputMode="numeric" pattern="[0-9]*" required value={stella} onChange={(event) => setStella(integerText(event.target.value))} /></label><button disabled={pending}>Définir la quantité</button></form>
          {isSuper && !isSelf && <section className="panel moderation-tool moderation-role"><h2>Testeur</h2><p>{state?.player.tester ? 'Ce joueur possède actuellement le rôle Testeur.' : 'Ce joueur ne possède pas le rôle Testeur.'}</p><button disabled={pending} type="button" onClick={() => void execute(() => onTester(selectedTargetId, !state?.player.tester))}>{state?.player.tester ? 'Retirer Testeur' : 'Attribuer Testeur'}</button></section>}
        </>}
      </div>
    </ScrollableScreenPanel>
    {browserOpen && <ModerationPlayerBrowser selectedPlayerId={selectedTargetId} onListPlayers={onListPlayers} onConfirm={(playerId) => { setBrowserOpen(false); selectTarget(playerId) }} onClose={() => setBrowserOpen(false)} />}
  </div>
}

export default ModerationScreen
