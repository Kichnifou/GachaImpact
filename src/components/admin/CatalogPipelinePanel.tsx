import {useCallback,useEffect,useRef,useState} from 'react'
import {getGameApiClient} from '../../api/game-api'
import type {CatalogCandidate,CatalogOverview} from '../../api/catalog-types'
import {apiErrorMessage} from '../../utils/formatters'
import {AdminFeedback,useAdminTask} from './AdminUi'
import CatalogCandidateDialog from './CatalogCandidateDialog'
import {catalogStatuses as statusLabels,catalogLabels as labels,catalogDate as date,trackingLabel} from './catalog-presentation'

export default function CatalogPipelinePanel({initialId}:{initialId?:string}){
  const [overview,setOverview]=useState<CatalogOverview|null>(null),[detail,setDetail]=useState<CatalogCandidate|null>(null)
  const [loading,setLoading]=useState(true),[detailLoading,setDetailLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [search,setSearch]=useState(''),[filter,setFilter]=useState(''),[reload,setReload]=useState(0)
  const currentId=useRef<string|null>(null),requestVersion=useRef(0),refreshGate=useRef(false)
  const detailRefreshGate=useRef(false)
  const openerRef=useRef<HTMLElement|null>(null)
  useEffect(()=>()=>{requestVersion.current++},[])
  const refresh=useCallback(()=>{if(refreshGate.current)return;refreshGate.current=true;setReload(value=>value+1)},[])
  const task=useAdminTask(refresh)
  const open=useCallback(async(id:string)=>{
    if(!currentId.current&&document.activeElement instanceof HTMLElement)openerRef.current=document.activeElement
    const version=++requestVersion.current;setDetailLoading(true);setError('')
    try{const value=await getGameApiClient().getCatalogCandidate(id);if(version!==requestVersion.current)return;currentId.current=id;setDetail(value);return true}
    catch(cause){if(version===requestVersion.current)setError(apiErrorMessage(cause))}
    finally{if(version===requestVersion.current)setDetailLoading(false)}
  },[])
  const refreshDetail=()=>{if(!detail||detailRefreshGate.current)return;detailRefreshGate.current=true;setNotice('');void open(detail.id).then(success=>{if(success)setNotice('Résultats enregistrés actualisés.')}).finally(()=>{detailRefreshGate.current=false})}
  useEffect(()=>{let live=true;setLoading(true);setError('');setNotice('')
    void getGameApiClient().getCatalogCandidates(search).then(value=>{if(live){setOverview(value);if(reload)setNotice('Résultats enregistrés actualisés.')}})
      .catch(cause=>{if(live)setError(apiErrorMessage(cause))}).finally(()=>{if(live){setLoading(false);refreshGate.current=false}})
    return()=>{live=false}
  },[search,reload])
  useEffect(()=>{if(initialId)void open(initialId)},[initialId,open])
  useEffect(()=>{if(currentId.current&&reload)void open(currentId.current)},[reload,open])
  const pendingRun=overview?.runs.some(run=>['retry','audit'].includes(run.summary?.mode??'')&&['RUNNING','QUEUED'].includes(run.status))
  useEffect(()=>{if(!pendingRun)return;const timer=setTimeout(refresh,5000);return()=>clearTimeout(timer)},[pendingRun,overview,refresh])
  const entries=overview?.entries.filter(row=>!filter||row.status===filter)??[]
  return <section className="panel admin-list catalog-pipeline" aria-label="Suivi des imports Character" aria-busy={loading}>
    <div className="catalog-toolbar"><h2>Imports et candidats</h2><div className="admin-filters"><input aria-label="Rechercher un candidat" placeholder="Nom du candidat" value={search} onChange={event=>setSearch(event.target.value)}/><select aria-label="Statut des candidats" value={filter} onChange={event=>setFilter(event.target.value)}><option value="">Tous les statuts</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><button type="button" className="catalog-refresh" onClick={refresh} disabled={loading} aria-busy={loading}>{loading?'Actualisation…':'Actualiser'}</button></div></div>
    <AdminFeedback error={error||task.error} notice={task.notice&&!detail?'Demande enregistrée. Résultat dans Derniers cycles.':notice}/>
    {overview&&<div className="catalog-badges"><span>Quotidien {overview.enabled?overview.dryRun?'en simulation':'activé':'en attente d’activation'}</span><span>Publication {overview.publicationEnabled&&overview.storageConfigured&&!overview.dryRun?'activée':'désactivée'}</span><span>Stockage {overview.storageConfigured?'configuré · qualification requise':'à configurer'}</span><span>{overview.entries.filter(row=>row.trackingState==='ACTIVE').length} fiches suivies</span></div>}
    <div className="catalog-actions"><button type="button" disabled={task.pending||loading} onClick={()=>void task.execute('global-retry',key=>getGameApiClient().checkCatalogCandidates('retry',key))}>Rechercher des mises à jour</button><button type="button" disabled={task.pending||loading} onClick={()=>void task.execute('global-audit',key=>getGameApiClient().checkCatalogCandidates('audit',key))}>Comparer sans modifier</button></div>
    {loading&&<p role="status">Chargement des candidats…</p>}
    {!loading&&!entries.length&&<p>Aucun candidat dans cette sélection.</p>}
    <div className="admin-scroll-list">{entries.map(row=><article className="admin-list-row" key={row.id}><div><strong>{row.name} · {statusLabels[row.status]??row.status}</strong><small>{trackingLabel(row.trackingState)} · Vérifié : {date(row.checkedAt)}</small><small>{row.trackingState!=='ACTIVE'?'Suivi suspendu':!overview?.enabled?'Prochain contrôle quotidien : en attente d’activation':`Prochain contrôle : ${date(row.nextCheckAt)}`}</small><small>{row.missing.length?`À compléter : ${row.missing.map(field=>labels[field]??field).join(', ')}`:'Informations et images requises disponibles.'}</small></div><button type="button" disabled={detailLoading} onClick={()=>void open(row.id)}>Consulter</button></article>)}</div>
    {detailLoading&&!detail&&<p role="status">Ouverture de la fiche…</p>}
    {overview&&<details><summary>Derniers cycles</summary>{overview.runs.map(run=><p key={run.id}>{date(run.startedAt)} · {run.status==='COMPLETED'?run.summary?.changed?'Terminé avec nouvelles informations':'Terminé sans changement':run.status==='FAILED'?'Erreur, reprise différée':run.status==='QUEUED'?'En attente':'En cours'}{run.summary?.changed!==undefined?` · ${run.summary.changed} modification(s) réelle(s)`:''}{run.summary?.remaining!==undefined?` · ${run.summary.remaining} fiche(s) restante(s)`:''}</p>)}</details>}
    {detail&&<CatalogCandidateDialog key={detail.id} detail={detail} overview={overview} task={task} error={error} notice={notice} refreshing={detailLoading} returnFocus={openerRef.current} onRefresh={refreshDetail} onClose={()=>{requestVersion.current++;currentId.current=null;setDetail(null);setDetailLoading(false)}}/>}
  </section>
}
