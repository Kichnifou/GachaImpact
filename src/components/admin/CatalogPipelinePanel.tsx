import {useCallback,useEffect,useRef,useState} from 'react'
import {getGameApiClient} from '../../api/game-api'
import type {CatalogCandidate,CatalogOverview} from '../../api/catalog-types'
import {apiErrorMessage} from '../../utils/formatters'
import {AdminFeedback,AdminPager,useAdminTask} from './AdminUi'
import CatalogCandidateDialog from './CatalogCandidateDialog'
import CatalogRefresh from './CatalogRefresh'
import {catalogStatuses as statusLabels,catalogLabels as labels,catalogDate as date,trackingLabel,runLabel} from './catalog-presentation'

export default function CatalogPipelinePanel({initialId,onIntentConsumed}:{initialId?:string;onIntentConsumed?:()=>void}){
  const [overview,setOverview]=useState<CatalogOverview|null>(null),[detail,setDetail]=useState<CatalogCandidate|null>(null)
  const [loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[error,setError]=useState(''),[announcement,setAnnouncement]=useState('')
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('tracked'),[page,setPage]=useState(1),[reload,setReload]=useState(0)
  const currentId=useRef<string|null>(null),requestVersion=useRef(0),refreshGate=useRef(false),detailRefreshGate=useRef(false)
  const openerRef=useRef<HTMLElement|null>(null)
  useEffect(()=>()=>{requestVersion.current++},[])
  const refresh=useCallback(()=>{if(refreshGate.current)return;refreshGate.current=true;setReload(value=>value+1)},[])
  const task=useAdminTask(refresh)
  useEffect(()=>{if(!task.notice)return;const timer=setTimeout(task.clearFeedback,2500);return()=>clearTimeout(timer)},[task.notice])
  const open=useCallback(async(id:string)=>{
    if(!currentId.current&&document.activeElement instanceof HTMLElement)openerRef.current=document.activeElement
    const version=++requestVersion.current;setDetailLoading(true);setError('')
    try{const value=await getGameApiClient().getCatalogCandidate(id);if(version!==requestVersion.current)return;currentId.current=id;setDetail(value);return true}
    catch(cause){if(version===requestVersion.current)setError(apiErrorMessage(cause))}
    finally{if(version===requestVersion.current)setDetailLoading(false)}
  },[])
  const refreshDetail=()=>{if(!detail||detailRefreshGate.current)return;task.clearFeedback();detailRefreshGate.current=true;setAnnouncement('');void open(detail.id).then(success=>{if(success)setAnnouncement('Lecture terminée.')}).finally(()=>{detailRefreshGate.current=false})}
  useEffect(()=>{let live=true;setLoading(true);setError('');setAnnouncement('')
    void getGameApiClient().getCatalogCandidates(search,page,filter).then(value=>{if(live){setOverview(value);setAnnouncement('Lecture terminée.')}})
      .catch(cause=>{if(live)setError(apiErrorMessage(cause))}).finally(()=>{if(live){setLoading(false);refreshGate.current=false}})
    return()=>{live=false}
  },[search,page,filter,reload])
  useEffect(()=>{task.clearFeedback();if(initialId)void open(initialId)},[initialId,open])
  useEffect(()=>{if(currentId.current&&reload)void open(currentId.current)},[reload,open])
  const activeRun=overview?.activeRun??overview?.runs.find(run=>['RUNNING','QUEUED','FAILED'].includes(run.status))
  useEffect(()=>{if(!activeRun)return;const timer=setTimeout(refresh,5000);return()=>clearTimeout(timer)},[activeRun,overview,refresh])
  const last=overview?.runs[0]
  return <section className="panel admin-list catalog-pipeline" aria-label="Suivi des imports Character" aria-busy={loading}>
    <div className="catalog-toolbar"><h2>Imports et candidats</h2><div className="admin-filters"><input aria-label="Rechercher un candidat" placeholder="Nom du candidat" value={search} onChange={event=>{setSearch(event.target.value);setPage(1)}}/><select aria-label="Statut des candidats" value={filter} onChange={event=>{setFilter(event.target.value);setPage(1)}}><option value="tracked">Encore suivis</option><option value="protected">Protégés</option><option value="all">Toutes les fiches</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><CatalogRefresh loading={loading} onClick={()=>{task.clearFeedback();refresh()}}/></div></div>
    <AdminFeedback error={!detail?(error||task.error):''}/>
    <div className="catalog-feedback" role="status">{!detail&&task.notice?'Demande enregistrée.':''}<span className="sr-only">{announcement}</span></div>
    <div className="catalog-actions"><button type="button" disabled={task.pending||loading||!!activeRun} onClick={()=>void task.execute('global-retry',key=>getGameApiClient().checkCatalogCandidates('retry',key))}>Rechercher des mises à jour</button>{activeRun&&<><span role="status">{'cancelRequestedAt' in activeRun&&activeRun.cancelRequestedAt?'Annulation demandée…':runLabel(activeRun.status)}</span><button type="button" disabled={task.pending||('cancelRequestedAt' in activeRun&&!!activeRun.cancelRequestedAt)} onClick={()=>void task.execute(`cancel:${activeRun.id}`,key=>getGameApiClient().cancelCatalogRun(activeRun.id,key))}>Annuler la recherche</button></>}</div>
    <p className="catalog-last-cycle">Dernier cycle : {last?`${date(last.startedAt)} · ${last.summary?.mode==='audit'?'Vérification sans appliquer · ':''}${runLabel(last.status)} · ${last.summary?.changed??0} changement(s)${last.summary?.remaining?` · ${last.summary.remaining} restante(s)`:''}${last.summary?.errorCode?' · erreur, consulter la configuration':''}`:'Aucun'}</p>
    <details className="catalog-config"><summary>Configuration et outils avancés</summary><div>{overview&&<p>Quotidien : {overview.enabled?overview.dryRun?'simulation':'actif':'désactivé'} · Publication : {overview.publicationEnabled&&!overview.dryRun?'activée':'désactivée'} · Stockage : {overview.storageConfigured?'clé configurée, qualification distincte':'à configurer'}</p>}<button type="button" disabled={task.pending||loading||!!activeRun} onClick={()=>void task.execute('global-audit',key=>getGameApiClient().checkCatalogCandidates('audit',key))}>Vérifier sans appliquer</button><small>Compare les sources sans modifier les fiches.</small>{overview?.runs.map(run=><p key={run.id}>{date(run.startedAt)} · {run.summary?.mode==='audit'?'Simulation · ':''}{runLabel(run.status)}{run.summary?.errorCode?` · ${run.summary.errorCode}`:''}</p>)}</div></details>
    <div className="admin-scroll-list">{loading?<p role="status">Chargement des candidats…</p>:!overview?.entries.length?<p>Aucun candidat dans cette sélection.</p>:overview.entries.map(row=><article className="admin-list-row" key={row.id}><div><strong>{row.name} · {statusLabels[row.status]??row.status}</strong><small>{trackingLabel(row.trackingState)} · Vérifié : {date(row.checkedAt)}</small><small>{row.missing.length?`À compléter : ${row.missing.map(field=>labels[field]??field).join(', ')}`:'Informations et images requises disponibles.'}</small></div><button type="button" disabled={detailLoading} onClick={()=>{task.clearFeedback();void open(row.id)}}>Consulter</button></article>)}</div>
    <AdminPager page={overview?.page??page} totalPages={overview?.totalPages??1} onPage={setPage} pending={loading}/>
    {detailLoading&&!detail&&<span className="sr-only" role="status">Ouverture de la fiche…</span>}
    {detail&&<CatalogCandidateDialog key={detail.id} detail={detail} overview={overview} task={task} error={error} notice={announcement} refreshing={detailLoading} returnFocus={openerRef.current} onRefresh={refreshDetail} onClose={()=>{requestVersion.current++;currentId.current=null;setDetail(null);setDetailLoading(false);task.clearFeedback();onIntentConsumed?.()}}/>}
  </section>
}
