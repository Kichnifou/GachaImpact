import {useId,useRef,useState} from 'react'
import type {CatalogCandidate,CatalogOverview} from '../../api/catalog-types'
import {getGameApiClient} from '../../api/game-api'
import {elementKeys} from '../../api/types'
import {apiErrorMessage} from '../../utils/formatters'
import {AdminFeedback,ConfirmAction,useAdminTask} from './AdminUi'
import {CatalogDialog} from './CatalogDialog'
import {catalogLabels as labels,catalogStatuses,catalogDate as date,trackingLabel,evidenceLabel,catalogErrors} from './catalog-presentation'

const tabs=['Résumé','Informations','Images','Historique'] as const
const elements=['name','originalName','rarity','element','weapon','region','numericId','technicalName','releaseDate','title','constellation','icon','splash','wish','fullbody','promotion']
const source=(url?:string|null)=>url?.startsWith('https://')?<a href={url} target="_blank" rel="noreferrer">Source ↗</a>:null
type Props={detail:CatalogCandidate;overview:CatalogOverview|null;task:ReturnType<typeof useAdminTask>;error:string;notice:string;refreshing:boolean;returnFocus:HTMLElement|null;onRefresh:()=>void;onClose:()=>void}
export default function CatalogCandidateDialog({detail,overview,task,error,notice,refreshing,returnFocus,onRefresh,onClose}:Props){
  const [lastAction,setLastAction]=useState('edit')
  const [tab,setTab]=useState(0),[editing,setEditing]=useState(false),[values,setValues]=useState<Record<string,string>>({})
  const [role,setRole]=useState('icon'),[file,setFile]=useState<File|null>(null),[reason,setReason]=useState('')
  const [trackingAction,setTrackingAction]=useState<'protect'|'pause'|'resume'|'validate'>('protect'),[scope,setScope]=useState<string[]>([])
  const [confirmation,setConfirmation]=useState<'tracking'|'publication'|null>(null)
  const ids=useId(),tabRefs=useRef<(HTMLButtonElement|null)[]>([])
  const state=detail.trackingState??(detail.characterId?'PROTECTED':'ACTIVE')
  const pending=task.pending,active=state==='ACTIVE'
  const collect=(mode:'audit'|'retry')=>{setLastAction('collect');void task.execute(`${detail.id}:${mode}`,key=>getGameApiClient().checkCatalogCandidate(detail.id,mode,key))}
  const upload=async()=>{
    setLastAction('edit')
    if(!file)return
    if(file.size>5*1024*1024){task.setError('L’image doit faire au maximum 5 Mo.');return}
    const encoded=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]!);reader.onerror=reject;reader.readAsDataURL(file)})
    await task.execute(`${detail.id}:upload:${role}:${file.name}:${file.size}`,key=>getGameApiClient().uploadCatalogImage(detail.id,{role,mime:file.type,base64:encoded,idempotencyKey:key}))
  }
  const navigation=<div className="catalog-tabs" role="tablist" aria-label="Sections de la fiche">{tabs.map((title,index)=><button type="button" role="tab" key={title} id={`${ids}-tab-${index}`} aria-controls={`${ids}-panel-${index}`} aria-selected={tab===index} tabIndex={tab===index?0:-1} ref={node=>{tabRefs.current[index]=node}} disabled={pending} onClick={()=>setTab(index)} onKeyDown={event=>{
    const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null
    if(next!==null){event.preventDefault();setTab(next);tabRefs.current[next]?.focus()}
  }}>{title}</button>)}</div>
  return <CatalogDialog title={`${detail.name} · ${catalogStatuses[detail.status]??detail.status}`} pending={pending} onClose={onClose} navigation={navigation} returnFocus={returnFocus}>
    <AdminFeedback error={task.error||error} notice={task.notice?(lastAction==='collect'?'Demande enregistrée. Le résultat sera disponible dans Derniers cycles.':task.notice):notice}/>
    <div role="tabpanel" id={`${ids}-panel-${tab}`} aria-labelledby={`${ids}-tab-${tab}`} tabIndex={0} className="catalog-tab-panel">
      {tab===0&&<>
        <div className="catalog-badges"><span>{trackingLabel(state)}</span><span>Publication {overview?.publicationEnabled&&!overview.dryRun?'activée':'désactivée'}</span><span>Stockage {overview?.storageConfigured?'configuré · qualification requise':'à configurer'}</span><span>{detail.missing.length} élément{detail.missing.length>1?'s':''} à compléter</span></div>
        <p>{detail.characterId?'Présent dans le catalogue GachaImpact. Sa publication ne prouve pas à elle seule sa sortie officielle.':'Candidat uniquement : aucun personnage jouable, possession ou bannière créé.'}</p>
        <dl className="catalog-evidence"><div><dt>Dernier contrôle</dt><dd>{date(detail.checkedAt)}</dd></div><div><dt>Prochain contrôle</dt><dd>{!active?'Suivi suspendu':!overview?.enabled?'En attente d’activation du suivi quotidien':date(detail.nextCheckAt)}</dd></div></dl>
        {detail.trackingReason&&<p>{detail.trackingReason}</p>}
        <p>{detail.missing.length?`À compléter : ${detail.missing.map(value=>labels[value]??value.replace('Confirmation',' · confirmation')).join(', ')}.`:'Aucun manque fondamental.'}</p>
        <div className="catalog-actions"><button type="button" disabled={pending||refreshing} onClick={onRefresh} aria-busy={refreshing}>{refreshing?'Actualisation…':'Actualiser'}</button><button type="button" disabled={pending||!active} onClick={()=>collect('retry')}>Rechercher des mises à jour</button><button type="button" disabled={pending||!active} onClick={()=>collect('audit')}>Comparer sans modifier</button></div>
        <small>Actualiser relit les résultats enregistrés. Une recherche est mise en file serveur ; elle concerne uniquement les éléments ouverts.</small>
        <details className="catalog-advanced"><summary tabIndex={0}>Protection et actions avancées</summary>
          <label>Action<select value={trackingAction} disabled={pending} onChange={event=>setTrackingAction(event.target.value as typeof trackingAction)}><option value="protect">Terminer le suivi</option><option value="pause">Mettre en pause</option><option value="resume">Reprendre le suivi ciblé</option><option value="validate">Valider et verrouiller des éléments</option></select></label>
          {(trackingAction==='resume'||trackingAction==='validate')&&<fieldset><legend>Éléments concernés uniquement</legend><div className="catalog-scope">{elements.map(element=><label key={element}><input type="checkbox" checked={scope.includes(element)} disabled={pending} onChange={event=>setScope(old=>event.target.checked?[...old,element]:old.filter(value=>value!==element))}/>{labels[element]}</label>)}</div></fieldset>}
          <label>Motif du changement de suivi<input value={reason} minLength={10} maxLength={300} disabled={pending} onChange={event=>setReason(event.target.value)}/></label>
          <button type="button" disabled={pending||reason.trim().length<10||((trackingAction==='resume'||trackingAction==='validate')&&!scope.length)} onClick={()=>setConfirmation('tracking')}>Confirmer le changement de suivi…</button>
          <small>La validation ADMIN ne transforme pas une donnée provisoire en preuve officielle. Une réouverture ne supprime pas la priorité des corrections ADMIN.</small>
          {!detail.characterId&&<section className="catalog-anticipation"><h3>Publication anticipée</h3><p>Publication avant la période normale de sept jours précédant la sortie confirmée. Les autres contrôles et verrous restent obligatoires.</p><label>Motif de l’exception<input value={reason} minLength={10} maxLength={300} onChange={event=>setReason(event.target.value)}/></label><button type="button" disabled={pending||reason.trim().length<10||!overview?.publicationEnabled||!overview.storageConfigured||overview.dryRun} onClick={()=>setConfirmation('publication')}>Autoriser la publication anticipée…</button></section>}
        </details>
      </>}
      {tab===1&&<>
        <dl className="catalog-evidence">{[...new Set([...elements.filter(field=>!['icon','splash','wish','fullbody','promotion'].includes(field)),...Object.keys(detail.fields)])].map(field=>{
          const evidence=detail.fields[field]
          return <div key={field}><dt>{labels[field]??field}</dt><dd>{evidence?<><strong>{evidence.value}{field==='rarity'?'★':''}</strong><span>{evidenceLabel(evidence)}{evidence.adminValidated?' · Validation ADMIN':''}{evidence.locked||evidence.override?' · Verrouillé':''}{evidence.conflict?' · Conflit':''}</span><small>{evidence.provider} · {date(evidence.fetchedAt)} · {source(evidence.url)}</small>{evidence.reason&&<small>{evidence.reason}</small>}{evidence.alternatives?.map((alternative,index)=><small key={index}>Autre valeur : {alternative.value} · {evidenceLabel(alternative)} · {alternative.provider} · {source(alternative.url)}</small>)}</>:<span>À trouver · {detail.trackingElements?.includes(field)?'Ouvert au suivi':'Protégé'}</span>}</dd></div>
        })}</dl>
        <small>L’identifiant officiel du personnage est l’identifiant numérique Genshin vérifié ; il ne se déduit pas du nom affiché.</small>
        {detail.characterId?<p>Les corrections des données actives passent par Modifier dans Catalogue et conservent les protections historiques de rareté et d’élément.</p>:<>
          <button type="button" disabled={pending} onClick={()=>setEditing(value=>!value)}>{editing?'Annuler l’édition':'Corriger volontairement les informations'}</button>
          {editing&&<form className="catalog-metadata" onSubmit={event=>{event.preventDefault();const patch:Record<string,string|number>=Object.fromEntries(Object.entries(values).filter(([,value])=>value.trim()));if(patch.rarity)patch.rarity=Number(patch.rarity);void task.execute(`${detail.id}:metadata:${JSON.stringify(patch)}`,key=>getGameApiClient().editCatalogCandidate(detail.id,patch,key)).then(success=>{if(success){setValues({});setEditing(false)}})}}>
            <h3>Correction ADMIN prioritaire</h3>{['name','originalName','weapon','region'].map(field=><label key={field}>{labels[field]}<input maxLength={100} disabled={pending} placeholder={String(detail.fields[field]?.value??'Non renseigné')} value={values[field]??''} onChange={event=>setValues(old=>({...old,[field]:event.target.value}))}/></label>)}
            <label>Rareté<select value={values.rarity??''} disabled={pending} onChange={event=>setValues(old=>({...old,rarity:event.target.value}))}><option value="">Conserver / inconnue</option><option value="4">4★</option><option value="5">5★</option></select></label>
            <label>Élément<select value={values.element??''} disabled={pending} onChange={event=>setValues(old=>({...old,element:event.target.value}))}><option value="">Conserver / inconnu</option>{elementKeys.map(value=><option key={value}>{value}</option>)}</select></label>
            <button type="submit" disabled={pending||!Object.values(values).some(value=>value.trim())}>Enregistrer les corrections</button><small>Les champs laissés vides conservent leur valeur actuelle.</small>
          </form>}
        </>}
      </>}
      {tab===2&&<>
        <div className="catalog-assets">{['icon','splash','wish','fullbody'].map(assetRole=>{
          const asset=detail.assets.filter(value=>value.role===assetRole&&['AVAILABLE','SOURCE_VALIDATED'].includes(value.status)).sort((a,b)=>(b.checkedAt??'').localeCompare(a.checkedAt??'')||a.id.localeCompare(b.id))[0]
          const existing=detail.character?.[`${assetRole}Path` as 'iconPath']
          return <div key={assetRole}><strong>{labels[assetRole]}</strong><span>{asset?`${asset.width}×${asset.height} · ${asset.editorialStatus==='VALIDATED'?'Validé':'Provisoire'}${asset.status==='SOURCE_VALIDATED'?' · Source décodée, non stockée':''}`:existing?'Disponible dans le catalogue':'À trouver'}</span><small>{asset?.autoLocked?'Verrouillé':detail.trackingElements?.includes(assetRole)?'Ouvert au suivi':'Protégé'}</small>{asset?.url&&<img src={asset.url} alt={`${labels[assetRole]} de ${detail.name}`} loading="lazy"/>}{source(asset?.sourceUrl)}</div>
        })}</div>
        {detail.assets.some(asset=>asset.role==='promotion')&&<details><summary>Visuels promotionnels — distincts des images du jeu</summary>{detail.assets.filter(asset=>asset.role==='promotion').map(asset=><p key={asset.id}>{source(asset.sourceUrl)} · Non publié comme portrait ou illustration principale</p>)}</details>}
        <section className="catalog-upload"><h3>Compléter ou remplacer une image</h3>{!overview?.storageConfigured&&<p>Stockage à configurer.</p>}<small>Un remplacement crée une nouvelle version ; l’ancienne est conservée. Vérifier l’identité, la provenance et l’absence de montage avant validation ADMIN.</small>
          <label>Rôle<select value={role} disabled={pending} onChange={event=>setRole(event.target.value)}>{['icon','splash','wish','fullbody'].map(value=><option value={value} key={value}>{labels[value]}</option>)}</select></label>
          <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Image du personnage" disabled={!overview?.storageConfigured||pending} onChange={event=>setFile(event.target.files?.[0]??null)}/><button type="button" disabled={!file||!overview?.storageConfigured||pending} onClick={()=>{void upload().catch(cause=>task.setError(apiErrorMessage(cause)))}}>Valider et téléverser</button>
        </section>
      </>}
      {tab===3&&<section><h3>Contrôles et changements</h3>{detail.attempts?.length?detail.attempts.map(attempt=><article key={attempt.id} className="catalog-attempt"><strong>{date(attempt.checkedAt)} · {labels[attempt.field]??attempt.field}</strong><span>{attempt.provider} · {({ADDED:'Nouvelle information',UPDATED:'Information mise à jour',REPLACED:'Image remplacée',FOUND:'Source consultée',PROVISIONAL:'Information provisoire',MISSING:'Absent',AVAILABLE:'Image stockée',CONFLICT:'Conflit',ERROR:'Erreur',REJECTED:'Écarté',SOURCE_VALIDATED:'Source image décodée'})[attempt.outcome]??attempt.outcome}{attempt.httpStatus?` · HTTP ${attempt.httpStatus}`:''}</span>{attempt.errorCode&&<small>{catalogErrors[attempt.errorCode]??attempt.errorCode}</small>}{source(attempt.sourceUrl)}</article>):<p>Aucune tentative enregistrée.</p>}</section>}
    </div>
    {confirmation&&<ConfirmAction title={confirmation==='publication'?`Publication anticipée de ${detail.name} ?`:`Modifier le suivi de ${detail.name} ?`} pending={pending} onCancel={()=>setConfirmation(null)} onConfirm={()=>{
      setLastAction('edit')
      const signature=`${detail.id}:${confirmation}:${trackingAction}:${scope.join(',')}:${reason}:${detail.revision}`
      void task.execute(signature,key=>confirmation==='publication'?getGameApiClient().overrideCatalogWindow(detail.id,reason,detail.revision,key):getGameApiClient().setCatalogTracking(detail.id,{action:trackingAction,elements:scope,reason,expectedRevision:detail.revision,idempotencyKey:key})).then(success=>{if(success)setConfirmation(null)})
    }}>{reason}. {confirmation==='tracking'&&(trackingAction==='resume'||trackingAction==='validate')?`Éléments sélectionnés uniquement : ${scope.map(value=>labels[value]).join(', ')}.`:'Les données et anciennes versions sont conservées.'}</ConfirmAction>}
  </CatalogDialog>
}
