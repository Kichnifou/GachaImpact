import { useEffect, useState, type FormEvent } from 'react'
import type { ModerationStateDto } from '../api/types'
import type { ModerationGachaInput, ModerationResourceInput, ModerationXpInput } from '../moderation/moderation-intent-coordinator'
import { apiErrorMessage } from '../utils/formatters'

type Props = {
  onLoad: () => Promise<ModerationStateDto>
  onResource: (input: ModerationResourceInput) => Promise<ModerationStateDto>
  onXp: (input: ModerationXpInput) => Promise<ModerationStateDto>
  onGacha: (input: ModerationGachaInput) => Promise<ModerationStateDto>
  onStella: (quantity: string) => Promise<ModerationStateDto>
  onApplied: (state: ModerationStateDto) => void
}

const resources = [
  ['primogems', 'Primos'], ['moras', 'Moras'], ['particles_pyro', 'Pyro'], ['particles_hydro', 'Hydro'],
  ['particles_cryo', 'Cryo'], ['particles_electro', 'Electro'], ['particles_anemo', 'Anemo'],
  ['particles_geo', 'Geo'], ['particles_dendro', 'Dendro'],
] as const

function ModerationScreen({ onLoad, onResource, onXp, onGacha, onStella, onApplied }: Props) {
  const [state, setState] = useState<ModerationStateDto | null>(null)
  const [resourceKey, setResourceKey] = useState('primogems')
  const [amount, setAmount] = useState('160')
  const [xp, setXp] = useState('')
  const [pity5, setPity5] = useState('')
  const [pity4, setPity4] = useState('')
  const [capture, setCapture] = useState('')
  const [guarantee, setGuarantee] = useState(false)
  const [stella, setStella] = useState('0')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  function hydrate(value: ModerationStateDto) { setXp(value.progression.totalXp); setPity5(String(value.gachaState.pity5)); setPity4(String(value.gachaState.pity4)); setCapture(String(value.gachaState.captureProgress)); setGuarantee(value.gachaState.guaranteedFeatured5); setStella(value.stella.quantity) }
  useEffect(() => { let active = true; void onLoad().then((value) => { if (active) { setState(value); hydrate(value) } }).catch((error) => { if (active) setMessage(apiErrorMessage(error)) }); return () => { active = false } }, [onLoad])
  const execute = async (action: () => Promise<ModerationStateDto>) => { if (pending) return; setPending(true); setMessage(null); try { const next = await action(); setState(next); hydrate(next); onApplied(next); setMessage('État de test mis à jour.') } catch (error) { setMessage(apiErrorMessage(error)) } finally { setPending(false) } }
  const submit = (event: FormEvent, action: () => Promise<ModerationStateDto>) => { event.preventDefault(); void execute(action) }
  return <div className="screen-content moderation-screen">
    <header className="moderation-title"><span className="eyebrow">Modération</span><h1>Outils de test</h1><p>Préparez votre propre profil sans affecter les statistiques de jeu.</p></header>
    {message && <p className="moderation-feedback" role="status">{message}</p>}
    <div className="moderation-grid">
      <form className="panel moderation-tool" onSubmit={(event) => submit(event, () => onResource({ resourceKey, amount, direction: 'add' }))}><h2>Ressources</h2><label>Ressource<select value={resourceKey} onChange={(event) => setResourceKey(event.target.value)}>{resources.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Montant<input type="number" min="1" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label><div className="moderation-actions"><button disabled={pending}>Ajouter</button><button type="button" disabled={pending} onClick={() => void execute(() => onResource({ resourceKey, amount, direction: 'remove' }))}>Retirer</button></div></form>
      <form className="panel moderation-tool" onSubmit={(event) => submit(event, () => onXp({ totalXp: xp }))}><h2>Progression</h2><label>XP totale<input type="number" min="0" max="2999" step="1" required value={xp} onChange={(event) => setXp(event.target.value)} /></label><div className="moderation-actions"><button disabled={pending}>Définir l’XP</button><button type="button" disabled={pending} onClick={() => void execute(() => onXp({ prepareNextLevel: true }))}>Préparer prochain niveau</button></div>{state && <small>Niveau {state.progression.level} · {state.progression.xpIntoCurrentStep} / {state.progression.xpPerStep} XP</small>}</form>
      <form className="panel moderation-tool" onSubmit={(event) => submit(event, () => onGacha({ pity5: Number(pity5), pity4: Number(pity4), captureProgress: Number(capture), guaranteedFeatured5: guarantee }))}><h2>Gacha</h2><div className="moderation-inline"><label>Pity 5★<input type="number" min="0" max="89" step="1" required value={pity5} onChange={(event) => setPity5(event.target.value)} /></label><button type="button" onClick={() => setPity5('89')}>89</button><label>Pity 4★<input type="number" min="0" max="9" step="1" required value={pity4} onChange={(event) => setPity4(event.target.value)} /></label><button type="button" onClick={() => setPity4('9')}>9</button></div><label>Capture (0–3)<input type="number" min="0" max="3" step="1" required value={capture} onChange={(event) => setCapture(event.target.value)} /></label><label className="moderation-check"><input type="checkbox" checked={guarantee} onChange={(event) => setGuarantee(event.target.checked)} />Garantie 5★</label><button disabled={pending}>Appliquer</button></form>
      <form className="panel moderation-tool" onSubmit={(event) => submit(event, () => onStella(stella))}><h2>Objets</h2><label>Masterless Stella Fortuna<input type="number" min="0" step="1" required value={stella} onChange={(event) => setStella(event.target.value)} /></label><button disabled={pending}>Définir la quantité</button></form>
    </div>
  </div>
}

export default ModerationScreen
