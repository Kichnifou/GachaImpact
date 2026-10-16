import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react'
import {AuthContext} from '../auth/auth-context'
import {ApiError,getGameApiClient} from '../api/game-api'
import {getSupabaseClient} from '../infrastructure/supabase/client'
import AppButton from '../components/AppButton'

const storageKey='gachaimpact.account-deletion-followup.v1'
type Followup={subject:string;requestedAt:number;accepted:boolean}
const Flow=createContext<{begin(subject:string,proof:string):Promise<void>;refusal:string}|null>(null)
export const useAccountDeletionFlow=()=>useContext(Flow)
function readFollowup():Followup|null{
  try{const value=JSON.parse(localStorage.getItem(storageKey)??'null') as Followup|null;
    return value&&typeof value.subject==='string'&&value.subject.length>0&&Number.isFinite(value.requestedAt)&&typeof value.accepted==='boolean'?value:null
  }catch{return null}
}
function persist(value:Followup|null){try{if(value)localStorage.setItem(storageKey,JSON.stringify(value));else localStorage.removeItem(storageKey)}catch{/* Memory followup remains usable if storage is unavailable. */}}

/** Lives above GameShell/Auth screens. Only a non-secret intent is persisted;
 * JWTs stay in memory, and the unchanged server verifies them on every retry.
 */
export function AccountDeletionFlowProvider({children}:{children:ReactNode}){
  const auth=useContext(AuthContext),[followup,setFollowup]=useState(readFollowup)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[expired,setExpired]=useState(false)
  const credentials=useRef<{subject:string;token:string}|null>(null),running=useRef(false),version=useRef(0)
  const request=useRef<AbortController|null>(null)
  const currentUser=useRef(auth?.session?.user.id),foreignUserSeen=useRef(false)
  const heading=useRef<HTMLHeadingElement>(null)
  useEffect(()=>{if(followup)heading.current?.focus()},[followup?.subject])
  useEffect(()=>()=>{version.current++;request.current?.abort();credentials.current=null},[])
  currentUser.current=auth?.session?.user.id
  if(followup&&currentUser.current&&currentUser.current!==followup.subject)foreignUserSeen.current=true
  function clear(){version.current++;request.current?.abort();running.current=false;setBusy(false);credentials.current=null;persist(null);setFollowup(null);setError('');setExpired(false)}
  useEffect(()=>{if(followup&&auth?.session?.user.id&&auth.session.user.id!==followup.subject)clear()},[auth?.session?.user.id,followup])
  async function submit(subject:string,token:string,initial=false){
    if(running.current||currentUser.current&&currentUser.current!==subject)return
    running.current=true;setBusy(true);setError('');setExpired(false)
    const attempt=version.current
    const controller=new AbortController();request.current=controller
    const timeout=setTimeout(()=>controller.abort(),15_000)
    const stillOwned=()=>attempt===version.current&&!foreignUserSeen.current&&(!currentUser.current||currentUser.current===subject)
    try{
      const result=await getGameApiClient().deleteAccount(token,token,controller.signal)
      if(!stillOwned())return
      if(result.status==='PENDING'){
        const accepted={subject,requestedAt:followup?.requestedAt??Date.now(),accepted:true};persist(accepted);setFollowup(accepted);return
      }
      if(result.status!=='COMPLETED')throw new Error('INVALID_DELETION_RESPONSE')
      try{await getSupabaseClient().auth.signOut({scope:'local'})}catch{/* Auth can already be deleted. */}
      if(!stillOwned())return
      credentials.current=null
      try{localStorage.clear()}catch{/* Storage can be disabled. */}
      try{sessionStorage.clear()}catch{/* Reload clears memory. */}
      window.location.replace('/')
    }catch(reason){
      if(!stillOwned())return
      // These explicit server refusals happen before acceptance. A timeout,
      // lost response or 401 can never prove that no deletion was accepted.
      if(initial&&reason instanceof ApiError&&reason.status!==401&&reason.status!==null&&reason.status<500){clear();setError(reason.message);return}
      if(reason instanceof ApiError&&reason.status===401){setExpired(true);setError('Ta session ne permet plus de vérifier la clôture. Si la demande a été acceptée, le serveur poursuit son traitement. Aucun succès de suppression n’est confirmé.')}
      else setError('La clôture n’a pas pu être confirmée. Réessaie pour vérifier son état. Aucun succès de suppression n’est confirmé.')
    }finally{clearTimeout(timeout);if(attempt===version.current){running.current=false;setBusy(false);request.current=null}}
  }
  async function begin(subject:string,proof:string){
    if(running.current)return
    foreignUserSeen.current=false;version.current++;credentials.current={subject,token:proof}
    const intent={subject,requestedAt:Date.now(),accepted:false};persist(intent);setFollowup(intent)
    await submit(subject,proof,true)
  }
  const token=followup&&(credentials.current?.subject===followup.subject?credentials.current.token
    :auth?.session?.user.id===followup.subject?auth.session.access_token:null)
  const visible=followup&&(!auth?.session?.user.id||auth.session.user.id===followup.subject)
  return <Flow.Provider value={{begin,refusal:followup?'':error}}>{visible?<main className="entry-shell"><section className="entry-panel compact panel account-deletion-followup" aria-busy={busy}>
    <h1 ref={heading} tabIndex={-1}>Suppression du compte</h1>
    <p role="status">{followup.accepted?'La suppression est engagée et ton compte est bloqué. Sa clôture reste en cours ; tu peux vérifier à nouveau son état.':'Une demande de suppression a été envoyée. Sa prise en charge et sa clôture restent à confirmer.'}</p>
    {error&&<p role="alert">{error}</p>}
    {!token&&!error&&<p>La session de vérification n’est plus disponible. Si le serveur a accepté la demande, son traitement continue. La clôture n’est pas confirmée.</p>}
    <div className="account-deletion-followup-actions"><AppButton variant="danger" disabled={busy||!token||expired} onClick={()=>void submit(followup.subject,token!)}>{busy?'Vérification en cours…':'Vérifier la clôture'}</AppButton>
    {!busy&&<AppButton onClick={clear}>Fermer le suivi</AppButton>}
    </div>
    <p>Fermer ce suivi n’annule pas une suppression acceptée et ne confirme pas sa réussite.</p>
  </section></main>:children}</Flow.Provider>
}
