import { useEffect, useRef, useState } from 'react'
import type { DailyCombatDto, DailyCombatCompositionInput } from '../api/types'
import { ApiError } from '../api/game-api'
import { apiErrorMessage } from '../utils/formatters'
import { CharacterSelector } from '../team/CharacterSelector'
import { filterTeamCharacters, type TeamElementFilter } from '../team/team-presentation'
import { pinOpeningCharacters, toggleComposition } from '../team/quick-composition'

export const combatCompositionIds = (value: DailyCombatDto) => [1, 2, 3, 4].map(position => value.loadout.slots.find(slot => slot.position === position)?.character?.id ?? null)

export default function CombatFormationSelector({ value, position, onSetSlot, onReplace, onReload, onClose, onBusy }: { value: DailyCombatDto; position: number | null; onSetSlot: (position:number,id:string)=>Promise<DailyCombatDto>; onReplace?: (input:DailyCombatCompositionInput)=>Promise<DailyCombatDto>; onReload?: ()=>Promise<DailyCombatDto>; onClose:()=>void; onBusy:(busy:boolean)=>void }) {
  const [opening] = useState(() => value.loadout.slots.flatMap(slot => slot.character ? [{...slot.character,classKey:null}] : []))
  const [expected, setExpected] = useState(() => ({ ids:combatCompositionIds(value), mode:value.loadout.nextAttemptMode, encounterId:value.encounter.id }))
  const [draft, setDraft] = useState(() => combatCompositionIds(value)), [choice, setChoice] = useState(() => position === null ? null : combatCompositionIds(value)[position - 1])
  const [search,setSearch] = useState(''), [element,setElement] = useState<TeamElementFilter>('all')
  const [pending,setPending] = useState(false), [ambiguous,setAmbiguous] = useState(false), [conflict,setConflict] = useState(false), [error,setError] = useState<string|null>(null)
  const key = useRef<string|null>(null), busy = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const run = async (action:()=>Promise<void>) => {
    if (busy.current) return
    busy.current = true; setPending(true); onBusy(true)
    try { await action() } finally { busy.current = false; onBusy(false); if (mounted.current) setPending(false) }
  }
  const confirm = () => void run(async () => {
    if (conflict) return
    if (position !== null && choice === expected.ids[position - 1]) { onClose(); return }
    if (position !== null && !choice) return
    setError(null)
    try {
      if (position !== null) await onSetSlot(position,choice!)
      else {
        if (!onReplace) return
        key.current ??= crypto.randomUUID()
        await onReplace({characterIds:draft,expectedCharacterIds:expected.ids,expectedMode:expected.mode,encounterId:expected.encounterId,idempotencyKey:key.current})
      }
      if (mounted.current) onClose()
    } catch (reason) {
      if (!mounted.current) return
      const definitive = reason instanceof ApiError && reason.status !== null && reason.status >= 400 && reason.status < 500 && reason.status !== 408
      setConflict(reason instanceof ApiError && reason.code === 'DAILY_COMBAT_COMPOSITION_CHANGED')
      setAmbiguous(position === null && !definitive)
      if (definitive) key.current = null
      setError(definitive || position !== null ? apiErrorMessage(reason) : 'Résultat non confirmé. Réessayez la même composition pour retrouver son résultat sans la doubler.')
    }
  })
  const reload = () => void run(async () => {
    if (!onReload) return
    try {
      const next = await onReload()
      if (!mounted.current) return
      setExpected({ids:combatCompositionIds(next),mode:next.loadout.nextAttemptMode,encounterId:next.encounter.id});key.current=null;setAmbiguous(false);setConflict(false)
      setError('Formation serveur rechargée ; votre brouillon est conservé. Vérifiez-le avant de confirmer.')
    } catch (reason) { if (mounted.current) setError(apiErrorMessage(reason)) }
  })
  const currentId = position === null ? null : expected.ids[position - 1]
  const catalog = value.availableCharacters.map(character=>({...character,classKey:null}))
  const filtered = filterTeamCharacters(catalog, search, element)
  return <CharacterSelector team={{position:1}} eyebrow={position === null ? 'Entraînement · Votre formation' : 'Entraînement · Emplacement ' + position} reloadLabel="Recharger la formation et conserver le brouillon" characters={position === null ? pinOpeningCharacters(opening,filtered) : filtered} presentIds={new Set(expected.ids.filter((id):id is string=>id!==null&&id!==currentId))} search={search} elementFilter={element} selectedId={choice} pending={pending} onSearch={setSearch} onElement={setElement} onSelect={id=>{if(position===null){if(!ambiguous){setDraft(toggleComposition(draft,id));key.current=null}}else setChoice(id)}} onClose={onClose} onConfirm={confirm} error={position === null ? undefined : error} getStatus={id=>{
    const selected = position === null ? draft.includes(id) : id===currentId
    if (!value.availableCharacters.some(character=>character.id===id)) return {label:'Indisponible',disabled:!selected}
    if (value.koCharacterIds.includes(id)) return {label:'💀 KO · Disponible demain',disabled:!selected,tone:'danger' as const}
    return position !== null && expected.ids.includes(id) && id !== currentId ? {label:'Déjà sélectionné',disabled:true} : undefined
  }} multi={position===null?{draft,catalog:pinOpeningCharacters(opening,catalog),ambiguous,conflict,error,onReload:reload}:undefined}/>
}
