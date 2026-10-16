import { useContext, useEffect, useRef, useState } from 'react'
import AppButton from '../components/AppButton'
import { useModalDialog } from '../components/useModalDialog'
import { useTutorialPresentation } from '../tutorial/tutorial-presentation'
import { AuthContext } from '../auth/auth-context'
import { createReauthenticationClient } from '../infrastructure/supabase/client'
import { ApiError } from '../api/game-api'
import {AccountDeletionFlowProvider,useAccountDeletionFlow} from './AccountDeletionFlow'

function DeletionDialog({ onClose }: { onClose: () => void }) {
  const flow=useAccountDeletionFlow()
  const auth=useContext(AuthContext),busy=useRef(false),proof=useRef('')
  const ref = useModalDialog<HTMLDivElement>(()=>{if(!busy.current)onClose()})
  const [confirmation, setConfirmation] = useState('')
  const [password,setPassword]=useState(''),[verified,setVerified]=useState(false)
  const [stage,setStage]=useState<'idle'|'verifying'|'deleting'>('idle'),[error,setError]=useState(''),[notice,setNotice]=useState('')
  useEffect(()=>{if(!verified)return;const timer=setTimeout(()=>{proof.current='';setVerified(false);setNotice('Vérifie à nouveau ton identité.')},300_000);return()=>clearTimeout(timer)},[verified])
  useEffect(()=>()=>{proof.current=''},[])
  async function verify(){
    if(busy.current||!password||!auth?.session?.user.email)return
    busy.current=true;proof.current='';setVerified(false);setStage('verifying');setError('');setNotice('')
    const client=createReauthenticationClient()
    try{
      const result=await client.auth.signInWithPassword({email:auth.session.user.email,password})
      if(result.error||!result.data.session||result.data.user?.id!==auth.session.user.id)throw new Error('REAUTH_FAILED')
      proof.current=result.data.session.access_token;setVerified(true);setNotice('Identité vérifiée pour cinq minutes.')
    }catch{setError('La vérification a échoué. Vérifie ton mot de passe et réessaie.')}
    finally{setPassword('');setStage('idle');busy.current=false}
  }
  async function remove(){
    if(busy.current||confirmation!=='SUPPRIMER'||!proof.current||!verified)return
    busy.current=true;setStage('deleting');setError('');setNotice('')
    try{
      if(flow&&auth?.session?.user.id)await flow.begin(auth.session.user.id,proof.current)
    }catch(reason){
      if(reason instanceof ApiError&&reason.code==='ACCOUNT_DELETION_RESPONSIBILITY')setError(reason.message)
      else if(reason instanceof ApiError&&reason.code==='ACCOUNT_REAUTH_REQUIRED'){proof.current='';setVerified(false);setError('Vérifie à nouveau ton identité avant de confirmer.')}
      else setError('La clôture n’a pas pu être confirmée. Réessaie pour vérifier son état. Aucun succès de suppression n’est confirmé.')
    }finally{setStage('idle');busy.current=false}
  }
  const pending=stage!=='idle'
  return <div className="account-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget&&!busy.current) onClose() }}>
    <div ref={ref} className="account-confirm account-deletion-dialog" role="dialog" aria-modal="true" aria-labelledby="account-deletion-title" aria-describedby="account-deletion-warning" aria-busy={pending} tabIndex={-1}>
      <h3 id="account-deletion-title">Supprimer mon compte</h3>
      <p id="account-deletion-warning">Cette action supprimera définitivement ton compte GachaImpact, tes personnages, tes ressources et toute ta progression. Elle est irréversible. Seules les preuves historiques indispensables pourront être conservées, sans tes identifiants externes ni tes contenus personnels.</p>
      <p>Les données actives seront effacées immédiatement. Les sauvegardes privées chiffrées ont un accès restreint et ne pourront pas restaurer ton compte supprimé. Toute restauration est interdite après 30 jours. Les copies sont effacées à l’échéance, ou au prochain réveil du PC s’il est éteint.</p>
      <label htmlFor="account-deletion-password">Mot de passe actuel</label>
      <input id="account-deletion-password" type="password" autoComplete="current-password" value={password} disabled={pending} onChange={event=>setPassword(event.target.value)} />
      <AppButton disabled={pending||!password||!auth?.session?.user.email} onClick={()=>void verify()}>{stage==='verifying'?'Vérification…':'Vérifier mon identité'}</AppButton>
      <label htmlFor="account-deletion-confirmation">Saisis SUPPRIMER pour confirmer</label>
      <input id="account-deletion-confirmation" autoComplete="off" spellCheck={false} disabled={pending} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
      {error&&<p role="alert">{error}</p>}
      {notice&&<p role="status">{notice}</p>}
      <div>
        <AppButton disabled={pending} onClick={onClose}>Annuler</AppButton>
        <AppButton variant="danger" disabled={pending||confirmation!=='SUPPRIMER'||!verified} onClick={()=>void remove()}>{stage==='deleting'?'Suppression en cours…':'Supprimer définitivement'}</AppButton>
      </div>
    </div>
  </div>
}

export default function AccountDeletionPanel() {
  const flow=useAccountDeletionFlow()
  const [open, setOpen] = useState(false)
  const tutorial = useTutorialPresentation().active
  if(!flow)return <AccountDeletionFlowProvider><AccountDeletionPanel /></AccountDeletionFlowProvider>
  return <section className="account-section account-deletion-section">
    <h3>Supprimer mon compte</h3>
    <p>La suppression efface définitivement ton compte et toute ta progression.</p>
    {flow.refusal&&<p role="alert">{flow.refusal}</p>}
    <AppButton variant="danger" disabled={tutorial} onClick={() => setOpen(true)}>Supprimer mon compte</AppButton>
    {open && !tutorial && <DeletionDialog onClose={() => setOpen(false)} />}
  </section>
}
